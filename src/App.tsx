import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  DatabaseBackup,
  Download,
  FileText,
  Grid,
  LayoutGrid,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import {
  appendToRingBuffer,
  captureCrashBlackbox,
  createBackupSnapshot,
  createDefaultServiceTemplates,
  formatDeleteDashboardPrompt,
  generateNextTelemetrySample,
  removeServiceTemplate,
  upsertServiceTemplate,
  type CloudBackupSnapshot,
  type CloudQueryLog,
  type CrashBlackboxReport,
  type CustomDashboardWidget,
  type NotificationConfig,
  type NotificationRecord,
  type ServiceFeed,
  type ServicePresetTemplate,
} from './utils/monitoringEngine';
import { downloadCsvReport, downloadPdfReport } from './utils/reportExporter';
import { CctvCameraTile } from './components/CctvCameraTile';
import { AddServiceModal } from './components/AddServiceModal';
import { Blackbox30sView } from './components/Blackbox30sView';
import { CustomDashboardView } from './components/CustomDashboardView';
import { CloudLogsAndBackupsView } from './components/CloudLogsAndBackupsView';
import { NotificationsAndExportView } from './components/NotificationsAndExportView';
import { ExpandedCameraModal } from './components/ExpandedCameraModal';
import {
  ConfirmDeleteModal,
  type DeleteConfirmationRequest,
} from './components/ConfirmDeleteModal';

type ActiveTab = 'wall' | 'builder' | 'blackbox' | 'logs' | 'notifications';
type CctvLayoutMode = '2x2' | '3x2' | '3x3' | '1x1';

const CLEAN_NOTIFICATION_CONFIG: NotificationConfig = {
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  slackEnabled: false,
  slackWebhookUrl: '',
  slackChannel: '',
  notifyOnWarning: true,
  notifyOnCritical: true,
  notifyWith30sBlackbox: true,
};

export default function App() {
  const initialNow = useMemo(() => Date.now(), []);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sentinelwall_theme');
      if (saved === 'light') return false;
      if (saved === 'dark') return true;
    } catch {
      // ignore storage errors
    }
    return true;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('wall');
  const [gridLayout, setGridLayout] = useState<CctvLayoutMode>('3x2');

  // Clean production state: no demo dashboards, logs, or tokens preloaded
  const [services, setServices] = useState<ServiceFeed[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [wallSearch, setWallSearch] = useState<string>('');
  const [isStreamRunning, setIsStreamRunning] = useState<boolean>(true);
  const [pageAutoRefreshSec, setPageAutoRefreshSec] = useState<number>(0);
  const [pageRefreshCountdown, setPageRefreshCountdown] = useState<number>(0);

  const [logs, setLogs] = useState<CloudQueryLog[]>([]);
  const [blackboxReports, setBlackboxReports] = useState<CrashBlackboxReport[]>([]);
  const [customWidgets, setCustomWidgets] = useState<CustomDashboardWidget[]>([]);
  const [backups, setBackups] = useState<CloudBackupSnapshot[]>([]);

  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(
    CLEAN_NOTIFICATION_CONFIG
  );
  const [notificationHistory, setNotificationHistory] = useState<NotificationRecord[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServicePresetTemplate[]>(() =>
    createDefaultServiceTemplates()
  );

  const [cloudLastSynced, setCloudLastSynced] = useState<string>(
    new Date(initialNow).toISOString()
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [blackboxTargetServiceId, setBlackboxTargetServiceId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [deleteConfirmRequest, setDeleteConfirmRequest] =
    useState<DeleteConfirmationRequest | null>(null);

  const tickCounterRef = useRef<number>(0);

  // Sync dark class on html element & save preference
  useEffect(() => {
    const rootEl = document.documentElement;
    if (isDark) {
      rootEl.classList.add('dark');
    } else {
      rootEl.classList.remove('dark');
    }
    try {
      localStorage.setItem('sentinelwall_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  // Load persisted production state from backend if previously saved by team
  useEffect(() => {
    fetch('/api/cloud/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const store = payload?.data;
        if (!store) return;
        if (Array.isArray(store.services) && store.services.length > 0) {
          setServices(store.services);
        }
        if (Array.isArray(store.customWidgets) && store.customWidgets.length > 0) {
          setCustomWidgets(store.customWidgets);
        }
        if (Array.isArray(store.logs) && store.logs.length > 0) {
          setLogs(store.logs);
        }
        if (Array.isArray(store.backups) && store.backups.length > 0) {
          setBackups(store.backups);
        }
        if (Array.isArray(store.blackboxReports) && store.blackboxReports.length > 0) {
          setBlackboxReports(store.blackboxReports);
        }
        if (Array.isArray(store.notificationHistory) && store.notificationHistory.length > 0) {
          setNotificationHistory(store.notificationHistory);
        }
        if (store.notificationConfig && typeof store.notificationConfig === 'object') {
          setNotificationConfig((prev) => ({ ...prev, ...store.notificationConfig }));
        }
        if (Array.isArray(store.serviceTemplates)) {
          setServiceTemplates(store.serviceTemplates);
        }
        if (payload.updatedAt) {
          setCloudLastSynced(payload.updatedAt);
        }
      })
      .catch(() => {
        // Offline resilient fallback
      });
  }, []);

  // Cloud Sync helper
  const syncToCloud = async (
    nextServices: ServiceFeed[],
    nextLogs: CloudQueryLog[],
    nextBackups: CloudBackupSnapshot[],
    nextBlackboxes: CrashBlackboxReport[],
    nextWidgets: CustomDashboardWidget[],
    nextNotifications: NotificationRecord[],
    nextConfig: NotificationConfig = notificationConfig,
    nextTemplates: ServicePresetTemplate[] = serviceTemplates
  ) => {
    try {
      const res = await fetch('/api/cloud/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: nextServices,
          logs: nextLogs.slice(0, 200),
          backups: nextBackups.slice(0, 25),
          blackboxReports: nextBlackboxes.slice(0, 25),
          customWidgets: nextWidgets,
          notificationHistory: nextNotifications.slice(0, 50),
          notificationConfig: nextConfig,
          serviceTemplates: nextTemplates,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCloudLastSynced(data.updatedAt || new Date().toISOString());
      }
    } catch {
      // Keep working seamlessly if offline
    }
  };

  // Real-time 1-second telemetry ring buffer loop
  useEffect(() => {
    if (!isStreamRunning || services.length === 0) return;

    const isHeadless =
      typeof navigator !== 'undefined' &&
      (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    const intervalMs = isHeadless ? 2500 : 1000;

    const timer = setInterval(() => {
      tickCounterRef.current += 1;
      const tick = tickCounterRef.current;
      const nowMs = Date.now();

      setServices((prevServices) => {
        if (prevServices.length === 0) return prevServices;
        const newLogsBatch: CloudQueryLog[] = [];

        const updatedServices = prevServices.map((srv) => {
          const shouldPoll = tick % Math.max(1, srv.refreshIntervalSec) === 0;
          if (!shouldPoll) {
            return srv;
          }

          const nextSample = generateNextTelemetrySample(
            srv,
            nowMs,
            srv.status === 'critical' ? 'crash' : undefined
          );
          const nextBuffer = appendToRingBuffer(srv.ringBuffer30s, nextSample, 30);

          if (tick % (srv.refreshIntervalSec * 3) === 0) {
            newLogsBatch.push({
              id: `log-${nowMs}-${srv.id}-${tick}`,
              timestamp: new Date(nowMs).toISOString(),
              epochMs: nowMs,
              serviceId: srv.id,
              serviceName: srv.name,
              group: srv.group,
              queryType: 'POLL_METRICS',
              queryEndpoint: srv.endpointUrl,
              status: nextSample.status,
              latencyMs: nextSample.latencyMs,
              summary: `Отримано телеметрію (${srv.refreshIntervalSec}с цикл)`,
              metricsSnapshot: `${nextSample.primaryValue} ${srv.primaryMetricUnit} · ${nextSample.secondaryValue} ${srv.secondaryMetricUnit}`,
            });
          }

          return {
            ...srv,
            status: nextSample.status,
            lastUpdated: new Date(nowMs).toISOString(),
            ringBuffer30s: nextBuffer,
          };
        });

        if (newLogsBatch.length > 0) {
          setLogs((prevLogs) => [...newLogsBatch, ...prevLogs].slice(0, 300));
        }

        return updatedServices;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isStreamRunning, services.length]);

  // Page Auto-Refresh Timer (if enabled by user)
  useEffect(() => {
    if (pageAutoRefreshSec <= 0) {
      setPageRefreshCountdown(0);
      return;
    }
    setPageRefreshCountdown(pageAutoRefreshSec);
    const interval = setInterval(() => {
      setPageRefreshCountdown((prev) => {
        if (prev <= 1) {
          const nowMs = Date.now();
          setServices((curr) =>
            curr.map((srv) => {
              const sample = generateNextTelemetrySample(srv, nowMs);
              return {
                ...srv,
                lastUpdated: new Date(nowMs).toISOString(),
                ringBuffer30s: appendToRingBuffer(srv.ringBuffer30s, sample, 30),
              };
            })
          );
          return pageAutoRefreshSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pageAutoRefreshSec]);

  const availableGroups = useMemo(() => {
    const base = ['Безпека (SIEM)', 'Інфраструктура', 'Сховище даних', 'Черги та Кеш'];
    const dynamic = services.map((s) => s.group);
    return Array.from(new Set([...base, ...dynamic]));
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = wallSearch.trim().toLowerCase();
    return services.filter((srv) => {
      if (selectedGroup !== 'ALL' && srv.group !== selectedGroup) {
        return false;
      }
      if (q) {
        const hay = `${srv.cameraCode} ${srv.name} ${srv.group} ${srv.endpointUrl} ${srv.serviceType}`.toLowerCase();
        const normalizedHay = hay.includes('ceph') ? `${hay} seph` : hay;
        if (!normalizedHay.includes(q)) return false;
      }
      return true;
    });
  }, [services, selectedGroup, wallSearch]);

  // Dispatch notification to backend /api/notify/send
  const dispatchNotification = async (
    channelType: 'telegram' | 'slack',
    message: string,
    serviceName: string = 'Система SentinelWall',
    severity: 'nominal' | 'warning' | 'critical' = 'critical'
  ) => {
    try {
      const response = await fetch('/api/notify/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelType,
          message,
          serviceName,
          severity,
          telegramBotToken: notificationConfig.telegramBotToken,
          telegramChatId: notificationConfig.telegramChatId,
          slackWebhookUrl: notificationConfig.slackWebhookUrl,
          slackChannel: notificationConfig.slackChannel,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.record) {
          setNotificationHistory((prev) => [data.record, ...prev].slice(0, 100));
          setStatusBanner(
            `Сповіщення відправлено (${channelType.toUpperCase()}): ${serviceName}`
          );
          setTimeout(() => setStatusBanner(null), 4000);
          return;
        }
      }
    } catch {
      // Fallback local record
    }

    const fallbackRecord: NotificationRecord = {
      id: `ntf-${Date.now()}`,
      timestamp: new Date().toISOString(),
      channelType,
      serviceName,
      severity,
      message,
      remoteDelivered: false,
      deliveryNote: `Зафіксовано у хмарному журналі (${channelType.toUpperCase()})`,
    };
    setNotificationHistory((prev) => [fallbackRecord, ...prev].slice(0, 100));
    setStatusBanner(`Сповіщення зафіксовано (${channelType.toUpperCase()}): ${serviceName}`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  // Simulate a system failure from Settings & immediately capture the last 20-30s of metrics
  const handleSimulateCrash = (targetService: ServiceFeed) => {
    const nowMs = Date.now();
    const crashSample = generateNextTelemetrySample(targetService, nowMs, 'crash');
    const updatedBuffer = appendToRingBuffer(targetService.ringBuffer30s, crashSample, 30);

    const crashedService: ServiceFeed = {
      ...targetService,
      status: 'critical',
      nodesOnline: Math.max(1, targetService.nodesTotal - 2),
      lastUpdated: new Date(nowMs).toISOString(),
      ringBuffer30s: updatedBuffer,
    };

    const blackboxReport = captureCrashBlackbox(
      crashedService,
      `Аварійний збій ${crashedService.name}: перевищено критичний поріг (${crashSample.primaryValue} > ${crashedService.criticalThreshold} ${crashedService.primaryMetricUnit})`,
      nowMs
    );

    const crashLog: CloudQueryLog = {
      id: `log-crash-${nowMs}-${crashedService.id}`,
      timestamp: new Date(nowMs).toISOString(),
      epochMs: nowMs,
      serviceId: crashedService.id,
      serviceName: crashedService.name,
      group: crashedService.group,
      queryType: 'CRASH_DUMP_30S',
      queryEndpoint: crashedService.endpointUrl,
      status: 'critical',
      latencyMs: crashSample.latencyMs,
      summary: `ЗБІЙ! Автоматично збережено метрики за останні ${blackboxReport.windowDurationSec} секунд (Чорна скринька)`,
      metricsSnapshot: `Пік: ${blackboxReport.peakPrimaryValue} ${crashedService.primaryMetricUnit} · Затримка: ${blackboxReport.peakLatencyMs} мс`,
    };

    const nextServices = services.map((s) =>
      s.id === crashedService.id ? crashedService : s
    );
    const nextLogs = [crashLog, ...logs].slice(0, 300);
    const nextBlackboxes = [blackboxReport, ...blackboxReports].slice(0, 30);

    const autoBackup = createBackupSnapshot(
      nextServices,
      nextLogs,
      nextBlackboxes,
      customWidgets,
      `Авто-бекап при збої: ${crashedService.name}`,
      true,
      nowMs
    );
    const nextBackups = [autoBackup, ...backups].slice(0, 30);

    setServices(nextServices);
    setLogs(nextLogs);
    setBlackboxReports(nextBlackboxes);
    setBackups(nextBackups);
    setBlackboxTargetServiceId(crashedService.id);

    setStatusBanner(
      `ЗБІЙ на ${crashedService.cameraCode} (${crashedService.name})! Збережено дамп метрик за останні ${blackboxReport.windowDurationSec} секунд та створено хмарний бекап.`
    );

    if (notificationConfig.notifyOnCritical && notificationConfig.telegramEnabled) {
      dispatchNotification(
        'telegram',
        `🚨 ЗБІЙ ${crashedService.cameraCode} (${crashedService.name}): Пік ${blackboxReport.peakPrimaryValue} ${crashedService.primaryMetricUnit}, затримка ${blackboxReport.peakLatencyMs} мс. Дамп останніх ${blackboxReport.windowDurationSec}с збережено у хмару.`,
        crashedService.name,
        'critical'
      );
    }

    syncToCloud(
      nextServices,
      nextLogs,
      nextBackups,
      nextBlackboxes,
      customWidgets,
      notificationHistory
    );
  };

  // Recover a failed service back to nominal operation
  const handleRecoverService = (targetService: ServiceFeed) => {
    const nowMs = Date.now();
    const recoverSample = generateNextTelemetrySample(targetService, nowMs, 'recover');
    const updatedBuffer = appendToRingBuffer(targetService.ringBuffer30s, recoverSample, 30);

    const recoveredService: ServiceFeed = {
      ...targetService,
      status: 'nominal',
      nodesOnline: targetService.nodesTotal,
      lastUpdated: new Date(nowMs).toISOString(),
      ringBuffer30s: updatedBuffer,
    };

    const recoverLog: CloudQueryLog = {
      id: `log-recover-${nowMs}-${targetService.id}`,
      timestamp: new Date(nowMs).toISOString(),
      epochMs: nowMs,
      serviceId: targetService.id,
      serviceName: targetService.name,
      group: targetService.group,
      queryType: 'RESTORE_STATE',
      queryEndpoint: targetService.endpointUrl,
      status: 'nominal',
      latencyMs: recoverSample.latencyMs,
      summary: `Відновлено штатну роботу сервісу ${targetService.name}`,
      metricsSnapshot: `${recoverSample.primaryValue} ${targetService.primaryMetricUnit} · OK`,
    };

    const nextServices = services.map((s) =>
      s.id === recoveredService.id ? recoveredService : s
    );
    const nextLogs = [recoverLog, ...logs].slice(0, 300);

    setServices(nextServices);
    setLogs(nextLogs);
    setStatusBanner(`Сервіс ${targetService.name} переведено у штатний режим роботи.`);
    setTimeout(() => setStatusBanner(null), 4000);
    syncToCloud(
      nextServices,
      nextLogs,
      backups,
      blackboxReports,
      customWidgets,
      notificationHistory
    );
  };

  const handleUpdateService = (id: string, patch: Partial<ServiceFeed>) => {
    setServices((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...patch } : s));
      syncToCloud(
        next,
        logs,
        backups,
        blackboxReports,
        customWidgets,
        notificationHistory
      );
      return next;
    });
  };

  const handleAddService = (newService: ServiceFeed) => {
    const nowMs = Date.now();
    const addLog: CloudQueryLog = {
      id: `log-add-${nowMs}`,
      timestamp: new Date(nowMs).toISOString(),
      epochMs: nowMs,
      serviceId: newService.id,
      serviceName: newService.name,
      group: newService.group,
      queryType: 'CONFIG_CHANGE',
      queryEndpoint: newService.endpointUrl,
      status: 'nominal',
      latencyMs: 12,
      summary: `Підключено камеру спостереження ${newService.cameraCode} (${newService.name}) у групу «${newService.group}»`,
      metricsSnapshot: `Оновлення: ${newService.refreshIntervalSec}с · Chart.js: ${newService.chartType}`,
    };

    const nextServices = [...services, newService];
    const nextLogs = [addLog, ...logs].slice(0, 300);

    setServices(nextServices);
    setLogs(nextLogs);
    if (!blackboxTargetServiceId) {
      setBlackboxTargetServiceId(newService.id);
    }
    setStatusBanner(
      `Підключено сервіс «${newService.name}» (${newService.cameraCode}) на стіну моніторингу.`
    );
    setTimeout(() => setStatusBanner(null), 4000);
    syncToCloud(
      nextServices,
      nextLogs,
      backups,
      blackboxReports,
      customWidgets,
      notificationHistory
    );
  };

  const executeDeleteService = (id: string) => {
    const target = services.find((s) => s.id === id);
    const nextServices = services.filter((s) => s.id !== id);
    const nextWidgets = customWidgets.filter((w) => !w.serviceIds.includes(id));
    setServices(nextServices);
    setCustomWidgets(nextWidgets);
    if (target) {
      setStatusBanner(
        `Дашборд «${target.name}» (${target.cameraCode}) видалено зі стіни моніторингу.`
      );
      setTimeout(() => setStatusBanner(null), 4000);
    }
    syncToCloud(
      nextServices,
      logs,
      backups,
      blackboxReports,
      nextWidgets,
      notificationHistory
    );
  };

  const requestDeleteService = (id: string) => {
    const target = services.find((s) => s.id === id);
    if (!target) return;
    setDeleteConfirmRequest({
      type: 'service',
      targetId: id,
      question: formatDeleteDashboardPrompt(target.name),
    });
  };

  const requestDeleteWidget = (id: string) => {
    const target = customWidgets.find((w) => w.id === id);
    setDeleteConfirmRequest({
      type: 'widget',
      targetId: id,
      question: formatDeleteDashboardPrompt(target?.title || id),
    });
  };

  const requestResetAllData = () => {
    setDeleteConfirmRequest({
      type: 'reset_all',
      question: 'Чи хочете ви видалити всі підключені дашборди?',
    });
  };

  const handleConfirmDeleteAction = () => {
    if (!deleteConfirmRequest) return;
    const req = deleteConfirmRequest;
    setDeleteConfirmRequest(null);

    if (req.type === 'service' && req.targetId) {
      executeDeleteService(req.targetId);
    } else if (req.type === 'widget' && req.targetId) {
      const nextWidgets = customWidgets.filter((w) => w.id !== req.targetId);
      setCustomWidgets(nextWidgets);
      setStatusBanner('Графік видалено з конструктора дашбордів.');
      setTimeout(() => setStatusBanner(null), 3500);
      syncToCloud(
        services,
        logs,
        backups,
        blackboxReports,
        nextWidgets,
        notificationHistory
      );
    } else if (req.type === 'reset_all') {
      setServices([]);
      setCustomWidgets([]);
      setLogs([]);
      setBlackboxReports([]);
      setBackups([]);
      setNotificationHistory([]);
      setSelectedGroup('ALL');
      setWallSearch('');
      setStatusBanner('Усі дані середовища очищено.');
      setTimeout(() => setStatusBanner(null), 4000);
      syncToCloud([], [], [], [], [], [], CLEAN_NOTIFICATION_CONFIG, serviceTemplates);
    }
  };

  const handleSaveTemplate = (template: ServicePresetTemplate) => {
    const isExisting = serviceTemplates.some((t) => t.id === template.id);
    const nextTemplates = upsertServiceTemplate(serviceTemplates, template);
    setServiceTemplates(nextTemplates);
    setStatusBanner(
      isExisting
        ? `Шаблон «${template.label}» успішно оновлено.`
        : `Новий шаблон «${template.label}» додано до списку швидкого підключення.`
    );
    setTimeout(() => setStatusBanner(null), 4000);
    syncToCloud(
      services,
      logs,
      backups,
      blackboxReports,
      customWidgets,
      notificationHistory,
      notificationConfig,
      nextTemplates
    );
  };

  const handleDeleteTemplate = (templateId: string) => {
    const target = serviceTemplates.find((t) => t.id === templateId);
    const nextTemplates = removeServiceTemplate(serviceTemplates, templateId);
    setServiceTemplates(nextTemplates);
    if (target) {
      setStatusBanner(`Шаблон «${target.label}» видалено зі списку.`);
      setTimeout(() => setStatusBanner(null), 4000);
    }
    syncToCloud(
      services,
      logs,
      backups,
      blackboxReports,
      customWidgets,
      notificationHistory,
      notificationConfig,
      nextTemplates
    );
  };

  const handleResetDefaultTemplates = () => {
    const defaults = createDefaultServiceTemplates();
    setServiceTemplates(defaults);
    setStatusBanner('Відновлено стандартний набір шаблонів швидкого підключення.');
    setTimeout(() => setStatusBanner(null), 4000);
    syncToCloud(
      services,
      logs,
      backups,
      blackboxReports,
      customWidgets,
      notificationHistory,
      notificationConfig,
      defaults
    );
  };

  const handleCreateManualBackup = (label: string) => {
    const nowMs = Date.now();
    const snapshot = createBackupSnapshot(
      services,
      logs,
      blackboxReports,
      customWidgets,
      label || `Ручний бекап системи #${backups.length + 1}`,
      false,
      nowMs
    );

    const backupLog: CloudQueryLog = {
      id: `log-bkp-${nowMs}`,
      timestamp: new Date(nowMs).toISOString(),
      epochMs: nowMs,
      serviceId: 'system',
      serviceName: 'Хмарне сховище SentinelCloud',
      group: 'Інфраструктура',
      queryType: 'BACKUP_SNAPSHOT',
      queryEndpoint: '/api/cloud/backups',
      status: 'nominal',
      latencyMs: 22,
      summary: `Створено резервну копію логів та стану: «${snapshot.label}»`,
      metricsSnapshot: `${snapshot.servicesCount} камер · ${snapshot.logsCount} записів`,
    };

    const nextBackups = [snapshot, ...backups].slice(0, 30);
    const nextLogs = [backupLog, ...logs].slice(0, 300);
    setBackups(nextBackups);
    setLogs(nextLogs);

    fetch('/api/cloud/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    }).catch(() => {});

    setStatusBanner(`Хмарний бекап «${snapshot.label}» успішно збережено.`);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleRestoreFromBackup = (snapshot: CloudBackupSnapshot) => {
    const nowMs = Date.now();
    const restoredServices = snapshot.payload.services.map((s) => ({
      ...s,
      lastUpdated: new Date(nowMs).toISOString(),
    }));
    const restoredWidgets = snapshot.payload.customWidgets || [];

    const restoreLog: CloudQueryLog = {
      id: `log-restore-bkp-${nowMs}`,
      timestamp: new Date(nowMs).toISOString(),
      epochMs: nowMs,
      serviceId: 'system',
      serviceName: 'Система відновлення SentinelCloud',
      group: 'Інфраструктура',
      queryType: 'RESTORE_STATE',
      queryEndpoint: `/api/cloud/backups/${snapshot.id}`,
      status: 'nominal',
      latencyMs: 19,
      summary: `Відновлено конфігурацію та історію логів із бекапу «${snapshot.label}»`,
      metricsSnapshot: `Відновлено ${restoredServices.length} камер`,
    };

    const nextLogs = [restoreLog, ...(snapshot.payload.logs || [])].slice(0, 300);
    setServices(restoredServices);
    setCustomWidgets(restoredWidgets);
    setLogs(nextLogs);
    setStatusBanner(`Дані та стан дашбордів відновлено з бекапу «${snapshot.label}».`);
    setTimeout(() => setStatusBanner(null), 4000);
    syncToCloud(
      restoredServices,
      nextLogs,
      backups,
      blackboxReports,
      restoredWidgets,
      notificationHistory
    );
  };

  const handleApplyGlobalRefreshRate = (sec: number) => {
    setServices((prev) => {
      const next = prev.map((s) => ({ ...s, refreshIntervalSec: sec }));
      syncToCloud(
        next,
        logs,
        backups,
        blackboxReports,
        customWidgets,
        notificationHistory
      );
      return next;
    });
    setStatusBanner(`Період оновлення для всіх камер встановлено на ${sec} сек.`);
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const expandedService = useMemo(
    () => services.find((s) => s.id === expandedServiceId) || null,
    [services, expandedServiceId]
  );

  const criticalCount = services.filter((s) => s.status === 'critical').length;
  const warningCount = services.filter((s) => s.status === 'warning').length;
  const nominalCount = services.filter((s) => s.status === 'nominal').length;

  const gridColsClass =
    gridLayout === '1x1'
      ? 'grid-cols-1'
      : gridLayout === '2x2'
      ? 'grid-cols-1 md:grid-cols-2'
      : gridLayout === '3x3'
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  return (
    <div
      className={`min-h-screen transition-colors ${
        isDark ? 'bg-[#0B0F17] text-slate-100' : 'bg-[#F8FAFC] text-slate-900'
      }`}
    >
      {/* STRICT 3-ZONE TOP BAR CONTRACT WITH REFINED SEGMENTED NAVIGATION */}
      <header
        className={`flex items-center justify-between gap-8 px-6 py-3.5 border-b ${
          isDark ? 'bg-[#0F172A] border-slate-800/90' : 'bg-white border-slate-200'
        }`}
      >
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#wall"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('wall');
          }}
          className={`text-lg font-bold tracking-tight font-display whitespace-nowrap shrink-0 ${
            isDark ? 'text-slate-100 hover:text-sky-300' : 'text-slate-900 hover:text-sky-600'
          } transition-colors`}
        >
          SentinelWall NOC
        </a>

        {/* Zone 2: 5 refined segmented navigation buttons */}
        <nav
          aria-label="Основна навігація"
          className={`hidden lg:flex items-center gap-1.5 p-1.5 rounded-xl border ${
            isDark
              ? 'bg-[#0B0F17]/90 border-slate-800'
              : 'bg-slate-100/90 border-slate-200/90'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('wall')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'wall'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Стіна камер ({services.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'builder'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Конструктор Chart.js</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('blackbox')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'blackbox'
                ? 'bg-red-600 text-white font-semibold shadow-sm'
                : criticalCount > 0
                ? 'bg-red-950/60 text-red-300 border border-red-500/40 font-semibold hover:bg-red-900/50'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              Чорна скринька 30с {criticalCount > 0 ? `(${criticalCount} ЗБІЙ)` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'logs'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <DatabaseBackup className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Журнал і Бекапи ({backups.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'notifications'
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Settings className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Налаштування та Сповіщення</span>
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 text-xs font-semibold bg-sky-500 text-slate-950 rounded-xl hover:bg-sky-400 shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Додати сервіс</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div
        className={`lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b text-xs font-medium ${
          isDark ? 'bg-[#0F172A] border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('wall')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'wall'
              ? 'bg-sky-500 text-slate-950 font-semibold'
              : isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Стіна камер ({services.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('builder')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'builder'
              ? 'bg-sky-500 text-slate-950 font-semibold'
              : isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Конструктор Chart.js</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('blackbox')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'blackbox'
              ? 'bg-red-600 text-white font-semibold'
              : 'text-red-500 dark:text-red-400 font-semibold hover:bg-slate-800/30'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Чорна скринька 30с</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'logs'
              ? 'bg-sky-500 text-slate-950 font-semibold'
              : isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          <DatabaseBackup className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Журнал і Бекапи</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            activeTab === 'notifications'
              ? 'bg-sky-500 text-slate-950 font-semibold'
              : isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Налаштування та Сповіщення</span>
        </button>
      </div>

      {/* Main Workspace Container */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Live Toast / Incident Banner */}
        {statusBanner && (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs font-medium flex items-center justify-between gap-4 ${
              isDark
                ? 'border-sky-500/50 bg-sky-950/40 text-sky-200'
                : 'border-sky-300 bg-sky-50 text-sky-900'
            }`}
          >
            <span>{statusBanner}</span>
            <div className="flex items-center gap-2 shrink-0">
              {criticalCount > 0 && activeTab !== 'blackbox' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('blackbox')}
                  className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors whitespace-nowrap"
                >
                  Переглянути метрики останніх 30с
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Закрити
              </button>
            </div>
          </div>
        )}

        {/* NOC Summary & Global Controls Strip */}
        <section
          aria-label="Панель керування моніторингом"
          className={`rounded-xl border px-4 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 ${
            isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Left: System Telemetry Summary */}
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-3 text-xs font-mono tabular-nums whitespace-nowrap">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Статус: </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {nominalCount} ОК
              </span>
              <span aria-hidden="true"> · </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {warningCount} УВАГА
              </span>
              <span aria-hidden="true"> · </span>
              <span className="font-bold text-red-600 dark:text-red-400">
                {criticalCount} ЗБІЙ
              </span>
            </div>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              |
            </span>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Буфер: </span>
              <span className="text-sky-600 dark:text-sky-400 font-semibold">30с (1 Гц)</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              |
            </span>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Хмара: </span>
              <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>
                {new Date(cloudLastSynced).toLocaleTimeString('uk-UA')}
              </span>
            </div>
          </div>

          {/* Right: Stream Controls, Auto-Refresh & Export PDF/CSV */}
          <div className="flex flex-wrap xl:flex-nowrap items-center gap-2">
            {/* Pause / Resume Live Stream */}
            <button
              type="button"
              onClick={() => setIsStreamRunning((prev) => !prev)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                isStreamRunning
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
              }`}
            >
              {isStreamRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Потік Live</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Пауза</span>
                </>
              )}
            </button>

            {/* Global Refresh Period Selector */}
            <div className="flex items-center gap-1 text-xs font-mono shrink-0">
              <label htmlFor="global-refresh-select" className="text-slate-400 sr-only">
                Глобальний період оновлення
              </label>
              <RefreshCw
                className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400"
                aria-hidden="true"
              />
              <select
                id="global-refresh-select"
                aria-label="Глобальний період оновлення всіх камер"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleApplyGlobalRefreshRate(Number(e.target.value));
                  }
                }}
                className={`px-2 py-1.5 rounded-lg border text-xs font-mono ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="" disabled>
                  Період всіх камер...
                </option>
                <option value="1">Усі камери: 1с</option>
                <option value="2">Усі камери: 2с</option>
                <option value="3">Усі камери: 3с</option>
                <option value="5">Усі камери: 5с</option>
                <option value="10">Усі камери: 10с</option>
                <option value="30">Усі камери: 30с</option>
              </select>
            </div>

            {/* Auto-Refresh Page Cycle */}
            <div className="flex items-center gap-1 text-xs font-mono shrink-0">
              <label htmlFor="page-cycle-select" className="sr-only">
                Автооновлення сторінки
              </label>
              <select
                id="page-cycle-select"
                aria-label="Автооновлення сторінки"
                value={pageAutoRefreshSec}
                onChange={(e) => setPageAutoRefreshSec(Number(e.target.value))}
                className={`px-2 py-1.5 rounded-lg border text-xs font-mono ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-200'
                    : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value={0}>Авто-цикл: Вимк</option>
                <option value={15}>Авто-цикл: 15с</option>
                <option value={30}>Авто-цикл: 30с</option>
                <option value={60}>Авто-цикл: 60с</option>
              </select>
              {pageAutoRefreshSec > 0 && (
                <span className="px-1.5 py-1 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300 font-semibold">
                  {pageRefreshCountdown}с
                </span>
              )}
            </div>

            {/* Instant Export CSV & PDF */}
            <button
              type="button"
              onClick={() => downloadCsvReport(services, logs, blackboxReports)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => downloadPdfReport(services, logs, blackboxReports)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </section>

        {/* VIEW 1: CCTV SURVEILLANCE WALL */}
        {activeTab === 'wall' && (
          <section className="space-y-4" aria-label="Стіна камер спостереження за сервісами">
            {/* Group Filter Tabs + Search + Grid Matrix Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              {/* Group Segmented Filter Buttons */}
              <div
                role="tablist"
                aria-label="Фільтр сервісів за групами"
                className={`flex items-center gap-1 p-1 rounded-xl border overflow-x-auto ${
                  isDark ? 'bg-[#111827] border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedGroup === 'ALL'}
                  onClick={() => setSelectedGroup('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedGroup === 'ALL'
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : isDark
                      ? 'text-slate-300 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Усі камери ({services.length})
                </button>
                {availableGroups.map((grp) => {
                  const count = services.filter((s) => s.group === grp).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={grp}
                      type="button"
                      role="tab"
                      aria-selected={selectedGroup === grp}
                      onClick={() => setSelectedGroup(grp)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        selectedGroup === grp
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : isDark
                          ? 'text-slate-300 hover:text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {grp} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Search & CCTV Matrix Layout Selector */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <label htmlFor="wall-search-input" className="sr-only">
                    Пошук сервісу або камери
                  </label>
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3 top-2"
                    aria-hidden="true"
                  />
                  <input
                    id="wall-search-input"
                    type="text"
                    value={wallSearch}
                    onChange={(e) => setWallSearch(e.target.value)}
                    placeholder="Пошук: Wazuh, Zabbix, Seph, Redis..."
                    className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-[#111827] border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                {/* CCTV Grid Layout Switcher */}
                <div
                  className={`flex items-center gap-1 p-1 rounded-lg border ${
                    isDark ? 'bg-[#111827] border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}
                >
                  <Grid className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" aria-hidden="true" />
                  {(['2x2', '3x2', '3x3', '1x1'] as const).map((layout) => (
                    <button
                      key={layout}
                      type="button"
                      onClick={() => setGridLayout(layout)}
                      className={`px-2 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                        gridLayout === layout
                          ? 'bg-sky-500 text-slate-950 font-semibold'
                          : isDark
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {layout}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CCTV Camera Matrix Grid */}
            {services.length === 0 ? (
              <div
                className={`rounded-xl border p-12 text-center ${
                  isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <LayoutGrid className="w-8 h-8 text-sky-500 dark:text-sky-400 mx-auto mb-3" />
                <h2 className="text-lg font-bold">
                  Стіна моніторингу готова до підключення робочих сервісів
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Додайте ваші робочі сервіси (Wazuh SIEM, Zabbix, Ceph/Seph, Redis, RabbitMQ або власний API-ендпоінт) для безперервного спостереження за метриками та 30-секундного буфера Чорної скриньки.
                </p>
                <div className="mt-4 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Підключити перший сервіс</span>
                  </button>
                </div>
              </div>
            ) : filteredServices.length === 0 ? (
              <div
                className={`rounded-xl border p-12 text-center ${
                  isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  За запитом «{wallSearch}» у групі «{selectedGroup}» камер не знайдено.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setWallSearch('');
                    setSelectedGroup('ALL');
                  }}
                  className="mt-3 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400"
                >
                  Показати всі камери
                </button>
              </div>
            ) : (
              <div className={`grid ${gridColsClass} gap-4`}>
                {filteredServices.map((srv) => (
                  <CctvCameraTile
                    key={srv.id}
                    service={srv}
                    isDark={isDark}
                    compactMode={gridLayout === '3x3'}
                    onUpdateService={handleUpdateService}
                    onRecoverService={handleRecoverService}
                    onOpenBlackbox30s={(target) => {
                      setBlackboxTargetServiceId(target.id);
                      setActiveTab('blackbox');
                    }}
                    onExpandCamera={(target) => setExpandedServiceId(target.id)}
                    onDeleteService={requestDeleteService}
                  />
                ))}
              </div>
            )}

            {/* Quick Emergency 30s Blackbox Strip at Bottom of Wall */}
            <div
              className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-sky-500 dark:text-sky-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold">
                    Безперервний запис метрик за останні 20–30 секунд (Чорна скринька)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    У разі збою будь-якого сервісу система миттєво фіксує останні 30 секунд телеметрії та створює точку відновлення у хмарі
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('blackbox')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                    isDark
                      ? 'border-sky-500/50 text-sky-300 hover:bg-sky-950/40'
                      : 'border-sky-300 text-sky-700 hover:bg-sky-50'
                  }`}
                >
                  Відкрити інспектор 30 секунд
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateManualBackup('Ручний знімок зі стіни камер')}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    isDark
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                  }`}
                >
                  Зробити бекап зараз
                </button>
              </div>
            </div>
          </section>
        )}

        {/* VIEW 2: CUSTOM DASHBOARD BUILDER (CHART.JS) */}
        {activeTab === 'builder' && (
          <CustomDashboardView
            services={services}
            widgets={customWidgets}
            isDark={isDark}
            onAddWidget={(w) => {
              const nextWidgets = [w, ...customWidgets];
              setCustomWidgets(nextWidgets);
              syncToCloud(
                services,
                logs,
                backups,
                blackboxReports,
                nextWidgets,
                notificationHistory
              );
            }}
            onUpdateWidget={(id, patch) => {
              const nextWidgets = customWidgets.map((w) =>
                w.id === id ? { ...w, ...patch } : w
              );
              setCustomWidgets(nextWidgets);
              syncToCloud(
                services,
                logs,
                backups,
                blackboxReports,
                nextWidgets,
                notificationHistory
              );
            }}
            onDeleteWidget={requestDeleteWidget}
            onOpenAddService={() => setIsAddModalOpen(true)}
          />
        )}

        {/* VIEW 3: 20-30s CRASH BLACKBOX FLIGHT RECORDER */}
        {activeTab === 'blackbox' && (
          <Blackbox30sView
            services={services}
            blackboxReports={blackboxReports}
            selectedServiceId={blackboxTargetServiceId}
            isDark={isDark}
            onSelectService={(id) => setBlackboxTargetServiceId(id)}
            onRecoverService={handleRecoverService}
            onDispatchAlert={(channel, msg, srvName) =>
              dispatchNotification(channel, msg, srvName, 'critical')
            }
            onExportCsv={() => downloadCsvReport(services, logs, blackboxReports)}
            onExportPdf={() => downloadPdfReport(services, logs, blackboxReports)}
            onOpenAddService={() => setIsAddModalOpen(true)}
          />
        )}

        {/* VIEW 4: CLOUD LOGS, SEARCH, DATE FILTERING & BACKUPS */}
        {activeTab === 'logs' && (
          <CloudLogsAndBackupsView
            logs={logs}
            backups={backups}
            availableGroups={availableGroups}
            cloudLastSynced={cloudLastSynced}
            isDark={isDark}
            onCreateBackup={handleCreateManualBackup}
            onRestoreBackup={handleRestoreFromBackup}
          />
        )}

        {/* VIEW 5: SETTINGS, TELEGRAM / SLACK NOTIFICATIONS & PDF / CSV EXPORT */}
        {activeTab === 'notifications' && (
          <NotificationsAndExportView
            services={services}
            templates={serviceTemplates}
            config={notificationConfig}
            history={notificationHistory}
            isDark={isDark}
            onSetTheme={(dark) => setIsDark(dark)}
            onUpdateConfig={(patch) => {
              const nextConfig = { ...notificationConfig, ...patch };
              setNotificationConfig(nextConfig);
              syncToCloud(
                services,
                logs,
                backups,
                blackboxReports,
                customWidgets,
                notificationHistory,
                nextConfig,
                serviceTemplates
              );
            }}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onResetDefaultTemplates={handleResetDefaultTemplates}
            onSimulateCrash={handleSimulateCrash}
            onRecoverService={handleRecoverService}
            onOpenAddService={() => setIsAddModalOpen(true)}
            onResetAllData={requestResetAllData}
            onSendTestNotification={async (channel, customText) => {
              await dispatchNotification(
                channel,
                customText || 'Тестовий сигнал SentinelWall NOC',
                'Тест шлюзу NOC',
                'nominal'
              );
            }}
            onExportCsv={() => downloadCsvReport(services, logs, blackboxReports)}
            onExportPdf={() => downloadPdfReport(services, logs, blackboxReports)}
          />
        )}
      </main>

      {/* Licensing & System Footer */}
      <footer
        className={`max-w-[1440px] mx-auto px-4 sm:px-6 py-5 mt-6 border-t text-xs flex flex-col sm:flex-row items-center justify-between gap-2 ${
          isDark
            ? 'border-slate-800/80 text-slate-400'
            : 'border-slate-200 text-slate-500'
        }`}
      >
        <div className="font-medium">
          SentinelWall NOC — Мультисервісна система оперативного відеоспостереження за метриками
        </div>
        <div className="font-mono text-slate-500 dark:text-slate-300">
          Omega Development 2026 All right reserved
        </div>
      </footer>

      {/* Modals */}
      <AddServiceModal
        isOpen={isAddModalOpen}
        isDark={isDark}
        existingCount={services.length}
        availableGroups={availableGroups}
        templates={serviceTemplates}
        onClose={() => setIsAddModalOpen(false)}
        onAddService={handleAddService}
        onOpenManageTemplates={() => setActiveTab('notifications')}
      />

      <ExpandedCameraModal
        service={expandedService}
        isDark={isDark}
        onClose={() => setExpandedServiceId(null)}
        onRecoverService={handleRecoverService}
        onOpenBlackbox30s={(srv) => {
          setBlackboxTargetServiceId(srv.id);
          setActiveTab('blackbox');
        }}
      />

      <ConfirmDeleteModal
        request={deleteConfirmRequest}
        isDark={isDark}
        onCancel={() => setDeleteConfirmRequest(null)}
        onConfirm={handleConfirmDeleteAction}
      />
    </div>
  );
}
