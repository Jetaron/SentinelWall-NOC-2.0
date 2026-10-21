import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  seedInitial30sBuffer,
  type ChartStyleType,
  type ServiceFeed,
} from '../utils/monitoringEngine';

interface AddServiceModalProps {
  isOpen: boolean;
  isDark: boolean;
  existingCount: number;
  availableGroups: string[];
  onClose: () => void;
  onAddService: (newService: ServiceFeed) => void;
}

const PRESET_TEMPLATES = [
  {
    label: 'Wazuh SIEM',
    type: 'wazuh' as const,
    group: 'Безпека (SIEM)',
    endpoint: 'https://wazuh.internal.noc:55000/v4/events',
    primaryLabel: 'Події безпеки (EPS)',
    primaryUnit: 'подій/с',
    secondaryLabel: 'Критичні FIM тригери',
    secondaryUnit: 'алертів',
    warn: 350,
    crit: 480,
    color: '#38BDF8',
  },
  {
    label: 'Zabbix Server',
    type: 'zabbix' as const,
    group: 'Інфраструктура',
    endpoint: 'https://zabbix.internal.noc/api_jsonrpc.php',
    primaryLabel: 'Завантаження CPU',
    primaryUnit: '%',
    secondaryLabel: 'Черга тригерів Zabbix',
    secondaryUnit: 'вузлів',
    warn: 75,
    crit: 90,
    color: '#22C55E',
  },
  {
    label: 'Ceph (Seph) Storage',
    type: 'ceph' as const,
    group: 'Сховище даних',
    endpoint: 'https://ceph-rgw.internal.noc:8443/api/osd',
    primaryLabel: 'Пропускна здатність пулу',
    primaryUnit: 'kIOPS',
    secondaryLabel: 'Латентність комміту',
    secondaryUnit: 'мс',
    warn: 80,
    crit: 105,
    color: '#F59E0B',
  },
  {
    label: 'Redis Cluster',
    type: 'redis' as const,
    group: 'Черги та Кеш',
    endpoint: 'redis://redis-cluster.internal.noc:6379/info',
    primaryLabel: 'Операцій читання/запису',
    primaryUnit: 'тис. ops/s',
    secondaryLabel: "Фрагментація пам'яті",
    secondaryUnit: '%',
    warn: 115,
    crit: 150,
    color: '#EC4899',
  },
  {
    label: 'RabbitMQ Broker',
    type: 'rabbitmq' as const,
    group: 'Черги та Кеш',
    endpoint: 'https://rabbitmq.internal.noc:15672/api/queues',
    primaryLabel: 'Непідтверджені (Unacked)',
    primaryUnit: 'тис. msg',
    secondaryLabel: 'Активні консьюмери',
    secondaryUnit: 'воркерів',
    warn: 40,
    crit: 65,
    color: '#A855F7',
  },
  {
    label: 'Prometheus / Kubernetes',
    type: 'custom' as const,
    group: 'Інфраструктура',
    endpoint: 'https://prometheus.internal.noc:9090/api/v1/query',
    primaryLabel: "Споживання пам'яті Pod-ів",
    primaryUnit: 'ГБ',
    secondaryLabel: 'Перезапуски контейнерів',
    secondaryUnit: 'шт/год',
    warn: 64,
    crit: 80,
    color: '#06B6D4',
  },
];

export const AddServiceModal: React.FC<AddServiceModalProps> = ({
  isOpen,
  isDark,
  existingCount,
  availableGroups,
  onClose,
  onAddService,
}) => {
  const [name, setName] = useState('');
  const [serviceType, setServiceType] = useState<ServiceFeed['serviceType']>('custom');
  const [group, setGroup] = useState(availableGroups[0] || 'Інфраструктура');
  const [customGroup, setCustomGroup] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('https://metrics.internal.noc:9100/api/v1/status');
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(2);
  const [primaryMetricLabel, setPrimaryMetricLabel] = useState('Навантаження сервісу');
  const [primaryMetricUnit, setPrimaryMetricUnit] = useState('%');
  const [secondaryMetricLabel, setSecondaryMetricLabel] = useState("Активні з'єднання");
  const [secondaryMetricUnit, setSecondaryMetricUnit] = useState('клієнтів');
  const [warningThreshold, setWarningThreshold] = useState(75);
  const [criticalThreshold, setCriticalThreshold] = useState(90);
  const [chartType, setChartType] = useState<ChartStyleType>('line');
  const [accentColor, setAccentColor] = useState('#38BDF8');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const applyPreset = (preset: (typeof PRESET_TEMPLATES)[number]) => {
    setName(preset.label);
    setServiceType(preset.type);
    setGroup(preset.group);
    setEndpointUrl(preset.endpoint);
    setPrimaryMetricLabel(preset.primaryLabel);
    setPrimaryMetricUnit(preset.primaryUnit);
    setSecondaryMetricLabel(preset.secondaryLabel);
    setSecondaryMetricUnit(preset.secondaryUnit);
    setWarningThreshold(preset.warn);
    setCriticalThreshold(preset.crit);
    setAccentColor(preset.color);
    setErrorMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Будь ласка, введіть назву сервісу або оберіть шаблон вище.');
      return;
    }
    if (!endpointUrl.trim()) {
      setErrorMessage('Вкажіть URL ендпоінту або адресу підключення.');
      return;
    }

    const finalGroup = customGroup.trim() ? customGroup.trim() : group;
    const camNum = String(existingCount + 1).padStart(2, '0');
    const now = Date.now();

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
      primaryMetricLabel: primaryMetricLabel.trim() || 'Основна метрика',
      primaryMetricUnit: primaryMetricUnit.trim() || 'од.',
      secondaryMetricLabel: secondaryMetricLabel.trim() || 'Додаткова метрика',
      secondaryMetricUnit: secondaryMetricUnit.trim() || 'од.',
      warningThreshold: Number(warningThreshold) || 75,
      criticalThreshold: Number(criticalThreshold) || 95,
      chartType,
      chartFill: true,
      chartSmooth: true,
      accentColor,
      nodesOnline: 16,
      nodesTotal: 16,
      lastUpdated: new Date(now).toISOString(),
      ringBuffer30s: seedInitial30sBuffer(
        Number((warningThreshold * 0.6).toFixed(1)),
        24,
        14,
        Number(warningThreshold) || 75,
        Number(criticalThreshold) || 95,
        now
      ),
    };

    onAddService(newService);
    setName('');
    setCustomGroup('');
    setErrorMessage('');
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
        className={`w-full max-w-2xl rounded-xl border p-6 shadow-2xl ${
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
              Вкажіть параметри вашого дашборду або оберіть шаблон (Wazuh SIEM, Zabbix, Ceph/Seph, Redis, RabbitMQ) для швидкого заповнення метрик
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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

        {/* Quick Templates */}
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Швидкі шаблони конфігурації метрик:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  isDark
                    ? 'border-slate-700 bg-slate-900/90 text-slate-200 hover:border-sky-500/60 hover:text-sky-300'
                    : 'border-slate-300 bg-slate-100 text-slate-800 hover:border-sky-500 hover:text-sky-700'
                }`}
              >
                + {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/60 text-xs text-red-200">
              {errorMessage}
            </div>
          )}

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
                onChange={(e) => setName(e.target.value)}
                placeholder="Напр.: Wazuh SIEM або Ceph Storage"
                className={inputClass}
              />
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                className={inputClass}
              >
                {availableGroups.map((g) => (
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
                Або нова група (необов'язково)
              </label>
              <input
                id="srv-custom-group"
                type="text"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="Напр.: Хмарні БД"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="srv-refresh"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Період оновлення даних (сек)
              </label>
              <select
                id="srv-refresh"
                value={refreshIntervalSec}
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
                className={`${inputClass} font-mono`}
              >
                <option value={1}>Кожну 1 секунду</option>
                <option value={2}>Кожні 2 секунди</option>
                <option value={3}>Кожні 3 секунди</option>
                <option value={5}>Кожні 5 секунд</option>
                <option value={10}>Кожні 10 секунд</option>
                <option value={30}>Кожні 30 секунд</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="srv-metric-label"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Основна метрика
              </label>
              <input
                id="srv-metric-label"
                type="text"
                value={primaryMetricLabel}
                onChange={(e) => setPrimaryMetricLabel(e.target.value)}
                className={smallInputClass}
              />
            </div>
            <div>
              <label
                htmlFor="srv-metric-unit"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Одиниця виміру
              </label>
              <input
                id="srv-metric-unit"
                type="text"
                value={primaryMetricUnit}
                onChange={(e) => setPrimaryMetricUnit(e.target.value)}
                className={`${smallInputClass} font-mono`}
              />
            </div>
            <div>
              <label
                htmlFor="srv-warn"
                className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
              >
                Поріг УВАГА
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
                Поріг ЗБІЙ (Дамп 30с)
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
              <div className="flex items-center gap-2">
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

          <div
            className={`flex items-center justify-end gap-3 pt-4 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
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
        </form>
      </div>
    </div>
  );
};
