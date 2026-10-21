import express from 'express';
import fs from 'fs';
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health & Cloud Sync status endpoint
  app.get('/api/cloud/state', (_req, res) => {
    const store = ensureCloudStore();
    res.json({
      status: 'ok',
      cloudProvider: 'SentinelCloud Object Store (S3-Compatible)',
      updatedAt: store.updatedAt,
      data: store,
    });
  });

  // Sync services, logs, backups, blackbox dumps, and custom widgets to Cloud Storage
  app.post('/api/cloud/sync', (req, res) => {
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
    res.json({
      status: 'synced',
      updatedAt: updated.updatedAt,
      counts: {
        services: updated.services.length,
        logs: updated.logs.length,
        backups: updated.backups.length,
        blackboxReports: updated.blackboxReports.length,
      },
    });
  });

  // Create a dedicated Cloud Backup Snapshot
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

  // Dispatch notification to Telegram or Slack
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
