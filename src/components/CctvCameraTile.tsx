import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type { ChartStyleType, ServiceFeed } from '../utils/monitoringEngine';
import { ServiceChartRenderer } from './ChartRenderer';

interface CctvCameraTileProps {
  service: ServiceFeed;
  isDark: boolean;
  compactMode?: boolean;
  onUpdateService: (id: string, patch: Partial<ServiceFeed>) => void;
  onRecoverService: (service: ServiceFeed) => void;
  onOpenBlackbox30s: (service: ServiceFeed) => void;
  onExpandCamera: (service: ServiceFeed) => void;
  onDeleteService: (id: string) => void;
}

export const CctvCameraTile: React.FC<CctvCameraTileProps> = ({
  service,
  isDark,
  compactMode = false,
  onUpdateService,
  onRecoverService,
  onOpenBlackbox30s,
  onExpandCamera,
  onDeleteService,
}) => {
  const latest = service.ringBuffer30s[service.ringBuffer30s.length - 1];
  const primaryVal = latest ? latest.primaryValue : 0;
  const secondaryVal = latest ? latest.secondaryValue : 0;
  const latencyMs = latest ? latest.latencyMs : 0;
  const bufferSec = service.ringBuffer30s.length;

  const borderClass =
    service.status === 'critical'
      ? 'border-red-500/80 bg-red-950/15'
      : service.status === 'warning'
      ? 'border-amber-500/70 bg-amber-950/10'
      : isDark
      ? 'border-slate-800 bg-[#111827]'
      : 'border-slate-200 bg-white';

  const statusText =
    service.status === 'critical'
      ? 'КРИТИЧНИЙ ЗБІЙ'
      : service.status === 'warning'
      ? 'ПОПЕРЕДЖЕННЯ'
      : 'ШТАТНИЙ РЕЖИМ';

  const statusColor =
    service.status === 'critical'
      ? 'text-red-500 dark:text-red-400'
      : service.status === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <article
      data-testid={`camera-tile-${service.id}`}
      className={`border rounded-xl p-4 flex flex-col justify-between transition-colors ${borderClass}`}
    >
      {/* Top Camera Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Unboxed single-line metadata kicker */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap overflow-hidden">
              <span className="font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                {service.cameraCode}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{service.group}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">
                {service.nodesOnline}/{service.nodesTotal} вузлів
              </span>
            </div>

            <h2
              className={`text-base font-bold tracking-tight mt-1 truncate ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}
            >
              {service.name}
            </h2>
          </div>

          {/* Semantic Status (Icon + Text, no decorative dots or pills) */}
          <div
            className={`flex items-center gap-1.5 text-xs font-mono font-semibold shrink-0 ${statusColor}`}
          >
            {service.status === 'critical' ? (
              <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : service.status === 'warning' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span className="whitespace-nowrap">{statusText}</span>
          </div>
        </div>

        {/* Key Numeric Telemetry Row */}
        <div
          className={`grid grid-cols-3 gap-3 mt-3 py-2.5 border-y ${
            isDark ? 'border-slate-800/90' : 'border-slate-200'
          }`}
        >
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {service.primaryMetricLabel}
            </div>
            <div
              className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                service.status === 'critical'
                  ? 'text-red-500 dark:text-red-400'
                  : isDark
                  ? 'text-slate-100'
                  : 'text-slate-900'
              }`}
            >
              {primaryVal}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {service.primaryMetricUnit}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {service.secondaryMetricLabel}
            </div>
            <div
              className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}
            >
              {secondaryVal}{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {service.secondaryMetricUnit}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Відгук / Поріг</div>
            <div
              className={`text-sm font-semibold font-mono tabular-nums mt-1 ${
                latencyMs > 120
                  ? 'text-red-500 dark:text-red-400'
                  : isDark
                  ? 'text-slate-300'
                  : 'text-slate-700'
              }`}
            >
              {latencyMs} мс <span className="text-slate-500">/ {service.criticalThreshold}</span>
            </div>
          </div>
        </div>

        {/* Chart.js Real-Time Feed Canvas */}
        <div className="mt-3">
          <ServiceChartRenderer
            samples={service.ringBuffer30s}
            chartType={service.chartType}
            primaryLabel={service.primaryMetricLabel}
            primaryUnit={service.primaryMetricUnit}
            secondaryLabel={service.secondaryMetricLabel}
            secondaryUnit={service.secondaryMetricUnit}
            accentColor={service.status === 'critical' ? '#EF4444' : service.accentColor}
            fillArea={service.chartFill}
            smoothCurve={service.chartSmooth}
            warningThreshold={service.warningThreshold}
            criticalThreshold={service.criticalThreshold}
            isDark={isDark}
            heightClass={compactMode ? 'h-28' : 'h-36'}
          />
        </div>
      </div>

      {/* Camera Control Strip */}
      <div
        className={`mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${
          isDark ? 'border-slate-800/80' : 'border-slate-200'
        }`}
      >
        {/* Left: Per-camera Refresh Interval & Chart.js Type */}
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`refresh-${service.id}`}>
            Період оновлення {service.name}
          </label>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <RefreshCw className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" aria-hidden="true" />
            <select
              id={`refresh-${service.id}`}
              aria-label={`Період оновлення ${service.name}`}
              value={service.refreshIntervalSec}
              onChange={(e) =>
                onUpdateService(service.id, { refreshIntervalSec: Number(e.target.value) })
              }
              className={`rounded px-1.5 py-1 text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-slate-100 border-slate-300 text-slate-800'
              }`}
            >
              <option value={1}>1с</option>
              <option value={2}>2с</option>
              <option value={3}>3с</option>
              <option value={5}>5с</option>
              <option value={10}>10с</option>
              <option value={30}>30с</option>
            </select>
          </div>

          <label className="sr-only" htmlFor={`chart-${service.id}`}>
            Тип графіка Chart.js для {service.name}
          </label>
          <select
            id={`chart-${service.id}`}
            aria-label={`Тип графіка Chart.js для ${service.name}`}
            value={service.chartType}
            onChange={(e) =>
              onUpdateService(service.id, { chartType: e.target.value as ChartStyleType })
            }
            className={`rounded px-1.5 py-1 text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200'
                : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            <option value="line">Chart: Лінія</option>
            <option value="bar">Chart: Стовпці</option>
            <option value="radar">Chart: Радар</option>
            <option value="doughnut">Chart: Кільце</option>
          </select>
        </div>

        {/* Right: 30s Buffer / Crash Dump, Recover (if critical), Fullscreen, Delete */}
        <div className="flex items-center gap-1.5">
          {service.status === 'critical' ? (
            <>
              <button
                type="button"
                onClick={() => onOpenBlackbox30s(service)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
              >
                Метрики 30с (Дамп)
              </button>
              <button
                type="button"
                onClick={() => onRecoverService(service)}
                aria-label={`Відновити ${service.name}`}
                className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-emerald-500/50 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Відновити</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenBlackbox30s(service)}
              aria-label={`Буфер 30 секунд ${service.name}`}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Останні 30с
            </button>
          )}

          <button
            type="button"
            onClick={() => onExpandCamera(service)}
            title="Повноекранний режим камери"
            aria-label={`Розгорнути камеру ${service.name}`}
            className={`p-1.5 rounded-md border transition-colors shrink-0 ${
              isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onDeleteService(service.id)}
            title={`Видалити сервіс ${service.name}`}
            aria-label={`Видалити сервіс ${service.name}`}
            className={`p-1.5 rounded-md border transition-colors shrink-0 ${
              isDark
                ? 'border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-950/30'
                : 'border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
};
