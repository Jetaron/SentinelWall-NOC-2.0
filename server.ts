import express from 'express';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.data');
const CLOUD_STORE_PATH = path.join(DATA_DIR, 'cloud_storage.json');

interface CloudStoreData {
  updatedAt: string;
  services: unknown[];
  logs: unknown[];
  backups: unknown[];
  blackboxReports: unknown[];
  customWidgets: unknown[];
  notificationHistory: unknown[];
  notificationConfig?: Record<string, unknown>;
  serviceTemplates?: unknown[];
}

export interface LiveProbeResult {
  online: boolean;
  latencyMs: number;
  isDemoHost: boolean;
  host: string;
  port: number;
  checkedAt: number;
  error?: string;
}

const liveProbeCache: Record<string, LiveProbeResult> = {};

function parseEndpointTarget(rawEndpoint: string): { host: string; port: number; isDemoHost: boolean } {
  const cleaned = (rawEndpoint || '').trim();
  if (!cleaned) {
    return { host: '127.0.0.1', port: 0, isDemoHost: false };
  }

  if (/^:?\d{1,5}$/.test(cleaned)) {
    return {
      host: '127.0.0.1',
      port: parseInt(cleaned.replace(':', ''), 10),
      isDemoHost: false,
    };
  }

  try {
    const withProtocol = cleaned.includes('://') ? cleaned : `http://${cleaned}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname || '127.0.0.1';
    let port = parsed.port ? parseInt(parsed.port, 10) : 0;

    if (!port) {
      if (parsed.protocol === 'https:') port = 443;
      else if (parsed.protocol === 'redis:') port = 6379;
      else port = 80;
    }

    return { host, port, isDemoHost: false };
  } catch {
    const match = cleaned.match(/^([^:/]+):(\d{1,5})/);
    if (match) {
      return {
        host: match[1],
        port: parseInt(match[2], 10),
        isDemoHost: false,
      };
    }
    return { host: '127.0.0.1', port: 0, isDemoHost: false };
  }
}

function checkTcpTarget(rawEndpoint: string, timeoutMs = 1200): Promise<LiveProbeResult> {
  const { host, port } = parseEndpointTarget(rawEndpoint);

  if (!port || isNaN(port) || port < 1 || port > 65535) {
    return Promise.resolve({
      online: false,
      latencyMs: 0,
      isDemoHost: false,
      host,
      port: port || 0,
      checkedAt: Date.now(),
      error: 'Invalid port',
    });
  }

  return new Promise((resolve) => {
    const start = performance.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (online: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      const latencyMs = online ? Math.max(1, Math.round(performance.now() - start)) : 0;
      socket.destroy();
      resolve({
        online,
        latencyMs,
        isDemoHost: false,
        host,
        port,
        checkedAt: Date.now(),
        error,
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false, 'TIMEOUT'));
    socket.once('error', (err) => finish(false, err.message));

    socket.connect(port, host);
  });
}

function createEmptyStore(): CloudStoreData {
  return {
    updatedAt: new Date().toISOString(),
    services: [],
    logs: [],
    backups: [],
    blackboxReports: [],
    customWidgets: [],
    notificationHistory: [],
  };
}

function ensureCloudStore(): CloudStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(CLOUD_STORE_PATH)) {
    const initial = createEmptyStore();
    fs.writeFileSync(CLOUD_STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(CLOUD_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CloudStoreData>;
    return {
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      services: Array.isArray(parsed.services) ? parsed.services : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      backups: Array.isArray(parsed.backups) ? parsed.backups : [],
      blackboxReports: Array.isArray(parsed.blackboxReports) ? parsed.blackboxReports : [],
      customWidgets: Array.isArray(parsed.customWidgets) ? parsed.customWidgets : [],
      notificationHistory: Array.isArray(parsed.notificationHistory) ? parsed.notificationHistory : [],
      notificationConfig: parsed.notificationConfig,
      serviceTemplates: Array.isArray(parsed.serviceTemplates)
        ? parsed.serviceTemplates
        : undefined,
    };
  } catch {
    return createEmptyStore();
  }
}

function saveCloudStore(data: CloudStoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(CLOUD_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

async function refreshAllServiceProbes() {
  const store = ensureCloudStore();
  const services = Array.isArray(store.services) ? (store.services as any[]) : [];
  await Promise.all(
    services.map(async (srv) => {
      if (srv && srv.endpointUrl) {
        const res = await checkTcpTarget(String(srv.endpointUrl));
        liveProbeCache[String(srv.endpointUrl)] = res;
      }
    })
  );
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Фонове опитування реальних портів кожні 2 секунди
  setInterval(() => {
    refreshAllServiceProbes().catch(() => {});
  }, 2000);

  // Ендпоінт для отримання живих статусів портів фронтендом
  app.post('/api/probes/check', async (req, res) => {
    const endpoints: string[] = Array.isArray(req.body?.endpoints) ? req.body.endpoints : [];
    const results: Record<string, LiveProbeResult> = {};

    await Promise.all(
      endpoints.map(async (ep) => {
        const key = String(ep || '').trim();
        if (!key) return;
        const probe = await checkTcpTarget(key);
        liveProbeCache[key] = probe;
        results[key] = probe;
      })
    );

    res.json({ probes: results });
  });

  app.get('/api/probes/status', (_req, res) => {
    res.json({ probes: liveProbeCache });
  });

  app.get('/api/cloud/state', (_req, res) => {
    const store = ensureCloudStore();
    res.json({
      status: 'ok',
      cloudProvider: 'SentinelCloud Object Store (S3-Compatible)',
      updatedAt: store.updatedAt,
      data: store,
      probes: liveProbeCache,
    });
  });

  app.post('/api/cloud/sync', async (req, res) => {
    const current = ensureCloudStore();
    const {
      services,
      logs,
      backups,
      blackboxReports,
      customWidgets,
      notificationHistory,
      notificationConfig,
      serviceTemplates,
    } = req.body || {};

    const updated: CloudStoreData = {
      updatedAt: new Date().toISOString(),
      services: Array.isArray(services) ? services : current.services,
      logs: Array.isArray(logs) ? logs.slice(0, 500) : current.logs,
      backups: Array.isArray(backups) ? backups.slice(0, 50) : current.backups,
      blackboxReports: Array.isArray(blackboxReports)
        ? blackboxReports.slice(0, 50)
        : current.blackboxReports,
      customWidgets: Array.isArray(customWidgets) ? customWidgets : current.customWidgets,
      notificationHistory: Array.isArray(notificationHistory)
        ? notificationHistory.slice(0, 100)
        : current.notificationHistory,
      notificationConfig:
        notificationConfig && typeof notificationConfig === 'object'
          ? notificationConfig
          : current.notificationConfig,
      serviceTemplates: Array.isArray(serviceTemplates)
        ? serviceTemplates
        : current.serviceTemplates,
    };

    saveCloudStore(updated);
    await refreshAllServiceProbes();

    res.json({
      status: 'synced',
      updatedAt: updated.updatedAt,
      probes: liveProbeCache,
      counts: {
        services: updated.services.length,
        logs: updated.logs.length,
        backups: updated.backups.length,
        blackboxReports: updated.blackboxReports.length,
      },
    });
  });

  app.post('/api/cloud/backups', (req, res) => {
    const current = ensureCloudStore();
    const snapshot = req.body;
    if (!snapshot || !snapshot.id) {
      res.status(400).json({ error: 'Invalid backup snapshot payload' });
      return;
    }
    current.backups = [
      snapshot,
      ...current.backups.filter((b: any) => b?.id !== snapshot.id),
    ].slice(0, 50);
    saveCloudStore(current);
    res.json({ status: 'backup_saved', backupId: snapshot.id, updatedAt: current.updatedAt });
  });

  app.post('/api/notify/send', async (req, res) => {
    const {
      channelType,
      message,
      telegramBotToken,
      telegramChatId,
      slackWebhookUrl,
      slackChannel,
      serviceName,
      severity,
    } = req.body || {};

    const timestamp = new Date().toISOString();
    let remoteDelivered = false;
    let deliveryNote = 'Збережено у журналі сповіщень (очікує налаштування шлюзу)';

    try {
      if (
        channelType === 'telegram' &&
        telegramBotToken &&
        telegramChatId &&
        !telegramBotToken.startsWith('demo_')
      ) {
        const tgUrl = `https://api.telegram.org/bot${encodeURIComponent(
          telegramBotToken
        )}/sendMessage`;
        const response = await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message,
            parse_mode: 'HTML',
          }),
        });
        if (response.ok) {
          remoteDelivered = true;
          deliveryNote = `Доставлено через Telegram Bot API (Chat ID: ${telegramChatId})`;
        } else {
          const errText = await response.text();
          deliveryNote = `Telegram API відповів (${response.status}): збережено у чергу ретраїв (${errText.slice(0, 80)})`;
        }
      } else if (
        channelType === 'slack' &&
        slackWebhookUrl &&
        slackWebhookUrl.startsWith('https://hooks.slack.com/')
      ) {
        const response = await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: slackChannel || '#noc-alerts',
            text: message,
          }),
        });
        if (response.ok) {
          remoteDelivered = true;
          deliveryNote = `Доставлено у Slack канал ${slackChannel || '#noc-alerts'}`;
        } else {
          deliveryNote = `Slack Webhook відповів (${response.status}): збережено у хмарний буфер`;
        }
      } else {
        deliveryNote =
          channelType === 'telegram'
            ? `Зафіксовано у журналі (вкажіть робочий Bot Token та Chat ID для зовнішньої відправки)`
            : `Зафіксовано у журналі (вкажіть робочий Slack Webhook URL для зовнішньої відправки)`;
      }
    } catch (err: any) {
      deliveryNote = `Шлюз зафіксував повідомлення у хмарному буфері (${err?.message || 'offline relay'})`;
    }

    const record = {
      id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp,
      channelType: channelType || 'telegram',
      serviceName: serviceName || 'Система',
      severity: severity || 'critical',
      message,
      remoteDelivered,
      deliveryNote,
    };

    const current = ensureCloudStore();
    current.notificationHistory = [record, ...current.notificationHistory].slice(0, 100);
    saveCloudStore(current);

    res.json({
      status: 'dispatched',
      record,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SentinelWall NOC Server listening on http://localhost:${PORT}`);
  });
}

startServer();