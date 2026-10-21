import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Edit3,
  FileSpreadsheet,
  FileText,
  Layers,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  STANDARD_ENDPOINT_TEMPLATES,
  STANDARD_METRIC_UNITS,
  STANDARD_MONITORING_GROUPS,
  STANDARD_NODE_COUNTS,
  STANDARD_PRIMARY_METRICS,
  STANDARD_REFRESH_INTERVALS,
  STANDARD_SECONDARY_METRICS,
  STANDARD_SECONDARY_UNITS,
  STANDARD_SERVICE_TYPES,
  STANDARD_THRESHOLD_PRESETS,
  type ChartStyleType,
  type NotificationConfig,
  type NotificationRecord,
  type ServiceFeed,
  type ServicePresetTemplate,
} from '../utils/monitoringEngine';

interface NotificationsAndExportViewProps {
  services: ServiceFeed[];
  templates: ServicePresetTemplate[];
  config: NotificationConfig;
  history: NotificationRecord[];
  isDark: boolean;
  onSetTheme: (dark: boolean) => void;
  onUpdateConfig: (patch: Partial<NotificationConfig>) => void;
  onSaveTemplate: (template: ServicePresetTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onResetDefaultTemplates: () => void;
  onSimulateCrash: (service: ServiceFeed) => void;
  onRecoverService: (service: ServiceFeed) => void;
  onOpenAddService: () => void;
  onResetAllData: () => void;
  onSendTestNotification: (channel: 'telegram' | 'slack', customText?: string) => Promise<void>;
  onExportCsv: () => void;
  onExportPdf: () => void;
}

export const NotificationsAndExportView: React.FC<NotificationsAndExportViewProps> = ({
  services,
  templates,
  config,
  history,
  isDark,
  onSetTheme,
  onUpdateConfig,
  onSaveTemplate,
  onDeleteTemplate,
  onResetDefaultTemplates,
  onSimulateCrash,
  onRecoverService,
  onOpenAddService,
  onResetAllData,
  onSendTestNotification,
  onExportCsv,
  onExportPdf,
}) => {
  const [customAlertText, setCustomAlertText] = useState(
    'Перевірка каналу оперативного сповіщення SentinelWall NOC.'
  );
  const [sendingChannel, setSendingChannel] = useState<'telegram' | 'slack' | null>(null);
  const [selectedCrashServiceId, setSelectedCrashServiceId] = useState<string>(
    services[0]?.id || ''
  );
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Template Manager Editor State
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplLabel, setTplLabel] = useState('');
  const [tplType, setTplType] = useState<ServiceFeed['serviceType']>('custom');
  const [tplGroup, setTplGroup] = useState('Інфраструктура');
  const [tplEndpoint, setTplEndpoint] = useState('');
  const [tplPrimaryLabel, setTplPrimaryLabel] = useState('Завантаження CPU');
  const [tplPrimaryUnit, setTplPrimaryUnit] = useState('%');
  const [tplSecondaryLabel, setTplSecondaryLabel] = useState("Активні з'єднання");
  const [tplSecondaryUnit, setTplSecondaryUnit] = useState('клієнтів');
  const [tplThresholdPresetId, setTplThresholdPresetId] = useState('cpu-std');
  const [tplWarn, setTplWarn] = useState(75);
  const [tplCrit, setTplCrit] = useState(90);
  const [tplNodesTotal, setTplNodesTotal] = useState(16);
  const [tplRefreshSec, setTplRefreshSec] = useState(2);
  const [tplChartType, setTplChartType] = useState<ChartStyleType>('line');
  const [tplColor, setTplColor] = useState('#38BDF8');
  const [tplError, setTplError] = useState('');

  useEffect(() => {
    if (services.length > 0 && !services.some((s) => s.id === selectedCrashServiceId)) {
      setSelectedCrashServiceId(services[0].id);
    } else if (services.length === 0) {
      setSelectedCrashServiceId('');
    }
  }, [services, selectedCrashServiceId]);

  const selectedCrashService =
    services.find((s) => s.id === selectedCrashServiceId) || services[0] || null;

  const resetTemplateEditor = () => {
    setEditingTemplateId(null);
    setTplLabel('');
    setTplType('custom');
    setTplGroup('Інфраструктура');
    setTplEndpoint('');
    setTplPrimaryLabel('Завантаження CPU');
    setTplPrimaryUnit('%');
    setTplSecondaryLabel("Активні з'єднання");
    setTplSecondaryUnit('клієнтів');
    setTplThresholdPresetId('cpu-std');
    setTplWarn(75);
    setTplCrit(90);
    setTplNodesTotal(16);
    setTplRefreshSec(2);
    setTplChartType('line');
    setTplColor('#38BDF8');
    setTplError('');
  };

  const handleOpenCreateTemplate = () => {
    resetTemplateEditor();
    setIsTemplateFormOpen(true);
  };

  const handleOpenEditTemplate = (tpl: ServicePresetTemplate) => {
    setEditingTemplateId(tpl.id);
    setTplLabel(tpl.label);
    setTplType(tpl.type);
    setTplGroup(tpl.group);
    setTplEndpoint(tpl.endpoint);
    setTplPrimaryLabel(tpl.primaryLabel);
    setTplPrimaryUnit(tpl.primaryUnit);
    setTplSecondaryLabel(tpl.secondaryLabel);
    setTplSecondaryUnit(tpl.secondaryUnit);
    setTplThresholdPresetId(tpl.thresholdPresetId || 'cpu-std');
    setTplWarn(tpl.warn);
    setTplCrit(tpl.crit);
    setTplNodesTotal(tpl.nodesTotal);
    setTplRefreshSec(tpl.refreshSec);
    setTplChartType(tpl.chartType);
    setTplColor(tpl.color);
    setTplError('');
    setIsTemplateFormOpen(true);
  };

  const handleTplPrimaryMetricChange = (selectedLabel: string) => {
    setTplPrimaryLabel(selectedLabel);
    const found = STANDARD_PRIMARY_METRICS.find((m) => m.label === selectedLabel);
    if (found) {
      setTplPrimaryUnit(found.defaultUnit);
      setTplThresholdPresetId(found.defaultThresholdPresetId);
      setTplWarn(found.defaultWarn);
      setTplCrit(found.defaultCrit);
    }
  };

  const handleTplSecondaryMetricChange = (selectedLabel: string) => {
    setTplSecondaryLabel(selectedLabel);
    const found = STANDARD_SECONDARY_METRICS.find((m) => m.label === selectedLabel);
    if (found) {
      setTplSecondaryUnit(found.defaultUnit);
    }
  };

  const handleTplThresholdPresetChange = (presetId: string) => {
    setTplThresholdPresetId(presetId);
    const found = STANDARD_THRESHOLD_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setTplWarn(found.warn);
      setTplCrit(found.crit);
    }
  };

  const handleSaveTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplLabel.trim()) {
      setTplError('Вкажіть назву шаблону сервісу.');
      return;
    }
    if (!tplEndpoint.trim()) {
      setTplError('Вкажіть URL ендпоінту або оберіть типовий URI зі списку.');
      return;
    }

    const savedTemplate: ServicePresetTemplate = {
      id: editingTemplateId || `tpl-custom-${Date.now()}`,
      label: tplLabel.trim(),
      type: tplType,
      group: tplGroup,
      endpoint: tplEndpoint.trim(),
      primaryLabel: tplPrimaryLabel,
      primaryUnit: tplPrimaryUnit,
      secondaryLabel: tplSecondaryLabel,
      secondaryUnit: tplSecondaryUnit,
      thresholdPresetId: tplThresholdPresetId,
      warn: Number(tplWarn) || 75,
      crit: Number(tplCrit) || 90,
      nodesTotal: Number(tplNodesTotal) || 16,
      refreshSec: Number(tplRefreshSec) || 2,
      chartType: tplChartType,
      color: tplColor,
    };

    onSaveTemplate(savedTemplate);
    resetTemplateEditor();
    setIsTemplateFormOpen(false);
  };

  const handleTriggerSend = async (channel: 'telegram' | 'slack') => {
    setSendingChannel(channel);
    try {
      await onSendTestNotification(channel, customAlertText);
    } finally {
      setSendingChannel(null);
    }
  };

  const inputClass = `w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-sky-500 ${
    isDark
      ? 'bg-slate-900 border-slate-700 text-slate-100'
      : 'bg-white border-slate-300 text-slate-900'
  }`;

  return (
    <section
      className="space-y-6"
      aria-label="Налаштування системи, сповіщення Telegram і Slack та експорт звітів"
    >
      {/* 1. System Settings: Theme Switcher (Dark / Light) & Diagnostic Crash Test */}
      <div
        className={`rounded-xl border p-5 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-mono text-sky-600 dark:text-sky-400">
          <Settings className="w-4 h-4" aria-hidden="true" />
          <span>НАЛАШТУВАННЯ ІНТЕРФЕЙСУ ТА ДІАГНОСТИКИ NOC</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight mt-1">
          Тема оформлення та сервісне тестування аварійного дампу (30с)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Керування візуальним режимом панелі оператора та безпечна перевірка механізму фіксації метрик Чорної скриньки
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          {/* Theme Switcher Card */}
          <div
            className={`rounded-lg border p-4 flex flex-col justify-between gap-4 ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <div className="text-xs font-semibold">Тема оформлення інтерфейсу</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Оберіть темну тему для цілодобового чергування в NOC або світлу денну тему для офісної роботи.
              </p>
            </div>

            <div
              role="group"
              aria-label="Перемикач темної і світлої теми"
              className={`grid grid-cols-2 gap-2 p-1.5 rounded-lg border ${
                isDark ? 'bg-[#0B0F17] border-slate-800' : 'bg-slate-200/80 border-slate-300'
              }`}
            >
              <button
                type="button"
                data-testid="theme-dark-btn"
                aria-pressed={isDark}
                onClick={() => onSetTheme(true)}
                className={`px-3 py-2 text-xs rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-transparent text-slate-600 font-medium hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Moon className="w-4 h-4" aria-hidden="true" />
                <span>Темна тема {isDark ? '(Активна)' : ''}</span>
              </button>

              <button
                type="button"
                data-testid="theme-light-btn"
                aria-pressed={!isDark}
                onClick={() => onSetTheme(false)}
                className={`px-3 py-2 text-xs rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  !isDark
                    ? 'bg-slate-900 text-white font-bold shadow-sm'
                    : 'bg-transparent text-slate-400 font-medium hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Sun className="w-4 h-4" aria-hidden="true" />
                <span>Світла тема {!isDark ? '(Активна)' : ''}</span>
              </button>
            </div>
          </div>

          {/* Crash Simulation Tool (Moved from Camera Tiles to Settings) */}
          <div
            className={`rounded-lg border p-4 flex flex-col justify-between gap-4 ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div>
              <div className="text-xs font-semibold">
                Діагностичний тест збою (Чорна скринька 30 секунд)
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Імітує критичне перевищення порогу на обраному сервісі для перевірки збереження 30-секундного дампу, авто-бекапу та сповіщень.
              </p>
            </div>

            {services.length === 0 ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Немає підключених сервісів для тестування
                </span>
                <button
                  type="button"
                  onClick={onOpenAddService}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Додати сервіс</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <label htmlFor="settings-crash-service" className="sr-only">
                  Сервіс для тесту збою
                </label>
                <select
                  id="settings-crash-service"
                  aria-label="Сервіс для тесту збою"
                  value={selectedCrashService?.id || ''}
                  onChange={(e) => setSelectedCrashServiceId(e.target.value)}
                  className={`flex-1 min-w-0 px-3 py-2 text-xs font-mono rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                >
                  {services.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.cameraCode} · {srv.name} ({srv.status === 'critical' ? 'ЗБІЙ' : 'ОК'})
                    </option>
                  ))}
                </select>

                {selectedCrashService && (
                  <button
                    type="button"
                    data-testid="settings-test-crash-btn"
                    onClick={() => onSimulateCrash(selectedCrashService)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Тест збою (30с)</span>
                  </button>
                )}

                {selectedCrashService?.status === 'critical' && (
                  <button
                    type="button"
                    onClick={() => onRecoverService(selectedCrashService)}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Відновити</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Service Templates Manager (Create, Edit, Delete Standard Templates) */}
      <div
        className={`rounded-xl border p-5 space-y-4 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-sky-600 dark:text-sky-400">
              <Layers className="w-4 h-4" aria-hidden="true" />
              <span>ШАБЛОНИ ШВИДКОГО ПІДКЛЮЧЕННЯ СЕРВІСІВ</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight mt-0.5">
              Керування стандартними та власними шаблонами додавання ({templates.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Створюйте нові шаблони, редагуйте або видаляйте стандартні пресети для меню «+ Додати сервіс»
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onResetDefaultTemplates}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isDark
                  ? 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
              title="Повернути стандартний набір із 6 шаблонів (Wazuh, Zabbix, Ceph, Redis, RabbitMQ, Prometheus)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Відновити стандартні</span>
            </button>

            <button
              type="button"
              data-testid="create-template-btn"
              onClick={handleOpenCreateTemplate}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Створити новий шаблон</span>
            </button>
          </div>
        </div>

        {/* Inline Template Create / Edit Form */}
        {isTemplateFormOpen && (
          <form
            onSubmit={handleSaveTemplateSubmit}
            className={`rounded-xl border p-4 space-y-4 ${
              isDark ? 'bg-slate-900/90 border-sky-500/40' : 'bg-slate-50 border-sky-300'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-800/60">
              <div className="text-sm font-bold flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: tplColor }}
                />
                <span>
                  {editingTemplateId
                    ? `Редагування шаблону: ${tplLabel || 'Без назви'}`
                    : 'Створення нового шаблону швидкого додавання'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetTemplateEditor();
                  setIsTemplateFormOpen(false);
                }}
                aria-label="Закрити редактор шаблону"
                className="p-1 rounded-md text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tplError && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/50 text-xs text-red-200">
                {tplError}
              </div>
            )}

            {/* Row 1: Template Name, Connector Type, Group */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="tpl-label"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Назва шаблону *
                </label>
                <input
                  id="tpl-label"
                  type="text"
                  value={tplLabel}
                  onChange={(e) => setTplLabel(e.target.value)}
                  placeholder="Напр.: PostgreSQL Cluster"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="tpl-type"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Тип платформи / Конектора
                </label>
                <select
                  id="tpl-type"
                  value={tplType}
                  onChange={(e) => setTplType(e.target.value as ServiceFeed['serviceType'])}
                  className={inputClass}
                >
                  {STANDARD_SERVICE_TYPES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tpl-group"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Група моніторингу
                </label>
                <select
                  id="tpl-group"
                  value={tplGroup}
                  onChange={(e) => setTplGroup(e.target.value)}
                  className={inputClass}
                >
                  {STANDARD_MONITORING_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Standard Endpoint Picker + Endpoint URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="tpl-endpoint-preset"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Типовий URI підключення (зі списку)
                </label>
                <select
                  id="tpl-endpoint-preset"
                  value={
                    STANDARD_ENDPOINT_TEMPLATES.some((t) => t.url === tplEndpoint)
                      ? tplEndpoint
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setTplEndpoint(e.target.value);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">— Обрати стандартний URI —</option>
                  {STANDARD_ENDPOINT_TEMPLATES.map((item) => (
                    <option key={item.url} value={item.url}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tpl-endpoint"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  URL Дашборду або API Ендпоінт *
                </label>
                <input
                  id="tpl-endpoint"
                  type="text"
                  value={tplEndpoint}
                  onChange={(e) => setTplEndpoint(e.target.value)}
                  placeholder="https://service.internal.noc/metrics"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            {/* Row 3: Primary & Secondary Metrics + Units */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label
                  htmlFor="tpl-primary-metric"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Основна метрика
                </label>
                <select
                  id="tpl-primary-metric"
                  value={tplPrimaryLabel}
                  onChange={(e) => handleTplPrimaryMetricChange(e.target.value)}
                  className={inputClass}
                >
                  {STANDARD_PRIMARY_METRICS.map((m) => (
                    <option key={m.label} value={m.label}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tpl-primary-unit"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Одиниця (основна)
                </label>
                <select
                  id="tpl-primary-unit"
                  value={tplPrimaryUnit}
                  onChange={(e) => setTplPrimaryUnit(e.target.value)}
                  className={`${inputClass} font-mono`}
                >
                  {STANDARD_METRIC_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tpl-sec-metric"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Додаткова метрика
                </label>
                <select
                  id="tpl-sec-metric"
                  value={tplSecondaryLabel}
                  onChange={(e) => handleTplSecondaryMetricChange(e.target.value)}
                  className={inputClass}
                >
                  {STANDARD_SECONDARY_METRICS.map((m) => (
                    <option key={m.label} value={m.label}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tpl-sec-unit"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Одиниця (додаткова)
                </label>
                <select
                  id="tpl-sec-unit"
                  value={tplSecondaryUnit}
                  onChange={(e) => setTplSecondaryUnit(e.target.value)}
                  className={`${inputClass} font-mono`}
                >
                  {STANDARD_SECONDARY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Thresholds, Nodes, Refresh, Chart Type & Color */}
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="tpl-threshold-preset"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Профіль порогів (УВАГА / ЗБІЙ)
                </label>
                <select
                  id="tpl-threshold-preset"
                  value={tplThresholdPresetId}
                  onChange={(e) => handleTplThresholdPresetChange(e.target.value)}
                  className={inputClass}
                >
                  {STANDARD_THRESHOLD_PRESETS.map((tp) => (
                    <option key={tp.id} value={tp.id}>
                      {tp.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tpl-warn"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  УВАГА ({tplPrimaryUnit})
                </label>
                <input
                  id="tpl-warn"
                  type="number"
                  value={tplWarn}
                  onChange={(e) => setTplWarn(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label
                  htmlFor="tpl-crit"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  ЗБІЙ ({tplPrimaryUnit})
                </label>
                <input
                  id="tpl-crit"
                  type="number"
                  value={tplCrit}
                  onChange={(e) => setTplCrit(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div>
                <label
                  htmlFor="tpl-nodes"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Вузли кластера
                </label>
                <select
                  id="tpl-nodes"
                  value={tplNodesTotal}
                  onChange={(e) => setTplNodesTotal(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                >
                  {STANDARD_NODE_COUNTS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tpl-refresh"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Опитування
                </label>
                <select
                  id="tpl-refresh"
                  value={tplRefreshSec}
                  onChange={(e) => setTplRefreshSec(Number(e.target.value))}
                  className={`${inputClass} font-mono`}
                >
                  {STANDARD_REFRESH_INTERVALS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 5: Chart Style, Color & Save/Clear Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/60">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="tpl-chart"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    Графік:
                  </label>
                  <select
                    id="tpl-chart"
                    value={tplChartType}
                    onChange={(e) => setTplChartType(e.target.value as ChartStyleType)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border ${
                      isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-100'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="line">Лінійний (Line)</option>
                    <option value="bar">Стовпчиковий (Bar)</option>
                    <option value="radar">Радарний (Radar)</option>
                    <option value="doughnut">Кільцевий (Doughnut)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 mr-1">
                    Колір:
                  </span>
                  {['#38BDF8', '#22C55E', '#F59E0B', '#EC4899', '#A855F7', '#06B6D4'].map(
                    (c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Колір шаблону ${c}`}
                        onClick={() => setTplColor(c)}
                        className={`w-6 h-6 rounded-md border ${
                          tplColor === c
                            ? 'border-white scale-110'
                            : 'border-transparent opacity-70'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    )
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetTemplateEditor}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                    isDark
                      ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Очистити</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetTemplateEditor();
                    setIsTemplateFormOpen(false);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    isDark
                      ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  data-testid="save-template-btn"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {editingTemplateId ? 'Зберегти зміни шаблону' : 'Додати шаблон у список'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* List of Current Service Templates */}
        {templates.length === 0 ? (
          <div
            className={`rounded-lg border p-6 text-center text-xs ${
              isDark
                ? 'bg-slate-900/50 border-slate-800 text-slate-400'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            Усі шаблони видалено. Натисніть «Створити новий шаблон» або «Відновити стандартні».
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={`rounded-lg border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                  editingTemplateId === tpl.id
                    ? 'border-sky-500 bg-sky-500/10'
                    : isDark
                    ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tpl.color }}
                      />
                      <span className="text-sm font-bold">{tpl.label}</span>
                    </div>
                    <div className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mt-0.5">
                      Група: {tpl.group}
                    </div>
                  </div>

                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    {tpl.endpoint}
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                    {tpl.primaryLabel}: УВАГА {tpl.warn} / ЗБІЙ {tpl.crit} {tpl.primaryUnit}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/50">
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {tpl.nodesTotal} вузлів · {tpl.refreshSec}с · {tpl.chartType.toUpperCase()}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditTemplate(tpl)}
                      aria-label={`Змінити шаблон ${tpl.label}`}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex items-center gap-1 cursor-pointer ${
                        isDark
                          ? 'border-slate-700 bg-slate-800 text-slate-200 hover:border-sky-500/50 hover:text-sky-300'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-sky-500 hover:text-sky-700'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Змінити</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTemplate(tpl.id)}
                      aria-label={`Видалити шаблон ${tpl.label}`}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex items-center gap-1 cursor-pointer ${
                        isDark
                          ? 'border-red-500/30 bg-red-950/30 text-red-300 hover:bg-red-900/50'
                          : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Видалити</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Telegram & Slack Gateways */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telegram Card */}
        <div
          className={`rounded-xl border p-5 flex flex-col justify-between ${
            isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-sky-600 dark:text-sky-400">
                  TELEGRAM BOT API ШЛЮЗ
                </div>
                <h2 className="text-lg font-bold mt-0.5">Сповіщення у Telegram</h2>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.telegramEnabled}
                  onChange={(e) => onUpdateConfig({ telegramEnabled: e.target.checked })}
                  className="rounded border-slate-700"
                />
                <span>Активно</span>
              </label>
            </div>

            <div>
              <label
                htmlFor="tg-token"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Telegram Bot Token
              </label>
              <input
                id="tg-token"
                type="text"
                value={config.telegramBotToken}
                onChange={(e) => onUpdateConfig({ telegramBotToken: e.target.value })}
                placeholder="7123456789:AAH_your_telegram_bot_token"
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="tg-chat-id"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Chat ID або Канал чергової зміни NOC
              </label>
              <input
                id="tg-chat-id"
                type="text"
                value={config.telegramChatId}
                onChange={(e) => onUpdateConfig({ telegramChatId: e.target.value })}
                placeholder="-100198237465 або @noc_alerts"
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div
            className={`mt-5 pt-4 border-t flex items-center justify-between ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Авто-відправка при збої (разом із дампом 30с)
            </span>
            <button
              type="button"
              disabled={sendingChannel === 'telegram'}
              onClick={() => handleTriggerSend('telegram')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {sendingChannel === 'telegram' ? 'Відправка...' : 'Тест у Telegram'}
              </span>
            </button>
          </div>
        </div>

        {/* Slack Card */}
        <div
          className={`rounded-xl border p-5 flex flex-col justify-between ${
            isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  SLACK INCOMING WEBHOOK
                </div>
                <h2 className="text-lg font-bold mt-0.5">Сповіщення у Slack</h2>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.slackEnabled}
                  onChange={(e) => onUpdateConfig({ slackEnabled: e.target.checked })}
                  className="rounded border-slate-700"
                />
                <span>Активно</span>
              </label>
            </div>

            <div>
              <label
                htmlFor="slack-webhook"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Slack Incoming Webhook URL
              </label>
              <input
                id="slack-webhook"
                type="text"
                value={config.slackWebhookUrl}
                onChange={(e) => onUpdateConfig({ slackWebhookUrl: e.target.value })}
                placeholder="https://hooks.slack.com/services/T000/B000/XXXX"
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            <div>
              <label
                htmlFor="slack-channel"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Канал для інцидентів
              </label>
              <input
                id="slack-channel"
                type="text"
                value={config.slackChannel}
                onChange={(e) => onUpdateConfig({ slackChannel: e.target.value })}
                placeholder="#noc-incidents"
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div
            className={`mt-5 pt-4 border-t flex items-center justify-between ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Миттєвий вебхук у робочий простір команди
            </span>
            <button
              type="button"
              disabled={sendingChannel === 'slack'}
              onClick={() => handleTriggerSend('slack')}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingChannel === 'slack' ? 'Відправка...' : 'Тест у Slack'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Custom Alert Message & Export PDF / CSV */}
      <div
        className={`rounded-xl border p-5 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          <div className="lg:col-span-2 space-y-2">
            <label
              htmlFor="custom-alert-msg"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Текст оперативного повідомлення для перевірки шлюзів Telegram / Slack
            </label>
            <input
              id="custom-alert-msg"
              type="text"
              value={customAlertText}
              onChange={(e) => setCustomAlertText(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnCritical}
                  onChange={(e) => onUpdateConfig({ notifyOnCritical: e.target.checked })}
                />
                <span>Сповіщати при критичних збоях (CRITICAL)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyWith30sBlackbox}
                  onChange={(e) => onUpdateConfig({ notifyWith30sBlackbox: e.target.checked })}
                />
                <span>Додавати зведення метрик за останні 30 секунд</span>
              </label>
            </div>
          </div>

          {/* Export PDF / CSV Section */}
          <div
            className={`rounded-lg border p-4 space-y-3 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400">
              ЕКСПОРТ ЗВІТІВ (PDF / CSV)
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Вивантажити повний звіт стану камер, посекундних метрик за останні 30с та історії хмарних запитів
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExportPdf}
                className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <FileText className="w-4 h-4" />
                <span>Завантажити PDF</span>
              </button>
              <button
                type="button"
                onClick={onExportCsv}
                className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isDark
                    ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Завантажити CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Notification Delivery Log */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-sky-500 dark:text-sky-400" />
            <h3 className="text-sm font-bold">Журнал відправлених сповіщень (Telegram / Slack)</h3>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Усього записів: {history.length}
          </span>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b font-mono ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <th className="py-2.5 px-4">Час</th>
                <th className="py-2.5 px-4">Канал</th>
                <th className="py-2.5 px-4">Сервіс</th>
                <th className="py-2.5 px-4">Повідомлення</th>
                <th className="py-2.5 px-4">Статус доставки</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y font-mono tabular-nums ${
                isDark ? 'divide-slate-800/60' : 'divide-slate-200'
              }`}
            >
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-slate-500 dark:text-slate-400 font-sans"
                  >
                    Журнал сповіщень порожній. Налаштуйте Telegram або Slack вище для отримання оперативних алертів.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {new Date(item.timestamp).toLocaleTimeString('uk-UA')}
                    </td>
                    <td className="py-2.5 px-4 uppercase font-semibold text-sky-600 dark:text-sky-400">
                      {item.channelType}
                    </td>
                    <td className="py-2.5 px-4 font-sans font-semibold">{item.serviceName}</td>
                    <td className="py-2.5 px-4 font-sans">{item.message}</td>
                    <td className="py-2.5 px-4 font-sans text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.deliveryNote}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Deep Collapsible Environment Management */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isDark ? 'bg-[#0F172A]/70 border-slate-800/80' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <button
          type="button"
          aria-expanded={showAdvancedSettings}
          onClick={() => setShowAdvancedSettings((prev) => !prev)}
          className={`w-full px-5 py-3.5 flex items-center justify-between text-xs font-medium transition-colors ${
            isDark
              ? 'text-slate-400 hover:text-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span>Службове скидання локального стану та даних середовища</span>
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {showAdvancedSettings && (
          <div
            className={`px-5 pb-5 pt-3 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
              isDark ? 'border-slate-800/80' : 'border-slate-200'
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
              Видаляє всі поточні дашборди, користувацькі графіки Chart.js та локальну історію журналів для повторної ініціалізації з нуля.
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onResetAllData}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Очистити всі дані середовища</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
