export type ServiceStatus = 'nominal' | 'warning' | 'critical';
export type ChartStyleType = 'line' | 'bar' | 'radar' | 'doughnut';

export interface MetricSample {
  timestamp: string; // ISO string
  epochMs: number;
  relativeSec: number; // e.g. -30 .. 0 when inspected in crash blackbox
  primaryValue: number;
  secondaryValue: number;
  latencyMs: number;
  errorRate: number;
  status: ServiceStatus;
  note?: string;
}

export interface ServiceFeed {
  id: string;
  cameraCode: string; // e.g. CAM-01
  name: string;
  serviceType: 'wazuh' | 'zabbix' | 'ceph' | 'redis' | 'rabbitmq' | 'custom';
  group: string;
  endpointUrl: string;
  refreshIntervalSec: number;
  autoRefreshPage: boolean;
  status: ServiceStatus;
  primaryMetricLabel: string;
  primaryMetricUnit: string;
  secondaryMetricLabel: string;
  secondaryMetricUnit: string;
  warningThreshold: number;
  criticalThreshold: number;
  chartType: ChartStyleType;
  chartFill: boolean;
  chartSmooth: boolean;
  accentColor: string;
  nodesOnline: number;
  nodesTotal: number;
  lastUpdated: string;
  /**
   * 30-second high-resolution rolling ring buffer (1 sample per second, max 30 samples)
   * Guarantees that on any system failure we have the exact last 20-30 seconds of received metrics.
   */
  ringBuffer30s: MetricSample[];
}

export interface CrashBlackboxReport {
  id: string;
  serviceId: string;
  cameraCode: string;
  serviceName: string;
  group: string;
  crashTimestamp: string;
  crashEpochMs: number;
  windowDurationSec: number; // 20-30 seconds captured
  triggerReason: string;
  rootCauseDiagnosis: string;
  recommendedAction: string;
  peakPrimaryValue: number;
  avgPrimaryValue: number;
  peakLatencyMs: number;
  primaryMetricLabel: string;
  primaryMetricUnit: string;
  secondaryMetricLabel: string;
  secondaryMetricUnit: string;
  samples20to30s: MetricSample[];
  resolved: boolean;
}

export interface CloudQueryLog {
  id: string;
  timestamp: string;
  epochMs: number;
  serviceId: string;
  serviceName: string;
  group: string;
  queryType: 'POLL_METRICS' | 'ALERT_WEBHOOK' | 'CRASH_DUMP_30S' | 'BACKUP_SNAPSHOT' | 'RESTORE_STATE' | 'CONFIG_CHANGE';
  queryEndpoint: string;
  status: ServiceStatus;
  latencyMs: number;
  summary: string;
  metricsSnapshot: string;
}

export interface CloudBackupSnapshot {
  id: string;
  createdAt: string;
  epochMs: number;
  label: string;
  autoCreated: boolean;
  servicesCount: number;
  logsCount: number;
  criticalIncidentsCount: number;
  forensicSummary: string; // Explains "what went wrong" in this state
  payload: {
    services: ServiceFeed[];
    logs: CloudQueryLog[];
    blackboxReports: CrashBlackboxReport[];
    customWidgets: CustomDashboardWidget[];
  };
}

export interface CustomDashboardWidget {
  id: string;
  title: string;
  serviceIds: string[];
  chartType: ChartStyleType;
  metricField: 'primaryValue' | 'secondaryValue' | 'latencyMs' | 'errorRate';
  timeWindowSec: 15 | 20 | 30;
  showThresholdLine: boolean;
  smoothCurve: boolean;
  fillArea: boolean;
}

export interface NotificationConfig {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  slackEnabled: boolean;
  slackWebhookUrl: string;
  slackChannel: string;
  notifyOnWarning: boolean;
  notifyOnCritical: boolean;
  notifyWith30sBlackbox: boolean;
}

export interface NotificationRecord {
  id: string;
  timestamp: string;
  channelType: 'telegram' | 'slack';
  serviceName: string;
  severity: ServiceStatus;
  message: string;
  remoteDelivered: boolean;
  deliveryNote: string;
}

export interface LogFilterCriteria {
  search?: string;
  group?: string;
  status?: string;
  dateFrom?: string; // ISO or YYYY-MM-DDTHH:mm
  dateTo?: string;
}

export const DEFAULT_RING_BUFFER_SIZE = 30;

/**
 * Appends a new metric sample to the service's 30-second rolling buffer,
 * keeping at most `maxSamples` (default 30 seconds) and recalculating `relativeSec`.
 */
export function appendToRingBuffer(
  buffer: MetricSample[],
  newSample: MetricSample,
  maxSamples: number = DEFAULT_RING_BUFFER_SIZE
): MetricSample[] {
  const combined = [...buffer, newSample];
  const sliced = combined.slice(Math.max(0, combined.length - maxSamples));
  const latestEpoch = sliced[sliced.length - 1]?.epochMs ?? newSample.epochMs;

  return sliced.map((sample, idx) => {
    const rawRel = -(sliced.length - 1 - idx);
    return {
      ...sample,
      relativeSec: rawRel === 0 ? 0 : rawRel,
    };
  });
}

/**
 * Builds deterministic initial 30-second telemetry buffer for a service so that
 * even right after startup, the user has 30 seconds of historical metrics ready.
 */
export function seedInitial30sBuffer(
  basePrimary: number,
  baseSecondary: number,
  baseLatency: number,
  warningThreshold: number,
  criticalThreshold: number,
  nowEpochMs: number = Date.now()
): MetricSample[] {
  const samples: MetricSample[] = [];
  for (let i = 29; i >= 0; i--) {
    const sampleEpoch = nowEpochMs - i * 1000;
    const wave = Math.sin(i * 0.45) * (basePrimary * 0.08) + Math.cos(i * 0.25) * (basePrimary * 0.04);
    const primaryValue = Number(Math.max(1, basePrimary + wave).toFixed(1));
    const secondaryWave = Math.cos(i * 0.35) * (baseSecondary * 0.07);
    const secondaryValue = Number(Math.max(0.5, baseSecondary + secondaryWave).toFixed(1));
    const latencyMs = Math.max(2, Math.round(baseLatency + Math.sin(i * 0.6) * (baseLatency * 0.15)));
    const status: ServiceStatus =
      primaryValue >= criticalThreshold
        ? 'critical'
        : primaryValue >= warningThreshold
        ? 'warning'
        : 'nominal';

    samples.push({
      timestamp: new Date(sampleEpoch).toISOString(),
      epochMs: sampleEpoch,
      relativeSec: i === 0 ? 0 : -i,
      primaryValue,
      secondaryValue,
      latencyMs,
      errorRate: status === 'critical' ? 4.8 : status === 'warning' ? 1.2 : 0.05,
      status,
      note: status === 'nominal' ? 'Стабільний потік' : 'Підвищене навантаження',
    });
  }
  return samples;
}

/**
 * Generates the next 1-second telemetry sample for a service feed.
 * If `forceMode === 'crash'`, generates a realistic failure spike over the buffer so
 * the 20-30s crash blackbox shows a clear anomaly escalation.
 */
export function generateNextTelemetrySample(
  service: ServiceFeed,
  nowEpochMs: number = Date.now(),
  forceMode?: 'crash' | 'warning' | 'recover'
): MetricSample {
  const last = service.ringBuffer30s[service.ringBuffer30s.length - 1];
  const prevPrimary = last ? last.primaryValue : service.warningThreshold * 0.6;
  const prevSecondary = last ? last.secondaryValue : 45;
  const prevLatency = last ? last.latencyMs : 18;

  if (forceMode === 'crash') {
    const spikePrimary = Number((service.criticalThreshold * 1.22).toFixed(1));
    const spikeSecondary = Number((prevSecondary * 1.65 + 25).toFixed(1));
    const spikeLatency = Math.round(prevLatency * 4.5 + 190);
    return {
      timestamp: new Date(nowEpochMs).toISOString(),
      epochMs: nowEpochMs,
      relativeSec: 0,
      primaryValue: spikePrimary,
      secondaryValue: spikeSecondary,
      latencyMs: spikeLatency,
      errorRate: 14.6,
      status: 'critical',
      note: 'КРИТИЧНИЙ ЗБІЙ: Перевищення ліміту та таймаут вузла',
    };
  }

  if (forceMode === 'warning') {
    const warnPrimary = Number(((service.warningThreshold + service.criticalThreshold) / 2).toFixed(1));
    return {
      timestamp: new Date(nowEpochMs).toISOString(),
      epochMs: nowEpochMs,
      relativeSec: 0,
      primaryValue: warnPrimary,
      secondaryValue: Number((prevSecondary * 1.2).toFixed(1)),
      latencyMs: Math.round(prevLatency * 1.7 + 25),
      errorRate: 2.4,
      status: 'warning',
      note: 'УВАГА: Відхилення метрики від норми',
    };
  }

  if (forceMode === 'recover') {
    const safePrimary = Number((service.warningThreshold * 0.58).toFixed(1));
    return {
      timestamp: new Date(nowEpochMs).toISOString(),
      epochMs: nowEpochMs,
      relativeSec: 0,
      primaryValue: safePrimary,
      secondaryValue: Number(Math.max(10, prevSecondary * 0.7).toFixed(1)),
      latencyMs: 14,
      errorRate: 0.02,
      status: 'nominal',
      note: 'Відновлено нормальний режим роботи',
    };
  }

  // Normal live drift
  const phase = (nowEpochMs / 1000) % 60;
  const baseline = service.warningThreshold * 0.62;
  const drift = Math.sin(phase * 0.3) * (service.warningThreshold * 0.09);
  const nextPrimary = Number(
    Math.max(1, prevPrimary * 0.65 + (baseline + drift) * 0.35).toFixed(1)
  );
  const nextSecondary = Number(
    Math.max(1, prevSecondary * 0.8 + (40 + Math.cos(phase * 0.25) * 12) * 0.2).toFixed(1)
  );
  const nextLatency = Math.max(3, Math.round(prevLatency * 0.7 + (16 + Math.sin(phase) * 6) * 0.3));

  const status: ServiceStatus =
    nextPrimary >= service.criticalThreshold
      ? 'critical'
      : nextPrimary >= service.warningThreshold
      ? 'warning'
      : 'nominal';

  return {
    timestamp: new Date(nowEpochMs).toISOString(),
    epochMs: nowEpochMs,
    relativeSec: 0,
    primaryValue: nextPrimary,
    secondaryValue: nextSecondary,
    latencyMs: nextLatency,
    errorRate: status === 'critical' ? 8.2 : status === 'warning' ? 1.5 : 0.04,
    status,
    note: status === 'nominal' ? 'Отримано телеметрію OK' : 'Перевищення порогу',
  };
}

/**
 * Captures the last 20–30 seconds of metrics from a service's ring buffer during a failure.
 * Produces a complete forensic blackbox report explaining what went wrong in the final 20–30s.
 */
export function captureCrashBlackbox(
  service: ServiceFeed,
  triggerReason: string,
  crashEpochMs: number = Date.now()
): CrashBlackboxReport {
  // Extract the last 20 to 30 samples (up to 30 seconds of pre-crash data)
  const rawSamples = service.ringBuffer30s.slice(-30);
  const latestEpoch = rawSamples[rawSamples.length - 1]?.epochMs ?? crashEpochMs;

  const samples20to30s: MetricSample[] = rawSamples.map((s, idx) => ({
    ...s,
    relativeSec: -(rawSamples.length - 1 - idx),
  }));

  const primaryValues = samples20to30s.map((s) => s.primaryValue);
  const latencies = samples20to30s.map((s) => s.latencyMs);

  const peakPrimaryValue = primaryValues.length ? Math.max(...primaryValues) : 0;
  const firstPrimaryValue = primaryValues[0] ?? 0;
  const avgPrimaryValue = primaryValues.length
    ? Number((primaryValues.reduce((a, b) => a + b, 0) / primaryValues.length).toFixed(1))
    : 0;
  const peakLatencyMs = latencies.length ? Math.max(...latencies) : 0;
  const deltaPercent =
    firstPrimaryValue > 0
      ? Math.round(((peakPrimaryValue - firstPrimaryValue) / firstPrimaryValue) * 100)
      : 100;

  let rootCauseDiagnosis = '';
  let recommendedAction = '';

  switch (service.serviceType) {
    case 'wazuh':
      rootCauseDiagnosis = `За останні ${samples20to30s.length} сек зафіксовано сплеск подій безпеки (+${deltaPercent}%, пік ${peakPrimaryValue} ${service.primaryMetricUnit}). Переповнення черги аналізатора Wazuh Manager через масовану brute-force / FIM активність на вузлах.`;
      recommendedAction = 'Ізолювати підозрілі агенти, збільшити пул воркерів wazuh-analysisd та відновити конфігурацію з останнього бекапу.';
      break;
    case 'zabbix':
      rootCauseDiagnosis = `Протягом останніх ${samples20to30s.length} сек утилізація CPU/Poller зросла до ${peakPrimaryValue}${service.primaryMetricUnit} при затримці бази ${peakLatencyMs} мс. Вичерпано пул з'єднань Zabbix History Syncer.`;
      recommendedAction = 'Очистити завислі сесії БД, перезапустити пул zabbix-server poller та застосувати точку відновлення.';
      break;
    case 'ceph':
      rootCauseDiagnosis = `У вікні останніх ${samples20to30s.length} сек латентність OSD у кластері Ceph (Seph) зросла на +${deltaPercent}% (пік IOPS/Навантаження: ${peakPrimaryValue} ${service.primaryMetricUnit}, затримка ${peakLatencyMs} мс). Виявлено деградацію Placement Groups (PGs degraded / slow ops).`;
      recommendedAction = 'Перевірити статус OSD дисків (ceph osd tree), призупинити глибокий скрабінг (noscrub) і відновити ваги PG з бекапу.';
      break;
    case 'redis':
      rootCauseDiagnosis = `За останні ${samples20to30s.length} сек використання пам'яті та потік операцій Redis досягли ${peakPrimaryValue} ${service.primaryMetricUnit} (затримка ${peakLatencyMs} мс). Спрацював OOM Eviction / блокування основного потоку при записі RDB снапшоту.`;
      recommendedAction = 'Увімкнути політику allkeys-lru, скинути важкі Lua-скрипти та відновити стан кешу з хмарної резервної копії.';
      break;
    case 'rabbitmq':
      rootCauseDiagnosis = `За останні ${samples20to30s.length} сек черга непідтверджених повідомлень (Unacked) зросла до ${peakPrimaryValue} ${service.primaryMetricUnit}. Воркери-споживачі перестали надсилати ACK, спрацював Memory Alarm брокера.`;
      recommendedAction = 'Перезапустити завислі консьюмери, перенаправити трафік у Dead Letter Exchange та відновити топологію черг.';
      break;
    default:
      rootCauseDiagnosis = `За останні ${samples20to30s.length} сек метрика "${service.primaryMetricLabel}" перевищила критичний поріг (${peakPrimaryValue} > ${service.criticalThreshold} ${service.primaryMetricUnit}), затримка зросла до ${peakLatencyMs} мс (+${deltaPercent}%).`;
      recommendedAction = 'Перевірити доступність вузла, переглянути 30-секундний дамп телеметрії та виконати відновлення з останнього бекапу.';
      break;
  }

  return {
    id: `bbx-${crashEpochMs}-${service.id}`,
    serviceId: service.id,
    cameraCode: service.cameraCode,
    serviceName: service.name,
    group: service.group,
    crashTimestamp: new Date(latestEpoch).toISOString(),
    crashEpochMs: latestEpoch,
    windowDurationSec: samples20to30s.length,
    triggerReason,
    rootCauseDiagnosis,
    recommendedAction,
    peakPrimaryValue,
    avgPrimaryValue,
    peakLatencyMs,
    primaryMetricLabel: service.primaryMetricLabel,
    primaryMetricUnit: service.primaryMetricUnit,
    secondaryMetricLabel: service.secondaryMetricLabel,
    secondaryMetricUnit: service.secondaryMetricUnit,
    samples20to30s,
    resolved: false,
  };
}

/**
 * Filters Cloud Query History logs by search query, group, status, and date range (`dateFrom` / `dateTo`).
 */
export function filterQueryLogs(logs: CloudQueryLog[], criteria: LogFilterCriteria): CloudQueryLog[] {
  const searchLower = (criteria.search || '').trim().toLowerCase();
  const groupFilter = criteria.group && criteria.group !== 'ALL' ? criteria.group : null;
  const statusFilter = criteria.status && criteria.status !== 'ALL' ? criteria.status : null;

  const fromEpoch = criteria.dateFrom ? new Date(criteria.dateFrom).getTime() : null;
  const toEpoch = criteria.dateTo ? new Date(criteria.dateTo).getTime() : null;

  return logs.filter((log) => {
    if (groupFilter && log.group !== groupFilter) {
      return false;
    }
    if (statusFilter && log.status !== statusFilter) {
      return false;
    }
    if (fromEpoch && !Number.isNaN(fromEpoch) && log.epochMs < fromEpoch) {
      return false;
    }
    if (toEpoch && !Number.isNaN(toEpoch) && log.epochMs > toEpoch) {
      return false;
    }
    if (searchLower) {
      const haystack = `${log.serviceName} ${log.group} ${log.queryType} ${log.queryEndpoint} ${log.summary} ${log.metricsSnapshot}`.toLowerCase();
      if (!haystack.includes(searchLower)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Creates a restorable Cloud Backup Snapshot with an automated forensic summary
 * explaining any failures or anomalies present at backup time.
 */
export function createBackupSnapshot(
  services: ServiceFeed[],
  logs: CloudQueryLog[],
  blackboxReports: CrashBlackboxReport[],
  customWidgets: CustomDashboardWidget[],
  label: string,
  autoCreated: boolean = false,
  nowEpochMs: number = Date.now()
): CloudBackupSnapshot {
  const criticalServices = services.filter((s) => s.status === 'critical');
  const warningServices = services.filter((s) => s.status === 'warning');
  const criticalLogs = logs.filter((l) => l.status === 'critical');

  let forensicSummary = '';
  if (criticalServices.length > 0) {
    forensicSummary = `Зафіксовано збій у ${criticalServices.length} сервісах (${criticalServices
      .map((s) => s.name)
      .join(', ')}). Збережено повні 30-секундні дампи метрик для розслідування причин інциденту.`;
  } else if (warningServices.length > 0) {
    forensicSummary = `Попередження на ${warningServices.length} каналах (${warningServices
      .map((s) => s.name)
      .join(', ')}). Критичних відмов не виявлено, точка відновлення стабільна.`;
  } else {
    forensicSummary = `Усі ${services.length} сервісів працюють у штатному режимі. Чиста еталонна точка відновлення конфігурації та історії запитів.`;
  }

  // Deep clone payload so future mutations don't alter stored backup
  const clonedPayload = JSON.parse(
    JSON.stringify({
      services,
      logs: logs.slice(0, 250),
      blackboxReports: blackboxReports.slice(0, 30),
      customWidgets,
    })
  );

  return {
    id: `bkp-${nowEpochMs}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date(nowEpochMs).toISOString(),
    epochMs: nowEpochMs,
    label: label.trim() || `Хмарний знімок стану #${new Date(nowEpochMs).toLocaleTimeString('uk-UA')}`,
    autoCreated,
    servicesCount: services.length,
    logsCount: logs.length,
    criticalIncidentsCount: criticalServices.length + criticalLogs.length,
    forensicSummary,
    payload: clonedPayload,
  };
}

/**
 * Formats monitoring state, last 30s metrics, and query logs into a UTF-8 CSV string with BOM.
 */
export function formatMetricsToCSV(
  services: ServiceFeed[],
  logs: CloudQueryLog[],
  blackboxReports: CrashBlackboxReport[]
): string {
  const escapeCsv = (val: string | number | undefined) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [];
  rows.push('=== 1. СТАН КАМЕР МОНІТОРИНГУ (СЕРВІСИ) ===');
  rows.push(
    [
      'Камера',
      'Сервіс',
      'Група',
      'Статус',
      'Період оновлення (с)',
      'Основна метрика',
      'Значення',
      'Додаткова метрика',
      'Значення 2',
      'Затримка (мс)',
      'Вузли онлайн',
      'Останнє оновлення',
    ].join(',')
  );

  for (const s of services) {
    const latest = s.ringBuffer30s[s.ringBuffer30s.length - 1];
    rows.push(
      [
        escapeCsv(s.cameraCode),
        escapeCsv(s.name),
        escapeCsv(s.group),
        escapeCsv(s.status.toUpperCase()),
        escapeCsv(s.refreshIntervalSec),
        escapeCsv(`${s.primaryMetricLabel} (${s.primaryMetricUnit})`),
        escapeCsv(latest?.primaryValue ?? 0),
        escapeCsv(`${s.secondaryMetricLabel} (${s.secondaryMetricUnit})`),
        escapeCsv(latest?.secondaryValue ?? 0),
        escapeCsv(latest?.latencyMs ?? 0),
        escapeCsv(`${s.nodesOnline}/${s.nodesTotal}`),
        escapeCsv(s.lastUpdated),
      ].join(',')
    );
  }

  rows.push('');
  rows.push('=== 2. АВАРІЙНІ ДАМПИ ОСТАННІХ 20-30 СЕКУНД (BLACKBOX) ===');
  rows.push(
    ['ID Звіту', 'Камера', 'Сервіс', 'Час збою', 'Вікно (сек)', 'Пікове значення', 'Пікова затримка (мс)', 'Діагноз (Що пішло не так)'].join(
      ','
    )
  );
  for (const b of blackboxReports) {
    rows.push(
      [
        escapeCsv(b.id),
        escapeCsv(b.cameraCode),
        escapeCsv(b.serviceName),
        escapeCsv(b.crashTimestamp),
        escapeCsv(b.windowDurationSec),
        escapeCsv(`${b.peakPrimaryValue} ${b.primaryMetricUnit}`),
        escapeCsv(b.peakLatencyMs),
        escapeCsv(b.rootCauseDiagnosis),
      ].join(',')
    );
  }

  rows.push('');
  rows.push('=== 3. ПОСЕКУНДНІ МЕТРИКИ ОСТАННІХ 30 СЕКУНД ПО КОЖНОМУ СЕРВІСУ ===');
  rows.push(['Камера', 'Сервіс', 'Відносний час (сек)', 'Час ISO', 'Основна метрика', 'Додаткова метрика', 'Затримка (мс)', 'Статус'].join(','));
  for (const s of services) {
    for (const sample of s.ringBuffer30s.slice(-30)) {
      rows.push(
        [
          escapeCsv(s.cameraCode),
          escapeCsv(s.name),
          escapeCsv(`${sample.relativeSec}s`),
          escapeCsv(sample.timestamp),
          escapeCsv(`${sample.primaryValue} ${s.primaryMetricUnit}`),
          escapeCsv(`${sample.secondaryValue} ${s.secondaryMetricUnit}`),
          escapeCsv(sample.latencyMs),
          escapeCsv(sample.status),
        ].join(',')
      );
    }
  }

  rows.push('');
  rows.push('=== 4. ІСТОРІЯ ЗАПИТІВ У ХМАРНОМУ СХОВИЩІ ===');
  rows.push(['Час', 'Сервіс', 'Група', 'Тип запиту', 'Ендпоінт', 'Статус', 'Затримка (мс)', 'Опис', 'Метрики'].join(','));
  for (const l of logs.slice(0, 100)) {
    rows.push(
      [
        escapeCsv(l.timestamp),
        escapeCsv(l.serviceName),
        escapeCsv(l.group),
        escapeCsv(l.queryType),
        escapeCsv(l.queryEndpoint),
        escapeCsv(l.status),
        escapeCsv(l.latencyMs),
        escapeCsv(l.summary),
        escapeCsv(l.metricsSnapshot),
      ].join(',')
    );
  }

  return '\uFEFF' + rows.join('\n');
}

/**
 * Formats a concise confirmation question for deleting a service or widget dashboard.
 * Example: "Wazuh SIEM" -> "Чи хочете ви видалити Wazuh SIEM дашборд?"
 */
export function formatDeleteDashboardPrompt(rawName: string): string {
  const trimmed = rawName.trim() || 'обраний';
  const alreadyHasDashboardWord = /дашборд$/i.test(trimmed);
  return alreadyHasDashboardWord
    ? `Чи хочете ви видалити ${trimmed}?`
    : `Чи хочете ви видалити ${trimmed} дашборд?`;
}

export interface StandardPrimaryMetricOption {
  label: string;
  defaultUnit: string;
  defaultThresholdPresetId: string;
  defaultWarn: number;
  defaultCrit: number;
}

export interface StandardSecondaryMetricOption {
  label: string;
  defaultUnit: string;
}

export interface StandardThresholdPresetOption {
  id: string;
  label: string;
  warn: number;
  crit: number;
}

export const STANDARD_SERVICE_TYPES: Array<{
  value: ServiceFeed['serviceType'];
  label: string;
}> = [
  { value: 'custom', label: 'Універсальний HTTP / Prometheus Exporter' },
  { value: 'wazuh', label: 'Wazuh SIEM / Security Agent' },
  { value: 'zabbix', label: 'Zabbix Server / JSON-RPC API' },
  { value: 'ceph', label: 'Ceph (Seph) RADOS / Object Storage' },
  { value: 'redis', label: 'Redis Cluster / In-Memory Cache' },
  { value: 'rabbitmq', label: 'RabbitMQ AMQP / Message Broker' },
];

export const STANDARD_MONITORING_GROUPS: string[] = [
  'Інфраструктура',
  'Безпека (SIEM)',
  'Сховище даних',
  'Черги та Кеш',
  'Бази даних (SQL / NoSQL)',
  'Мережа та Балансувальники',
  'Контейнери (Kubernetes / Docker)',
  'Веб-сервери та API Gateway',
  'Хмарні сервіси (Cloud)',
];

export const STANDARD_ENDPOINT_TEMPLATES: Array<{
  label: string;
  url: string;
}> = [
  { label: 'Prometheus Node / Service Exporter (:9100)', url: 'https://metrics.internal.noc:9100/metrics' },
  { label: 'Wazuh SIEM Manager API (:55000)', url: 'https://wazuh.internal.noc:55000/v4/events' },
  { label: 'Zabbix JSON-RPC Endpoint', url: 'https://zabbix.internal.noc/api_jsonrpc.php' },
  { label: 'Ceph (Seph) Manager / RGW (:8443)', url: 'https://ceph-rgw.internal.noc:8443/api/osd' },
  { label: 'Redis Cluster Info (:6379)', url: 'redis://redis-cluster.internal.noc:6379/info' },
  { label: 'RabbitMQ Management HTTP API (:15672)', url: 'https://rabbitmq.internal.noc:15672/api/queues' },
  { label: 'Kubernetes / Prometheus Query API (:9090)', url: 'https://prometheus.internal.noc:9090/api/v1/query' },
  { label: 'PostgreSQL / Patroni Exporter (:9187)', url: 'https://postgres.internal.noc:9187/metrics' },
  { label: 'Elasticsearch Cluster Health (:9200)', url: 'https://elastic.internal.noc:9200/_cluster/health' },
  { label: 'Nginx / HAProxy Ingress Status', url: 'https://ingress.internal.noc/stub_status' },
];

export const STANDARD_PRIMARY_METRICS: StandardPrimaryMetricOption[] = [
  {
    label: 'Завантаження CPU',
    defaultUnit: '%',
    defaultThresholdPresetId: 'cpu-std',
    defaultWarn: 75,
    defaultCrit: 90,
  },
  {
    label: "Використання RAM (Пам'ять)",
    defaultUnit: '%',
    defaultThresholdPresetId: 'ram-high',
    defaultWarn: 80,
    defaultCrit: 92,
  },
  {
    label: 'Події безпеки (EPS)',
    defaultUnit: 'подій/с',
    defaultThresholdPresetId: 'siem-eps',
    defaultWarn: 350,
    defaultCrit: 480,
  },
  {
    label: 'Пропускна здатність пулу',
    defaultUnit: 'kIOPS',
    defaultThresholdPresetId: 'storage-iops',
    defaultWarn: 80,
    defaultCrit: 105,
  },
  {
    label: 'Операцій читання/запису',
    defaultUnit: 'тис. ops/s',
    defaultThresholdPresetId: 'cache-ops',
    defaultWarn: 115,
    defaultCrit: 150,
  },
  {
    label: 'Непідтверджені (Unacked)',
    defaultUnit: 'тис. msg',
    defaultThresholdPresetId: 'mq-queue',
    defaultWarn: 40,
    defaultCrit: 65,
  },
  {
    label: "Споживання пам'яті Pod-ів",
    defaultUnit: 'ГБ',
    defaultThresholdPresetId: 'k8s-mem',
    defaultWarn: 64,
    defaultCrit: 80,
  },
  {
    label: 'Час відгуку API (Latency)',
    defaultUnit: 'мс',
    defaultThresholdPresetId: 'api-latency',
    defaultWarn: 200,
    defaultCrit: 450,
  },
  {
    label: 'Інтенсивність запитів (RPS)',
    defaultUnit: 'req/s',
    defaultThresholdPresetId: 'http-rps',
    defaultWarn: 1200,
    defaultCrit: 1800,
  },
  {
    label: 'Навантаження диска (Disk I/O)',
    defaultUnit: 'МБ/с',
    defaultThresholdPresetId: 'disk-io',
    defaultWarn: 350,
    defaultCrit: 500,
  },
  {
    label: 'Мережевий трафік (Throughput)',
    defaultUnit: 'Гбіт/с',
    defaultThresholdPresetId: 'net-gbps',
    defaultWarn: 7,
    defaultCrit: 9.5,
  },
  {
    label: 'Кількість помилок HTTP 5xx',
    defaultUnit: 'помилок/с',
    defaultThresholdPresetId: 'err-rate',
    defaultWarn: 15,
    defaultCrit: 40,
  },
  {
    label: "Активні з'єднання БД",
    defaultUnit: "з'єднань",
    defaultThresholdPresetId: 'db-conn',
    defaultWarn: 180,
    defaultCrit: 240,
  },
  {
    label: 'Навантаження сервісу',
    defaultUnit: '%',
    defaultThresholdPresetId: 'cpu-std',
    defaultWarn: 75,
    defaultCrit: 90,
  },
];

export const STANDARD_METRIC_UNITS: string[] = [
  '%',
  'подій/с',
  'мс',
  'kIOPS',
  'IOPS',
  'тис. ops/s',
  'ops/s',
  'тис. msg',
  'msg/s',
  'req/s',
  'ГБ',
  'МБ/с',
  'Гбіт/с',
  'помилок/с',
  "з'єднань",
  'од.',
];

export const STANDARD_SECONDARY_METRICS: StandardSecondaryMetricOption[] = [
  { label: "Активні з'єднання", defaultUnit: 'клієнтів' },
  { label: 'Критичні FIM тригери', defaultUnit: 'алертів' },
  { label: 'Черга тригерів Zabbix', defaultUnit: 'вузлів' },
  { label: 'Латентність комміту', defaultUnit: 'мс' },
  { label: "Фрагментація пам'яті", defaultUnit: '%' },
  { label: 'Активні консьюмери', defaultUnit: 'воркерів' },
  { label: 'Перезапуски контейнерів', defaultUnit: 'шт/год' },
  { label: 'Час відповіді (p99)', defaultUnit: 'мс' },
  { label: 'Вільне місце у пулі', defaultUnit: 'ТБ' },
  { label: 'Черга вхідних пакетів', defaultUnit: 'пакетів/с' },
  { label: 'Помилки авторизації', defaultUnit: 'подій/хв' },
  { label: 'Реплікаційне відставання (Lag)', defaultUnit: 'мс' },
];

export const STANDARD_SECONDARY_UNITS: string[] = [
  'клієнтів',
  'алертів',
  'вузлів',
  'мс',
  '%',
  'воркерів',
  'шт/год',
  'ТБ',
  'ГБ',
  'пакетів/с',
  'подій/хв',
  'од.',
];

export const STANDARD_THRESHOLD_PRESETS: StandardThresholdPresetOption[] = [
  { id: 'cpu-std', label: 'Стандартне навантаження (75% / 90%)', warn: 75, crit: 90 },
  { id: 'sla-strict', label: 'Суворий SLA моніторинг (60% / 80%)', warn: 60, crit: 80 },
  { id: 'ram-high', label: "Пам'ять / Дисковий пул (80% / 92%)", warn: 80, crit: 92 },
  { id: 'siem-eps', label: 'Потік подій SIEM (350 / 480 подій/с)', warn: 350, crit: 480 },
  { id: 'storage-iops', label: 'Сховище Ceph/SAN (80 / 105 kIOPS)', warn: 80, crit: 105 },
  { id: 'cache-ops', label: 'Високонавантажений кеш (115 / 150 тис. ops/s)', warn: 115, crit: 150 },
  { id: 'mq-queue', label: 'Черга брокера RabbitMQ (40 / 65 тис. msg)', warn: 40, crit: 65 },
  { id: 'k8s-mem', label: 'Кластер Kubernetes (64 / 80 ГБ)', warn: 64, crit: 80 },
  { id: 'api-latency', label: 'Латентність API (200 / 450 мс)', warn: 200, crit: 450 },
  { id: 'http-rps', label: 'Трафік Web/API (1200 / 1800 req/s)', warn: 1200, crit: 1800 },
  { id: 'disk-io', label: 'Дисковий ввід/вивід (350 / 500 МБ/с)', warn: 350, crit: 500 },
  { id: 'net-gbps', label: 'Магістральний канал 10G (7 / 9.5 Гбіт/с)', warn: 7, crit: 9.5 },
  { id: 'err-rate', label: 'Помилки HTTP 5xx (15 / 40 помилок/с)', warn: 15, crit: 40 },
  { id: 'db-conn', label: "Пул з'єднань СУБД (180 / 240 з'єднань)", warn: 180, crit: 240 },
];

export const STANDARD_NODE_COUNTS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1 вузол (Single)' },
  { value: 2, label: '2 вузли (HA Pair)' },
  { value: 3, label: '3 вузли (Quorum)' },
  { value: 4, label: '4 вузли (2x2 Grid)' },
  { value: 6, label: '6 вузлів (Cluster)' },
  { value: 8, label: '8 вузлів (Rack)' },
  { value: 12, label: '12 вузлів (Pool)' },
  { value: 16, label: '16 вузлів (NOC Grid)' },
  { value: 24, label: '24 вузли (Enterprise)' },
  { value: 32, label: '32 вузли (Scale)' },
];

export const STANDARD_REFRESH_INTERVALS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1 сек (Real-time)' },
  { value: 2, label: '2 сек (Стандарт)' },
  { value: 3, label: 'Кожні 3 сек' },
  { value: 5, label: 'Кожні 5 сек' },
  { value: 10, label: 'Кожні 10 сек' },
  { value: 15, label: 'Кожні 15 сек' },
  { value: 30, label: 'Кожні 30 сек' },
  { value: 60, label: 'Кожні 60 сек' },
];

export interface AddServiceFormState {
  activePresetLabel: string | null;
  name: string;
  serviceType: ServiceFeed['serviceType'];
  group: string;
  customGroup: string;
  endpointUrl: string;
  refreshIntervalSec: number;
  nodesTotal: number;
  primaryMetricLabel: string;
  primaryMetricUnit: string;
  secondaryMetricLabel: string;
  secondaryMetricUnit: string;
  thresholdPresetId: string;
  warningThreshold: number;
  criticalThreshold: number;
  chartType: ChartStyleType;
  accentColor: string;
}

/**
 * Returns a clean, reset state for the Add Service modal so previously selected
 * templates do not remain stuck in textboxes or parameter fields.
 */
export function createDefaultServiceFormState(
  defaultGroup: string = 'Інфраструктура'
): AddServiceFormState {
  return {
    activePresetLabel: null,
    name: '',
    serviceType: 'custom',
    group: defaultGroup || 'Інфраструктура',
    customGroup: '',
    endpointUrl: '',
    refreshIntervalSec: 2,
    nodesTotal: 16,
    primaryMetricLabel: 'Завантаження CPU',
    primaryMetricUnit: '%',
    secondaryMetricLabel: "Активні з'єднання",
    secondaryMetricUnit: 'клієнтів',
    thresholdPresetId: 'cpu-std',
    warningThreshold: 75,
    criticalThreshold: 90,
    chartType: 'line',
    accentColor: '#38BDF8',
  };
}

export interface ServicePresetTemplate {
  id: string;
  label: string;
  type: ServiceFeed['serviceType'];
  group: string;
  endpoint: string;
  primaryLabel: string;
  primaryUnit: string;
  secondaryLabel: string;
  secondaryUnit: string;
  thresholdPresetId: string;
  warn: number;
  crit: number;
  nodesTotal: number;
  refreshSec: number;
  chartType: ChartStyleType;
  color: string;
}

export function createDefaultServiceTemplates(): ServicePresetTemplate[] {
  return [
    {
      id: 'tpl-wazuh',
      label: 'Wazuh SIEM',
      type: 'wazuh',
      group: 'Безпека (SIEM)',
      endpoint: 'https://wazuh.internal.noc:55000/v4/events',
      primaryLabel: 'Події безпеки (EPS)',
      primaryUnit: 'подій/с',
      secondaryLabel: 'Критичні FIM тригери',
      secondaryUnit: 'алертів',
      thresholdPresetId: 'siem-eps',
      warn: 350,
      crit: 480,
      nodesTotal: 16,
      refreshSec: 2,
      chartType: 'line',
      color: '#38BDF8',
    },
    {
      id: 'tpl-zabbix',
      label: 'Zabbix Server',
      type: 'zabbix',
      group: 'Інфраструктура',
      endpoint: 'https://zabbix.internal.noc/api_jsonrpc.php',
      primaryLabel: 'Завантаження CPU',
      primaryUnit: '%',
      secondaryLabel: 'Черга тригерів Zabbix',
      secondaryUnit: 'вузлів',
      thresholdPresetId: 'cpu-std',
      warn: 75,
      crit: 90,
      nodesTotal: 24,
      refreshSec: 3,
      chartType: 'line',
      color: '#22C55E',
    },
    {
      id: 'tpl-ceph',
      label: 'Ceph (Seph) Storage',
      type: 'ceph',
      group: 'Сховище даних',
      endpoint: 'https://ceph-rgw.internal.noc:8443/api/osd',
      primaryLabel: 'Пропускна здатність пулу',
      primaryUnit: 'kIOPS',
      secondaryLabel: 'Латентність комміту',
      secondaryUnit: 'мс',
      thresholdPresetId: 'storage-iops',
      warn: 80,
      crit: 105,
      nodesTotal: 12,
      refreshSec: 2,
      chartType: 'bar',
      color: '#F59E0B',
    },
    {
      id: 'tpl-redis',
      label: 'Redis Cluster',
      type: 'redis',
      group: 'Черги та Кеш',
      endpoint: 'redis://redis-cluster.internal.noc:6379/info',
      primaryLabel: 'Операцій читання/запису',
      primaryUnit: 'тис. ops/s',
      secondaryLabel: "Фрагментація пам'яті",
      secondaryUnit: '%',
      thresholdPresetId: 'cache-ops',
      warn: 115,
      crit: 150,
      nodesTotal: 6,
      refreshSec: 1,
      chartType: 'line',
      color: '#EC4899',
    },
    {
      id: 'tpl-rabbitmq',
      label: 'RabbitMQ Broker',
      type: 'rabbitmq',
      group: 'Черги та Кеш',
      endpoint: 'https://rabbitmq.internal.noc:15672/api/queues',
      primaryLabel: 'Непідтверджені (Unacked)',
      primaryUnit: 'тис. msg',
      secondaryLabel: 'Активні консьюмери',
      secondaryUnit: 'воркерів',
      thresholdPresetId: 'mq-queue',
      warn: 40,
      crit: 65,
      nodesTotal: 4,
      refreshSec: 2,
      chartType: 'bar',
      color: '#A855F7',
    },
    {
      id: 'tpl-prometheus',
      label: 'Prometheus / Kubernetes',
      type: 'custom',
      group: 'Контейнери (Kubernetes / Docker)',
      endpoint: 'https://prometheus.internal.noc:9090/api/v1/query',
      primaryLabel: "Споживання пам'яті Pod-ів",
      primaryUnit: 'ГБ',
      secondaryLabel: 'Перезапуски контейнерів',
      secondaryUnit: 'шт/год',
      thresholdPresetId: 'k8s-mem',
      warn: 64,
      crit: 80,
      nodesTotal: 16,
      refreshSec: 5,
      chartType: 'line',
      color: '#06B6D4',
    },
  ];
}

/**
 * Pure helper to add a new template or update an existing template by ID.
 */
export function upsertServiceTemplate(
  templates: ServicePresetTemplate[],
  candidate: ServicePresetTemplate
): ServicePresetTemplate[] {
  const exists = templates.some((t) => t.id === candidate.id);
  if (exists) {
    return templates.map((t) => (t.id === candidate.id ? { ...candidate } : t));
  }
  return [...templates, { ...candidate }];
}

/**
 * Pure helper to delete a template by ID.
 */
export function removeServiceTemplate(
  templates: ServicePresetTemplate[],
  templateId: string
): ServicePresetTemplate[] {
  return templates.filter((t) => t.id !== templateId);
}

/**
 * Creates the reference set of 5 monitoring cameras (used by unit tests or optional staging templates):
 * Wazuh SIEM, Zabbix, Ceph (Seph), Redis, and RabbitMQ.
 */
export function createInitialServices(nowEpochMs: number = Date.now()): ServiceFeed[] {
  return [
    {
      id: 'srv-wazuh',
      cameraCode: 'CAM-01',
      name: 'Wazuh SIEM',
      serviceType: 'wazuh',
      group: 'Безпека (SIEM)',
      endpointUrl: 'https://wazuh.internal.noc:55000/v4/overview/agents',
      refreshIntervalSec: 2,
      autoRefreshPage: true,
      status: 'nominal',
      primaryMetricLabel: 'Події безпеки (EPS)',
      primaryMetricUnit: 'подій/с',
      secondaryMetricLabel: 'Тригери FIM / IDS',
      secondaryMetricUnit: 'алертів',
      warningThreshold: 380,
      criticalThreshold: 500,
      chartType: 'line',
      chartFill: true,
      chartSmooth: true,
      accentColor: '#38BDF8',
      nodesOnline: 142,
      nodesTotal: 142,
      lastUpdated: new Date(nowEpochMs).toISOString(),
      ringBuffer30s: seedInitial30sBuffer(245, 14, 19, 380, 500, nowEpochMs),
    },
    {
      id: 'srv-zabbix',
      cameraCode: 'CAM-02',
      name: 'Zabbix Core Infrastructure',
      serviceType: 'zabbix',
      group: 'Інфраструктура',
      endpointUrl: 'https://zabbix.internal.noc/api_jsonrpc.php',
      refreshIntervalSec: 3,
      autoRefreshPage: true,
      status: 'nominal',
      primaryMetricLabel: 'Навантаження CPU',
      primaryMetricUnit: '%',
      secondaryMetricLabel: 'Трафік мережі In/Out',
      secondaryMetricUnit: 'Гбіт/с',
      warningThreshold: 75,
      criticalThreshold: 90,
      chartType: 'line',
      chartFill: true,
      chartSmooth: true,
      accentColor: '#22C55E',
      nodesOnline: 64,
      nodesTotal: 64,
      lastUpdated: new Date(nowEpochMs).toISOString(),
      ringBuffer30s: seedInitial30sBuffer(48.5, 6.4, 12, 75, 90, nowEpochMs),
    },
    {
      id: 'srv-ceph',
      cameraCode: 'CAM-03',
      name: 'Ceph (Seph) Object Storage',
      serviceType: 'ceph',
      group: 'Сховище даних',
      endpointUrl: 'https://ceph-mgr.internal.noc:8443/api/health/full',
      refreshIntervalSec: 2,
      autoRefreshPage: true,
      status: 'nominal',
      primaryMetricLabel: 'Пропускна здатність IOPS',
      primaryMetricUnit: 'kIOPS',
      secondaryMetricLabel: 'Латентність запису OSD',
      secondaryMetricUnit: 'мс',
      warningThreshold: 85,
      criticalThreshold: 110,
      chartType: 'bar',
      chartFill: true,
      chartSmooth: false,
      accentColor: '#F59E0B',
      nodesOnline: 36,
      nodesTotal: 36,
      lastUpdated: new Date(nowEpochMs).toISOString(),
      ringBuffer30s: seedInitial30sBuffer(54.2, 4.8, 15, 85, 110, nowEpochMs),
    },
    {
      id: 'srv-redis',
      cameraCode: 'CAM-04',
      name: 'Redis In-Memory Cluster',
      serviceType: 'redis',
      group: 'Черги та Кеш',
      endpointUrl: 'redis://redis-cluster.internal.noc:6379/info',
      refreshIntervalSec: 1,
      autoRefreshPage: true,
      status: 'nominal',
      primaryMetricLabel: 'Операцій за секунду',
      primaryMetricUnit: 'тис. ops/s',
      secondaryMetricLabel: 'Використання RAM',
      secondaryMetricUnit: '%',
      warningThreshold: 120,
      criticalThreshold: 155,
      chartType: 'line',
      chartFill: true,
      chartSmooth: true,
      accentColor: '#EC4899',
      nodesOnline: 12,
      nodesTotal: 12,
      lastUpdated: new Date(nowEpochMs).toISOString(),
      ringBuffer30s: seedInitial30sBuffer(82.4, 61.5, 4, 120, 155, nowEpochMs),
    },
    {
      id: 'srv-rabbitmq',
      cameraCode: 'CAM-05',
      name: 'RabbitMQ Message Broker',
      serviceType: 'rabbitmq',
      group: 'Черги та Кеш',
      endpointUrl: 'https://rabbitmq.internal.noc:15672/api/overview',
      refreshIntervalSec: 2,
      autoRefreshPage: true,
      status: 'nominal',
      primaryMetricLabel: 'Черга повідомлень',
      primaryMetricUnit: 'тис. msg',
      secondaryMetricLabel: 'Швидкість публікації',
      secondaryMetricUnit: 'msg/s',
      warningThreshold: 45,
      criticalThreshold: 70,
      chartType: 'bar',
      chartFill: true,
      chartSmooth: true,
      accentColor: '#A855F7',
      nodesOnline: 8,
      nodesTotal: 8,
      lastUpdated: new Date(nowEpochMs).toISOString(),
      ringBuffer30s: seedInitial30sBuffer(18.6, 1420, 9, 45, 70, nowEpochMs),
    },
  ];
}
