import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import {
  captureCrashBlackbox,
  type CrashBlackboxReport,
  type ServiceFeed,
} from '../utils/monitoringEngine';
import { ServiceChartRenderer } from './ChartRenderer';

interface Blackbox30sViewProps {
  services: ServiceFeed[];
  blackboxReports: CrashBlackboxReport[];
  selectedServiceId: string | null;
  isDark: boolean;
  onSelectService: (id: string) => void;
  onRecoverService: (service: ServiceFeed) => void;
  onDispatchAlert: (channel: 'telegram' | 'slack', message: string, serviceName: string) => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onOpenAddService: () => void;
}

export const Blackbox30sView: React.FC<Blackbox30sViewProps> = ({
  services,
  blackboxReports,
  selectedServiceId,
  isDark,
  onSelectService,
  onRecoverService,
  onDispatchAlert,
  onExportCsv,
  onExportPdf,
  onOpenAddService,
}) => {
  const [windowSeconds, setWindowSeconds] = useState<20 | 25 | 30>(30);

  const activeService =
    services.find((s) => s.id === selectedServiceId) ||
    services.find((s) => s.status === 'critical') ||
    services[0];

  if (!activeService) {
    return (
      <section
        aria-label="Чорна скринька останніх 20-30 секунд метрик"
        className={`rounded-xl border p-12 text-center ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <ShieldAlert className="w-8 h-8 text-sky-500 dark:text-sky-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold">
          Інспектор Чорної скриньки (20–30 секунд) очікує підключення сервісів
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
          Підключіть робочі сервіси (Wazuh SIEM, Zabbix, Ceph/Seph, Redis, RabbitMQ або власний API-ендпоінт), щоб у реальному часі записувати 30-секундний кільцевий буфер метрик.
        </p>
        <div className="mt-4 flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenAddService}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Підключити сервіс</span>
          </button>
        </div>
      </section>
    );
  }

  // Find latest recorded crash report for this service, or synthesize live 30s snapshot inspection
  const existingCrashReport = blackboxReports.find((r) => r.serviceId === activeService.id);
  const effectiveReport: CrashBlackboxReport =
    existingCrashReport ||
    captureCrashBlackbox(
      activeService,
      activeService.status === 'critical'
        ? 'Автоматичний аварійний дамп при перевищенні критичного порогу'
        : 'Живий інспектор кільцевого буфера останніх 30 секунд'
    );

  const displayedSamples = activeService.ringBuffer30s.slice(-windowSeconds);

  return (
    <section className="space-y-6" aria-label="Чорна скринька останніх 20-30 секунд метрик">
      {/* Top Control & Service Selector Bar */}
      <div
        className={`rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-sky-600 dark:text-sky-400">
            <span>ЧОРНА СКРИНЬКА (FLIGHT RECORDER)</span>
            <span aria-hidden="true">·</span>
            <span>КІЛЬЦЕВИЙ БУФЕР 20–30 СЕКУНД</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1">
            Аналіз збою та метрики за останні {windowSeconds} секунд: {activeService.name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Посекундна фіксація телеметрії перед моментом системного збою для миттєвої діагностики першопричини
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Window length selector: 20s / 25s / 30s */}
          <div
            className={`flex items-center p-1 rounded-lg border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300'
            }`}
          >
            {([20, 25, 30] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setWindowSeconds(sec)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap ${
                  windowSeconds === sec
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Останні {sec}с
              </button>
            ))}
          </div>

          {activeService.status === 'critical' && (
            <button
              type="button"
              onClick={() => onRecoverService(activeService)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Відновити сервіс</span>
            </button>
          )}
        </div>
      </div>

      {/* Camera Feed Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {services.map((srv) => {
          const isSelected = srv.id === activeService.id;
          return (
            <button
              key={srv.id}
              type="button"
              onClick={() => onSelectService(srv.id)}
              className={`px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                isSelected
                  ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold'
                  : isDark
                  ? 'border-slate-800 bg-[#111827] text-slate-300 hover:border-slate-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="font-mono text-slate-500 dark:text-slate-400">{srv.cameraCode}</span>
              <span>{srv.name}</span>
              {srv.status === 'critical' ? (
                <ShieldAlert className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
              ) : srv.status === 'warning' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Root Cause Forensic Diagnosis Card ("Що пішло не так") */}
      <div
        className={`rounded-xl border p-5 ${
          activeService.status === 'critical'
            ? 'border-red-500/70 bg-red-950/20'
            : isDark
            ? 'border-slate-800 bg-[#111827]'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-red-500 dark:text-red-400">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>ДІАГНОСТИКА ПРИЧИНИ ІНЦИДЕНТУ («ЩО ПІШЛО НЕ ТАК»)</span>
            </div>
            <h3 className="text-base font-bold">{effectiveReport.triggerReason}</h3>
            <p
              className={`text-sm leading-relaxed ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}
            >
              {effectiveReport.rootCauseDiagnosis}
            </p>
            <div
              className={`pt-2 border-t text-xs ${
                isDark ? 'border-slate-800/80 text-slate-300' : 'border-slate-200 text-slate-700'
              }`}
            >
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                План відновлення:{' '}
              </span>
              {effectiveReport.recommendedAction}
            </div>
          </div>

          <div
            className={`rounded-lg border p-4 flex flex-col justify-between ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Пік за {windowSeconds}с
                </div>
                <div className="text-lg font-bold text-red-500 dark:text-red-400 mt-0.5">
                  {effectiveReport.peakPrimaryValue} {activeService.primaryMetricUnit}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Середнє за {windowSeconds}с
                </div>
                <div className="text-lg font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                  {effectiveReport.avgPrimaryValue} {activeService.primaryMetricUnit}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Пікова затримка</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {effectiveReport.peakLatencyMs} мс
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Зібрано точок</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {displayedSamples.length} сек (1 Гц)
                </div>
              </div>
            </div>

            <div
              className={`mt-4 pt-3 border-t flex flex-wrap gap-2 ${
                isDark ? 'border-slate-800' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  onDispatchAlert(
                    'telegram',
                    `🚨 [ЧОРНА СКРИНЬКА ${windowSeconds}С] ${activeService.name}: Пік ${effectiveReport.peakPrimaryValue} ${activeService.primaryMetricUnit} (${effectiveReport.peakLatencyMs} мс). ${effectiveReport.rootCauseDiagnosis}`,
                    activeService.name
                  )
                }
                className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/30 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Дамп у Telegram</span>
              </button>
              <button
                type="button"
                onClick={onExportCsv}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1 whitespace-nowrap ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={onExportPdf}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1 whitespace-nowrap ${
                  isDark
                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* High-Resolution Chart.js Timeline of the Last 20-30 Seconds */}
      <div
        className={`rounded-xl border p-5 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold">
              Графік Chart.js за останні {windowSeconds} секунд до теперішнього моменту / збою
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Відображено посекундний зріз метрик `{activeService.primaryMetricLabel}` та `{activeService.secondaryMetricLabel}`
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Інтервал: -{displayedSamples.length - 1}с ... 0с
          </span>
        </div>

        <ServiceChartRenderer
          samples={displayedSamples}
          chartType="line"
          primaryLabel={activeService.primaryMetricLabel}
          primaryUnit={activeService.primaryMetricUnit}
          secondaryLabel={activeService.secondaryMetricLabel}
          secondaryUnit={activeService.secondaryMetricUnit}
          accentColor={activeService.status === 'critical' ? '#EF4444' : activeService.accentColor}
          fillArea={true}
          smoothCurve={false}
          warningThreshold={activeService.warningThreshold}
          criticalThreshold={activeService.criticalThreshold}
          showDualMetrics={true}
          isDark={isDark}
          heightClass="h-64"
        />
      </div>

      {/* Second-by-Second Telemetry Table (Last 20-30 Seconds) */}
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
          <h3 className="text-sm font-bold">
            Посекундна таблиця отриманих метрик (останні {displayedSamples.length} секунд)
          </h3>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Частота дискретизації: 1.0 сек
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b font-mono ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-800 text-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <th className="py-2.5 px-4">Відлік (сек)</th>
                <th className="py-2.5 px-4">Точний час (ISO)</th>
                <th className="py-2.5 px-4 text-right">
                  {activeService.primaryMetricLabel} ({activeService.primaryMetricUnit})
                </th>
                <th className="py-2.5 px-4 text-right">
                  {activeService.secondaryMetricLabel} ({activeService.secondaryMetricUnit})
                </th>
                <th className="py-2.5 px-4 text-right">Затримка (мс)</th>
                <th className="py-2.5 px-4 text-right">Помилки (%)</th>
                <th className="py-2.5 px-4">Стан / Діагностика</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y font-mono tabular-nums ${
                isDark ? 'divide-slate-800/60' : 'divide-slate-200'
              }`}
            >
              {[...displayedSamples].reverse().map((sample) => (
                <tr
                  key={`${sample.epochMs}-${sample.relativeSec}`}
                  className={
                    sample.status === 'critical'
                      ? 'bg-red-950/30 text-red-200'
                      : sample.status === 'warning'
                      ? 'bg-amber-950/20 text-amber-200'
                      : isDark
                      ? 'hover:bg-slate-800/40 text-slate-300'
                      : 'hover:bg-slate-50 text-slate-700'
                  }
                >
                  <td className="py-2 px-4 font-semibold text-sky-600 dark:text-sky-400">
                    {sample.relativeSec} сек
                  </td>
                  <td className="py-2 px-4 text-slate-500 dark:text-slate-400">
                    {new Date(sample.timestamp).toLocaleTimeString('uk-UA')}
                  </td>
                  <td className="py-2 px-4 text-right font-bold">{sample.primaryValue}</td>
                  <td className="py-2 px-4 text-right">{sample.secondaryValue}</td>
                  <td className="py-2 px-4 text-right">{sample.latencyMs} мс</td>
                  <td className="py-2 px-4 text-right">{sample.errorRate}%</td>
                  <td className="py-2 px-4 font-sans">
                    <span
                      className={
                        sample.status === 'critical'
                          ? 'text-red-500 dark:text-red-400 font-semibold'
                          : sample.status === 'warning'
                          ? 'text-amber-600 dark:text-amber-400 font-semibold'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }
                    >
                      {sample.status === 'critical'
                        ? 'ЗБІЙ: '
                        : sample.status === 'warning'
                        ? 'УВАГА: '
                        : 'ОК: '}
                    </span>
                    <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>
                      {sample.note || 'Телеметрія в нормі'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
