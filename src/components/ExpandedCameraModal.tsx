import React from 'react';
import { RotateCcw, ShieldAlert, X } from 'lucide-react';
import type { ServiceFeed } from '../utils/monitoringEngine';
import { ServiceChartRenderer } from './ChartRenderer';

interface ExpandedCameraModalProps {
  service: ServiceFeed | null;
  isDark: boolean;
  onClose: () => void;
  onRecoverService: (service: ServiceFeed) => void;
  onOpenBlackbox30s: (service: ServiceFeed) => void;
}

export const ExpandedCameraModal: React.FC<ExpandedCameraModalProps> = ({
  service,
  isDark,
  onClose,
  onRecoverService,
  onOpenBlackbox30s,
}) => {
  if (!service) return null;

  const latest = service.ringBuffer30s[service.ringBuffer30s.length - 1];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="expanded-cam-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
    >
      <div
        className={`w-full max-w-4xl rounded-xl border p-6 shadow-2xl ${
          isDark
            ? 'bg-[#0F172A] border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div
          className={`flex items-start justify-between gap-4 pb-4 border-b ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div>
            <div className="text-xs font-mono text-sky-600 dark:text-sky-400">
              {service.cameraCode} · {service.group} · Ендпоінт: {service.endpointUrl}
            </div>
            <h2 id="expanded-cam-title" className="text-2xl font-bold mt-1">
              {service.name} — Повноекранний монітор
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити повноекранний режим камери"
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-4 font-mono tabular-nums">
          <div
            className={`p-3 rounded-lg border ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {service.primaryMetricLabel}
            </div>
            <div className="text-xl font-bold mt-1">
              {latest?.primaryValue ?? 0} {service.primaryMetricUnit}
            </div>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {service.secondaryMetricLabel}
            </div>
            <div className="text-xl font-bold mt-1">
              {latest?.secondaryValue ?? 0} {service.secondaryMetricUnit}
            </div>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">Затримка (Latency)</div>
            <div className="text-xl font-bold mt-1">{latest?.latencyMs ?? 0} мс</div>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">Кільцевий буфер збою</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {service.ringBuffer30s.length} сек (1 Гц)
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <ServiceChartRenderer
            samples={service.ringBuffer30s}
            chartType={service.chartType}
            primaryLabel={service.primaryMetricLabel}
            primaryUnit={service.primaryMetricUnit}
            secondaryLabel={service.secondaryMetricLabel}
            secondaryUnit={service.secondaryMetricUnit}
            accentColor={service.status === 'critical' ? '#EF4444' : service.accentColor}
            fillArea={true}
            smoothCurve={service.chartSmooth}
            warningThreshold={service.warningThreshold}
            criticalThreshold={service.criticalThreshold}
            showDualMetrics={true}
            isDark={isDark}
            heightClass="h-72"
          />
        </div>

        <div
          className={`mt-5 pt-4 border-t flex flex-wrap items-center justify-between gap-3 ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {service.status === 'critical' && (
              <button
                type="button"
                onClick={() => onRecoverService(service)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Відновити роботу</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenBlackbox30s(service);
              }}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
                isDark
                  ? 'border-sky-500/50 text-sky-300 hover:bg-sky-950/40'
                  : 'border-sky-300 text-sky-700 hover:bg-sky-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Відкрити дамп останніх 30 секунд</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
};
