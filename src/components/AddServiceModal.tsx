import React, { useEffect, useMemo, useState } from 'react';
import { Eraser, Plus, RotateCcw, Settings, X } from 'lucide-react';
import {
  createDefaultServiceFormState,
  createDefaultServiceTemplates,
  seedInitial30sBuffer,
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
  type ServiceFeed,
  type ServicePresetTemplate,
} from '../utils/monitoringEngine';

interface AddServiceModalProps {
  isOpen: boolean;
  isDark: boolean;
  existingCount: number;
  availableGroups: string[];
  templates?: ServicePresetTemplate[];
  onClose: () => void;
  onAddService: (newService: ServiceFeed) => void;
  onOpenManageTemplates?: () => void;
}

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  isDark,
  existingCount,
  availableGroups,
  templates,
  onClose,
  onAddService,
  onOpenManageTemplates,
}) => {
  const activeTemplates = useMemo(
    () => (templates ? templates : createDefaultServiceTemplates()),
    [templates]
  );

  const mergedGroups = useMemo(() => {
    const templateGroups = activeTemplates.map((t) => t.group).filter(Boolean);
    const set = new Set<string>([
      ...STANDARD_MONITORING_GROUPS,
      ...availableGroups,
      ...templateGroups,
    ]);
    return Array.from(set);
  }, [availableGroups, activeTemplates]);

  const initialDefaults = useMemo(
    () => createDefaultServiceFormState(mergedGroups[0] || 'Інфраструктура'),
    [mergedGroups]
  );

  const [activePresetLabel, setActivePresetLabel] = useState<string | null>(
    initialDefaults.activePresetLabel
  );
  const [name, setName] = useState(initialDefaults.name);
  const [serviceType, setServiceType] = useState<ServiceFeed['serviceType']>(
    initialDefaults.serviceType
  );
  const [group, setGroup] = useState(initialDefaults.group);
  const [customGroup, setCustomGroup] = useState(initialDefaults.customGroup);
  const [endpointUrl, setEndpointUrl] = useState(initialDefaults.endpointUrl);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(initialDefaults.refreshIntervalSec);
  const [nodesTotal, setNodesTotal] = useState(initialDefaults.nodesTotal);
  const [primaryMetricLabel, setPrimaryMetricLabel] = useState(initialDefaults.primaryMetricLabel);
  const [primaryMetricUnit, setPrimaryMetricUnit] = useState(initialDefaults.primaryMetricUnit);
  const [secondaryMetricLabel, setSecondaryMetricLabel] = useState(
    initialDefaults.secondaryMetricLabel
  );
  const [secondaryMetricUnit, setSecondaryMetricUnit] = useState(
    initialDefaults.secondaryMetricUnit
  );
  const [thresholdPresetId, setThresholdPresetId] = useState(initialDefaults.thresholdPresetId);
  const [warningThreshold, setWarningThreshold] = useState(initialDefaults.warningThreshold);
  const [criticalThreshold, setCriticalThreshold] = useState(initialDefaults.criticalThreshold);
  const [chartType, setChartType] = useState<ChartStyleType>(initialDefaults.chartType);
  const [accentColor, setAccentColor] = useState(initialDefaults.accentColor);
  const [errorMessage, setErrorMessage] = useState('');

  const handleClearForm = () => {
    const clean = createDefaultServiceFormState(mergedGroups[0] || 'Інфраструктура');
    setActivePresetLabel(clean.activePresetLabel);
    setName(clean.name);
    setServiceType(clean.serviceType);
    setGroup(clean.group);
    setCustomGroup(clean.customGroup);
    setEndpointUrl(clean.endpointUrl);
    setRefreshIntervalSec(clean.refreshIntervalSec);
    setNodesTotal(clean.nodesTotal);
    setPrimaryMetricLabel(clean.primaryMetricLabel);
    setPrimaryMetricUnit(clean.primaryMetricUnit);
    setSecondaryMetricLabel(clean.secondaryMetricLabel);
    setSecondaryMetricUnit(clean.secondaryMetricUnit);
    setThresholdPresetId(clean.thresholdPresetId);
    setWarningThreshold(clean.warningThreshold);
    setCriticalThreshold(clean.criticalThreshold);
    setChartType(clean.chartType);
    setAccentColor(clean.accentColor);
    setErrorMessage('');
  };

  // Always start with a clean form whenever the modal is opened so previous templates never stick
  useEffect(() => {
    if (isOpen) {
      handleClearForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const applyPreset = (preset: ServicePresetTemplate) => {
    // Clicking the already active template toggles it off and clears the form
    if (activePresetLabel === preset.label) {
      handleClearForm();
      return;
    }
    setActivePresetLabel(preset.label);
    setName(preset.label);
    setServiceType(preset.type);
    setGroup(preset.group);
    setCustomGroup('');
    setEndpointUrl(preset.endpoint);
    setRefreshIntervalSec(preset.refreshSec);
    setNodesTotal(preset.nodesTotal);
    setPrimaryMetricLabel(preset.primaryLabel);
    setPrimaryMetricUnit(preset.primaryUnit);
    setSecondaryMetricLabel(preset.secondaryLabel);
    setSecondaryMetricUnit(preset.secondaryUnit);
    setThresholdPresetId(preset.thresholdPresetId);
    setWarningThreshold(preset.warn);
    setCriticalThreshold(preset.crit);
    setChartType(preset.chartType);
    setAccentColor(preset.color);
    setErrorMessage('');
  };

  const handlePrimaryMetricChange = (selectedLabel: string) => {
    setPrimaryMetricLabel(selectedLabel);
    const found = STANDARD_PRIMARY_METRICS.find((m) => m.label === selectedLabel);
    if (found) {
      setPrimaryMetricUnit(found.defaultUnit);
      setThresholdPresetId(found.defaultThresholdPresetId);
      setWarningThreshold(found.defaultWarn);
      setCriticalThreshold(found.defaultCrit);
    }
  };

  const handleSecondaryMetricChange = (selectedLabel: string) => {
    setSecondaryMetricLabel(selectedLabel);
    const found = STANDARD_SECONDARY_METRICS.find((m) => m.label === selectedLabel);
    if (found) {
      setSecondaryMetricUnit(found.defaultUnit);
    }
  };

  const handleThresholdPresetChange = (presetId: string) => {
    setThresholdPresetId(presetId);
    const found = STANDARD_THRESHOLD_PRESETS.find((p) => p.id === presetId);
    if (found) {
      setWarningThreshold(found.warn);
      setCriticalThreshold(found.crit);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Будь ласка, введіть назву сервісу або оберіть шаблон вище.');
      return;
    }
    if (!endpointUrl.trim()) {
      setErrorMessage('Вкажіть URL ендпоінту або оберіть типовий URI зі списку.');
      return;
    }

    const finalGroup = customGroup.trim() ? customGroup.trim() : group;
    const camNum = String(existingCount + 1).padStart(2, '0');
    const now = Date.now();
    const validNodes = Number(nodesTotal) || 16;

    const newService: ServiceFeed = {
      id: `srv-custom-${now}`,
      cameraCode: `CAM-${camNum}`,
      name: name.trim(),
      serviceType,
      group: finalGroup,
      endpointUrl: endpointUrl.trim(),
      refreshIntervalSec: Number(refreshIntervalSec) || 2,
      autoRefreshPage: true,
      status: 'nominal',
      primaryMetricLabel: primaryMetricLabel.trim() || 'Завантаження CPU',
      primaryMetricUnit: primaryMetricUnit.trim() || '%',
      secondaryMetricLabel: secondaryMetricLabel.trim() || "Активні з'єднання",
      secondaryMetricUnit: secondaryMetricUnit.trim() || 'клієнтів',
      warningThreshold: Number(warningThreshold) || 75,
      criticalThreshold: Number(criticalThreshold) || 90,
      chartType,
      chartFill: true,
      chartSmooth: true,
      accentColor,
      nodesOnline: validNodes,
      nodesTotal: validNodes,
      lastUpdated: new Date(now).toISOString(),
      ringBuffer30s: seedInitial30sBuffer(
        Number((warningThreshold * 0.6).toFixed(1)),
        24,
        14,
        Number(warningThreshold) || 75,
        Number(criticalThreshold) || 90,
        now
      ),
    };

    onAddService(newService);
    handleClearForm();
    onClose();
  };

  const inputClass = `w-full px-3 py-2 text-sm rounded-lg border focus:outline-none focus:border-sky-500 ${
    isDark
      ? 'border-slate-700 bg-slate-900 text-slate-100'
      : 'border-slate-300 bg-slate-50 text-slate-900'
  }`;

  const smallInputClass = `w-full px-2.5 py-1.5 text-xs rounded-lg border focus:outline-none focus:border-sky-500 ${
    isDark
      ? 'border-slate-700 bg-slate-900 text-slate-100'
      : 'border-slate-300 bg-slate-50 text-slate-900'
  }`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-service-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
    >
      <div
        className={`w-full max-w-3xl rounded-xl border p-6 shadow-2xl my-auto ${
          isDark ? 'bg-[#111827] border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div
          className={`flex items-center justify-between pb-4 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div>
            <h2 id="add-service-title" className="text-xl font-bold tracking-tight">
              Підключити робочий сервіс на стіну моніторингу
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Оберіть стандартизовані параметри з випадаючих списків або застосуйте готовий шаблон сервісу
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              handleClearForm();
              onClose();
            }}
            aria-label="Закрити вікно додавання сервісу"
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Templates + Clear & Manage Templates Buttons */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Швидкі шаблони конфігурації метрик ({activeTemplates.length}):
            </span>
            <div className="flex items-center gap-2">
              {onOpenManageTemplates && (
                <button
                  type="button"
                  onClick={() => {
                    handleClearForm();
                    onClose();
                    onOpenManageTemplates();
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
                    isDark
                      ? 'border-sky-500/40 bg-sky-950/30 text-sky-300 hover:bg-sky-900/40'
                      : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Керувати шаблонами</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleClearForm}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
                  isDark
                    ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                    : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
                }`}
                title="Очистити всі текстові поля та скинути вибраний шаблон"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Скинути шаблон</span>
              </button>
            </div>
          </div>
          {activeTemplates.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400 italic py-1">
              Список шаблонів порожній. Ви можете створити власні шаблони у вкладці «Налаштування та Сповіщення».
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {activeTemplates.map((preset) => {
                const isSelected = activePresetLabel === preset.label;
                return (
                  <button
                    key={preset.id || preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-sky-500 bg-sky-500/20 text-sky-400 font-semibold'
                        : isDark
                        ? 'border-slate-700 bg-slate-900/90 text-slate-200 hover:border-sky-500/60 hover:text-sky-300'
                        : 'border-slate-300 bg-slate-100 text-slate-800 hover:border-sky-500 hover:text-sky-700'
                    }`}
                  >
                    + {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/60 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

          {/* Row 1: Service Name & Standardized Connector Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="srv-name"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Назва сервісу / Дашборду *
              </label>
              <input
                id="srv-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setActivePresetLabel(null);
                }}
                placeholder="Напр.: Wazuh SIEM або Ceph Storage"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="srv-type"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Тип платформи / Конектора (стандарт)
              </label>
              <select
                id="srv-type"
                value={serviceType}
                onChange={(e) =>
                  setServiceType(e.target.value as ServiceFeed['serviceType'])
                }
                className={inputClass}
              >
                {STANDARD_SERVICE_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Standardized Endpoint Selector + Endpoint URL Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="srv-endpoint-preset"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Типовий URI / Шаблон ендпоінту (зі списку)
              </label>
              <select
                id="srv-endpoint-preset"
                value={
                  STANDARD_ENDPOINT_TEMPLATES.some((t) => t.url === endpointUrl)
                    ? endpointUrl
                    : ''
                }
                onChange={(e) => {
                  if (e.target.value) {
                    setEndpointUrl(e.target.value);
                  }
                }}
                className={inputClass}
              >
                <option value="">— Обрати стандартний URI підключення —</option>
                {STANDARD_ENDPOINT_TEMPLATES.map((tpl) => (
                  <option key={tpl.url} value={tpl.url}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="srv-endpoint"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                URL Дашборду або API Ендпоінт *
              </label>
              <input
                id="srv-endpoint"
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://service.internal.noc/api/metrics"
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          {/* Row 3: Monitoring Group, Custom Group, Refresh Interval, Nodes Count */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="srv-group"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Група моніторингу
              </label>
              <select
                id="srv-group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className={smallInputClass}
              >
                {mergedGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="srv-custom-group"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Власна група (опціонально)
              </label>
              <input
                id="srv-custom-group"
                type="text"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="Напр.: Прод-кластер"
                className={smallInputClass}
              />
            </div>

            <div>
              <label
                htmlFor="srv-refresh"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Період опитування
              </label>
              <select
                id="srv-refresh"
                value={refreshIntervalSec}
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                className={`${smallInputClass} font-mono`}
              >
                {STANDARD_REFRESH_INTERVALS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="srv-nodes"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Кількість вузлів кластера
              </label>
              <select
                id="srv-nodes"
                value={nodesTotal}
                onChange={(e) => setNodesTotal(Number(e.target.value))}
                className={`${smallInputClass} font-mono`}
              >
                {STANDARD_NODE_COUNTS.map((nodeOpt) => (
                  <option key={nodeOpt.value} value={nodeOpt.value}>
                    {nodeOpt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Standardized Primary & Secondary Metrics and Units (Dropdowns) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="srv-metric-label"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Основна метрика (стандарт)
              </label>
              <select
                id="srv-metric-label"
                value={primaryMetricLabel}
                onChange={(e) => handlePrimaryMetricChange(e.target.value)}
                className={smallInputClass}
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
                htmlFor="srv-metric-unit"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Одиниця виміру (основна)
              </label>
              <select
                id="srv-metric-unit"
                value={primaryMetricUnit}
                onChange={(e) => setPrimaryMetricUnit(e.target.value)}
                className={`${smallInputClass} font-mono`}
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
                htmlFor="srv-sec-metric-label"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Додаткова метрика (стандарт)
              </label>
              <select
                id="srv-sec-metric-label"
                value={secondaryMetricLabel}
                onChange={(e) => handleSecondaryMetricChange(e.target.value)}
                className={smallInputClass}
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
                htmlFor="srv-sec-metric-unit"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Одиниця виміру (додаткова)
              </label>
              <select
                id="srv-sec-metric-unit"
                value={secondaryMetricUnit}
                onChange={(e) => setSecondaryMetricUnit(e.target.value)}
                className={`${smallInputClass} font-mono`}
              >
                {STANDARD_SECONDARY_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 5: Standardized Threshold Profile + Warning/Critical Numeric Overrides */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="srv-threshold-preset"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Профіль порогів реагування (УВАГА / ЗБІЙ)
              </label>
              <select
                id="srv-threshold-preset"
                value={thresholdPresetId}
                onChange={(e) => handleThresholdPresetChange(e.target.value)}
                className={smallInputClass}
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
                htmlFor="srv-warn"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Поріг УВАГА ({primaryMetricUnit})
              </label>
              <input
                id="srv-warn"
                type="number"
                value={warningThreshold}
                onChange={(e) => setWarningThreshold(Number(e.target.value))}
                className={`${smallInputClass} font-mono`}
              />
            </div>

            <div>
              <label
                htmlFor="srv-crit"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Поріг ЗБІЙ 30с ({primaryMetricUnit})
              </label>
              <input
                id="srv-crit"
                type="number"
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                className={`${smallInputClass} font-mono`}
              />
            </div>
          </div>

          {/* Row 6: Chart Visualization & Accent Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="srv-chart-type"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Візуалізація графіка (Chart.js)
              </label>
              <select
                id="srv-chart-type"
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartStyleType)}
                className={inputClass}
              >
                <option value="line">Лінійний графік (Chart.js Line)</option>
                <option value="bar">Стовпчикова діаграма (Chart.js Bar)</option>
                <option value="radar">Радарна діаграма (Chart.js Radar)</option>
                <option value="doughnut">Кільцева діаграма (Chart.js Doughnut)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="srv-color"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Колір лінії телеметрії
              </label>
              <div className="flex items-center gap-2 pt-1">
                {['#38BDF8', '#22C55E', '#F59E0B', '#EC4899', '#A855F7', '#06B6D4'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Колір ${c}`}
                    onClick={() => setAccentColor(c)}
                    className={`w-7 h-7 rounded-md border ${
                      accentColor === c ? 'border-white scale-110' : 'border-transparent opacity-70'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Modal Footer with Clear ("Очистити"), Cancel, and Submit */}
          <div
            className={`flex flex-wrap items-center justify-between gap-3 pt-4 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={handleClearForm}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
                isDark
                  ? 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Очистити</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  handleClearForm();
                  onClose();
                }}
                className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Скасувати
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Підключити сервіс на екран</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
