import React, { useEffect, useState } from 'react';
import { BarChart3, Plus, Trash2 } from 'lucide-react';
import type {
  ChartStyleType,
  CustomDashboardWidget,
  MetricSample,
  ServiceFeed,
} from '../utils/monitoringEngine';
import { ServiceChartRenderer } from './ChartRenderer';

interface CustomDashboardViewProps {
  services: ServiceFeed[];
  widgets: CustomDashboardWidget[];
  isDark: boolean;
  onAddWidget: (widget: CustomDashboardWidget) => void;
  onUpdateWidget: (id: string, patch: Partial<CustomDashboardWidget>) => void;
  onDeleteWidget: (id: string) => void;
  onOpenAddService: () => void;
}

export const CustomDashboardView: React.FC<CustomDashboardViewProps> = ({
  services,
  widgets,
  isDark,
  onAddWidget,
  onUpdateWidget,
  onDeleteWidget,
  onOpenAddService,
}) => {
  const [title, setTitle] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '');
  const [chartType, setChartType] = useState<ChartStyleType>('line');
  const [metricField, setMetricField] =
    useState<CustomDashboardWidget['metricField']>('primaryValue');
  const [timeWindowSec, setTimeWindowSec] = useState<15 | 20 | 30>(30);
  const [smoothCurve, setSmoothCurve] = useState(true);
  const [fillArea, setFillArea] = useState(true);

  useEffect(() => {
    if (services.length > 0 && !services.some((s) => s.id === selectedServiceId)) {
      setSelectedServiceId(services[0].id);
    }
  }, [services, selectedServiceId]);

  const handleCreateWidget = (e: React.FormEvent) => {
    e.preventDefault();
    const targetSrv = services.find((s) => s.id === selectedServiceId) || services[0];
    if (!targetSrv) return;

    const metricLabelMap: Record<CustomDashboardWidget['metricField'], string> = {
      primaryValue: targetSrv.primaryMetricLabel,
      secondaryValue: targetSrv.secondaryMetricLabel,
      latencyMs: 'Затримка відгуку (мс)',
      errorRate: 'Частка помилок (%)',
    };

    const newWidget: CustomDashboardWidget = {
      id: `wdg-${Date.now()}`,
      title:
        title.trim() ||
        `${targetSrv.name}: ${metricLabelMap[metricField]} (${timeWindowSec}с)`,
      serviceIds: [targetSrv.id],
      chartType,
      metricField,
      timeWindowSec,
      showThresholdLine: true,
      smoothCurve,
      fillArea,
    };

    onAddWidget(newWidget);
    setTitle('');
  };

  return (
    <section className="space-y-6" aria-label="Конструктор дашбордів Chart.js">
      {/* Builder Form */}
      <div
        className={`rounded-xl border p-5 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 text-xs font-mono text-sky-600 dark:text-sky-400">
          <BarChart3 className="w-4 h-4" />
          <span>КОНСТРУКТОР ДАШБОРДІВ ТА ВІЗУАЛІЗАЦІЇ CHART.JS</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight mt-1">
          Створення користувацьких віджетів на основі зібраних метрик
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Комбінуйте потоки телеметрії ваших підключених сервісів та налаштовуйте параметри візуалізації Chart.js
        </p>

        {services.length === 0 ? (
          <div
            className={`mt-4 rounded-lg border p-6 text-center ${
              isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Спочатку підключіть хоча б один робочий сервіс, щоб створювати спеціалізовані графіки Chart.js на основі його метрик.
            </p>
            <button
              type="button"
              onClick={onOpenAddService}
              className="mt-3 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Підключити сервіс</span>
            </button>
          </div>
        ) : (
          <>
            <form
              onSubmit={handleCreateWidget}
              className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
            >
              <div className="md:col-span-2">
                <label
                  htmlFor="wdg-title"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Назва графіка / Дашборду
                </label>
                <input
                  id="wdg-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Напр.: Аналіз затримок Ceph та Redis"
                  className={`w-full px-3 py-2 text-xs rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label
                  htmlFor="wdg-service"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Джерело (Сервіс)
                </label>
                <select
                  id="wdg-service"
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className={`w-full px-2.5 py-2 text-xs rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.cameraCode} · {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="wdg-metric"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Цільова метрика
                </label>
                <select
                  id="wdg-metric"
                  value={metricField}
                  onChange={(e) =>
                    setMetricField(e.target.value as CustomDashboardWidget['metricField'])
                  }
                  className={`w-full px-2.5 py-2 text-xs rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="primaryValue">Основна метрика сервісу</option>
                  <option value="secondaryValue">Додаткова метрика сервісу</option>
                  <option value="latencyMs">Затримка мережі / запиту (мс)</option>
                  <option value="errorRate">Частка помилок (%)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="wdg-chart-type"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                >
                  Тип Chart.js
                </label>
                <select
                  id="wdg-chart-type"
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as ChartStyleType)}
                  className={`w-full px-2.5 py-2 text-xs rounded-lg border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-100'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="line">Лінія (Line)</option>
                  <option value="bar">Стовпці (Bar)</option>
                  <option value="radar">Радар (Radar)</option>
                  <option value="doughnut">Кільце (Doughnut)</option>
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Додати графік</span>
                </button>
              </div>
            </form>

            {/* Chart.js Fine-Tuning Toggles */}
            <div
              className={`mt-3 pt-3 border-t flex flex-wrap items-center gap-5 text-xs ${
                isDark ? 'border-slate-800/80 text-slate-300' : 'border-slate-200 text-slate-700'
              }`}
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smoothCurve}
                  onChange={(e) => setSmoothCurve(e.target.checked)}
                  className="rounded border-slate-700"
                />
                <span>Згладжування кривої Безьє (Tension)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fillArea}
                  onChange={(e) => setFillArea(e.target.checked)}
                  className="rounded border-slate-700"
                />
                <span>Заливка площі під графіком (Filler)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Вікно вибірки:</span>
                {([15, 20, 30] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setTimeWindowSec(sec)}
                    className={`px-2 py-0.5 rounded font-mono text-xs ${
                      timeWindowSec === sec
                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {sec}с
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rendered Custom Widgets Grid */}
      {widgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {widgets.map((widget) => {
            const srv =
              services.find((s) => s.id === widget.serviceIds[0]) || services[0];
            if (!srv) return null;

            // Project the selected metricField into primaryValue for the Chart.js renderer
            const mappedSamples: MetricSample[] = srv.ringBuffer30s
              .slice(-widget.timeWindowSec)
              .map((sample) => ({
                ...sample,
                primaryValue:
                  widget.metricField === 'secondaryValue'
                    ? sample.secondaryValue
                    : widget.metricField === 'latencyMs'
                    ? sample.latencyMs
                    : widget.metricField === 'errorRate'
                    ? sample.errorRate
                    : sample.primaryValue,
              }));

            const unitLabel =
              widget.metricField === 'secondaryValue'
                ? srv.secondaryMetricUnit
                : widget.metricField === 'latencyMs'
                ? 'мс'
                : widget.metricField === 'errorRate'
                ? '%'
                : srv.primaryMetricUnit;

            return (
              <div
                key={widget.id}
                className={`rounded-xl border p-4 flex flex-col justify-between ${
                  isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {srv.cameraCode} · {srv.group} · Вікно {widget.timeWindowSec}с
                    </div>
                    <h3 className="text-sm font-bold mt-0.5">{widget.title}</h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label={`Змінити тип графіка ${widget.title}`}
                      value={widget.chartType}
                      onChange={(e) =>
                        onUpdateWidget(widget.id, {
                          chartType: e.target.value as ChartStyleType,
                        })
                      }
                      className={`px-2 py-1 text-xs font-mono rounded border ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-slate-200'
                          : 'bg-slate-100 border-slate-300 text-slate-800'
                      }`}
                    >
                      <option value="line">Лінія</option>
                      <option value="bar">Стовпці</option>
                      <option value="radar">Радар</option>
                      <option value="doughnut">Кільце</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => onDeleteWidget(widget.id)}
                      aria-label={`Видалити графік ${widget.title}`}
                      className={`p-1.5 rounded border transition-colors ${
                        isDark
                          ? 'border-slate-700 text-slate-400 hover:text-red-400'
                          : 'border-slate-300 text-slate-500 hover:text-red-600'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <ServiceChartRenderer
                  samples={mappedSamples}
                  chartType={widget.chartType}
                  primaryLabel={widget.title}
                  primaryUnit={unitLabel}
                  accentColor={srv.accentColor}
                  fillArea={widget.fillArea}
                  smoothCurve={widget.smoothCurve}
                  isDark={isDark}
                  heightClass="h-52"
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
