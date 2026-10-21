import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendToRingBuffer,
  captureCrashBlackbox,
  createBackupSnapshot,
  createDefaultServiceFormState,
  createInitialServices,
  filterQueryLogs,
  formatDeleteDashboardPrompt,
  formatMetricsToCSV,
  generateNextTelemetrySample,
  STANDARD_ENDPOINT_TEMPLATES,
  STANDARD_METRIC_UNITS,
  STANDARD_MONITORING_GROUPS,
  STANDARD_PRIMARY_METRICS,
  STANDARD_SECONDARY_METRICS,
  STANDARD_THRESHOLD_PRESETS,
  type CloudQueryLog,
} from './monitoringEngine.ts';

test('30-second ring buffer retains at most 30 samples and computes relative seconds (-29s to 0s)', () => {
  const baseEpoch = 1760000000000;
  const services = createInitialServices(baseEpoch);
  const redis = services.find((s) => s.serviceType === 'redis')!;

  assert.equal(redis.ringBuffer30s.length, 30);
  assert.equal(redis.ringBuffer30s[0].relativeSec, -29);
  assert.equal(redis.ringBuffer30s[29].relativeSec, 0);

  // Append 5 new samples (1 second apart) and verify buffer stays capped at 30
  let buffer = redis.ringBuffer30s;
  for (let i = 1; i <= 5; i++) {
    const nextSample = generateNextTelemetrySample(
      { ...redis, ringBuffer30s: buffer },
      baseEpoch + i * 1000
    );
    buffer = appendToRingBuffer(buffer, nextSample, 30);
  }

  assert.equal(buffer.length, 30);
  assert.equal(buffer[buffer.length - 1].relativeSec, 0);
  assert.equal(buffer[0].relativeSec, -29);
});

test('captureCrashBlackbox captures the last 20-30 seconds of metrics and diagnoses root cause', () => {
  const baseEpoch = 1760000000000;
  const services = createInitialServices(baseEpoch);
  const ceph = services.find((s) => s.serviceType === 'ceph')!;

  // Trigger a crash sample
  const crashSample = generateNextTelemetrySample(ceph, baseEpoch + 1000, 'crash');
  const updatedCeph = {
    ...ceph,
    status: 'critical' as const,
    ringBuffer30s: appendToRingBuffer(ceph.ringBuffer30s, crashSample, 30),
  };

  const report = captureCrashBlackbox(
    updatedCeph,
    'Перевищення порогу латентності OSD',
    baseEpoch + 1000
  );

  assert.equal(report.serviceId, 'srv-ceph');
  assert.ok(report.windowDurationSec >= 20 && report.windowDurationSec <= 30);
  assert.equal(report.samples20to30s.length, 30);
  assert.ok(report.peakPrimaryValue > ceph.criticalThreshold);
  assert.ok(report.rootCauseDiagnosis.includes('Ceph (Seph)'));
  assert.ok(report.recommendedAction.length > 10);
});

test('filterQueryLogs accurately filters by search query, group, status, and date range', () => {
  const logs: CloudQueryLog[] = [
    {
      id: 'log-1',
      timestamp: '2026-10-20T01:00:00.000Z',
      epochMs: new Date('2026-10-20T01:00:00.000Z').getTime(),
      serviceId: 'srv-wazuh',
      serviceName: 'Wazuh SIEM',
      group: 'Безпека (SIEM)',
      queryType: 'POLL_METRICS',
      queryEndpoint: 'https://wazuh.internal.noc:55000',
      status: 'nominal',
      latencyMs: 18,
      summary: 'Отримано 240 подій/с',
      metricsSnapshot: '240 подій/с | 12 алертів',
    },
    {
      id: 'log-2',
      timestamp: '2026-10-20T02:30:00.000Z',
      epochMs: new Date('2026-10-20T02:30:00.000Z').getTime(),
      serviceId: 'srv-redis',
      serviceName: 'Redis In-Memory Cluster',
      group: 'Черги та Кеш',
      queryType: 'CRASH_DUMP_30S',
      queryEndpoint: 'redis://redis-cluster.internal.noc:6379',
      status: 'critical',
      latencyMs: 310,
      summary: 'Аварійний дамп останніх 30с: OOM Eviction',
      metricsSnapshot: '189 тис. ops/s | 98% RAM',
    },
  ];

  // Search filter
  const bySearch = filterQueryLogs(logs, { search: 'OOM Eviction' });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, 'log-2');

  // Group filter
  const byGroup = filterQueryLogs(logs, { group: 'Безпека (SIEM)' });
  assert.equal(byGroup.length, 1);
  assert.equal(byGroup[0].id, 'log-1');

  // Date range filter
  const byDate = filterQueryLogs(logs, {
    dateFrom: '2026-10-20T02:00:00.000Z',
    dateTo: '2026-10-20T03:00:00.000Z',
  });
  assert.equal(byDate.length, 1);
  assert.equal(byDate[0].id, 'log-2');
});

test('createBackupSnapshot and CSV export preserve full state for recovery and reporting', () => {
  const baseEpoch = 1760000000000;
  const services = createInitialServices(baseEpoch);
  services[0].status = 'critical';

  const snapshot = createBackupSnapshot(
    services,
    [],
    [],
    [],
    'Перед аварійним тестом',
    false,
    baseEpoch
  );

  assert.equal(snapshot.servicesCount, 5);
  assert.ok(snapshot.forensicSummary.includes('Wazuh SIEM'));
  assert.equal(snapshot.payload.services.length, 5);

  const csv = formatMetricsToCSV(services, [], []);
  assert.ok(csv.includes('Wazuh SIEM'));
  assert.ok(csv.includes('Ceph (Seph) Object Storage'));
  assert.ok(csv.includes('RabbitMQ Message Broker'));
});

test('formatDeleteDashboardPrompt produces simplified confirmation question', () => {
  assert.equal(
    formatDeleteDashboardPrompt('Wazuh SIEM'),
    'Чи хочете ви видалити Wazuh SIEM дашборд?'
  );
  assert.equal(
    formatDeleteDashboardPrompt('Zabbix дашборд'),
    'Чи хочете ви видалити Zabbix дашборд?'
  );
});

test('createDefaultServiceFormState returns clean textboxes and valid standardized defaults', () => {
  const clean = createDefaultServiceFormState('Безпека (SIEM)');
  assert.equal(clean.activePresetLabel, null);
  assert.equal(clean.name, '');
  assert.equal(clean.endpointUrl, '');
  assert.equal(clean.customGroup, '');
  assert.equal(clean.group, 'Безпека (SIEM)');
  assert.equal(clean.primaryMetricLabel, 'Завантаження CPU');
  assert.equal(clean.primaryMetricUnit, '%');
  assert.equal(clean.warningThreshold, 75);
  assert.equal(clean.criticalThreshold, 90);

  assert.ok(STANDARD_MONITORING_GROUPS.length >= 9);
  assert.ok(STANDARD_ENDPOINT_TEMPLATES.length >= 10);
  assert.ok(STANDARD_PRIMARY_METRICS.length >= 12);
  assert.ok(STANDARD_METRIC_UNITS.length >= 12);
  assert.ok(STANDARD_SECONDARY_METRICS.length >= 10);
  assert.ok(STANDARD_THRESHOLD_PRESETS.length >= 12);
});

test('createDefaultServiceTemplates, upsertServiceTemplate, and removeServiceTemplate support full template CRUD', async () => {
  const {
    createDefaultServiceTemplates,
    upsertServiceTemplate,
    removeServiceTemplate,
  } = await import('./monitoringEngine.ts');

  const initial = createDefaultServiceTemplates();
  assert.equal(initial.length, 6);
  assert.equal(initial[0].label, 'Wazuh SIEM');

  // Edit existing standard template
  const editedWazuh = {
    ...initial[0],
    label: 'Wazuh SIEM Prod Cluster',
    warn: 420,
    crit: 550,
  };
  const afterEdit = upsertServiceTemplate(initial, editedWazuh);
  assert.equal(afterEdit.length, 6);
  assert.equal(afterEdit[0].label, 'Wazuh SIEM Prod Cluster');
  assert.equal(afterEdit[0].warn, 420);

  // Create new custom template
  const newTemplate = {
    ...initial[0],
    id: 'tpl-postgres-1',
    label: 'PostgreSQL HA Cluster',
    group: 'Бази даних (SQL / NoSQL)',
    endpoint: 'https://postgres.internal.noc:9187/metrics',
  };
  const afterCreate = upsertServiceTemplate(afterEdit, newTemplate);
  assert.equal(afterCreate.length, 7);
  assert.equal(afterCreate[6].label, 'PostgreSQL HA Cluster');

  // Delete a template
  const afterDelete = removeServiceTemplate(afterCreate, 'tpl-zabbix');
  assert.equal(afterDelete.length, 6);
  assert.ok(!afterDelete.some((t) => t.id === 'tpl-zabbix'));
});

