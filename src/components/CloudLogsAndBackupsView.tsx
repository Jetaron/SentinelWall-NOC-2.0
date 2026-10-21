import React, { useState } from 'react';
import {
  ArchiveRestore,
  Cloud,
  Download,
  HardDriveDownload,
  Search,
  ShieldAlert,
} from 'lucide-react';
import {
  filterQueryLogs,
  type CloudBackupSnapshot,
  type CloudQueryLog,
} from '../utils/monitoringEngine';

interface CloudLogsAndBackupsViewProps {
  logs: CloudQueryLog[];
  backups: CloudBackupSnapshot[];
  availableGroups: string[];
  cloudLastSynced: string;
  isDark: boolean;
  onCreateBackup: (label: string) => void;
  onRestoreBackup: (snapshot: CloudBackupSnapshot) => void;
}

export const CloudLogsAndBackupsView: React.FC<CloudLogsAndBackupsViewProps> = ({
  logs,
  backups,
  availableGroups,
  cloudLastSynced,
  isDark,
  onCreateBackup,
  onRestoreBackup,
}) => {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [backupLabel, setBackupLabel] = useState('');
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);

  const filteredLogs = filterQueryLogs(logs, {
    search,
    group: selectedGroup,
    status: selectedStatus,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const applyDatePreset = (secondsAgo: number | null) => {
    if (secondsAgo === null) {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const now = new Date();
    const from = new Date(now.getTime() - secondsAgo * 1000);
    setDateFrom(from.toISOString().slice(0, 16));
    setDateTo(now.toISOString().slice(0, 16));
  };

  const handleCreateBackupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateBackup(backupLabel);
    setBackupLabel('');
  };

  const handleRestoreClick = (snapshot: CloudBackupSnapshot) => {
    onRestoreBackup(snapshot);
    setRestoredNotice(
      `Успішно відновлено стан системи та історію логів із бекапу «${snapshot.label}» (${new Date(
        snapshot.createdAt
      ).toLocaleTimeString('uk-UA')})`
    );
    setTimeout(() => setRestoredNotice(null), 5000);
  };

  const downloadBackupJson = (snapshot: CloudBackupSnapshot) => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinelwall-backup-${snapshot.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6" aria-label="Хмарний журнал запитів та центр бекапів">
      {/* Section 1: Cloud Backup & Disaster Recovery Center */}
      <div
        className={`rounded-xl border p-5 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-sky-600 dark:text-sky-400">
              <Cloud className="w-4 h-4" />
              <span>ХМАРНЕ СХОВИЩЕ ІСТОРІЇ ЗАПИТІВ ТА АВТОМАТИЧНИЙ БЕКАП ЛОГІВ</span>
              <span aria-hidden="true">·</span>
              <span>Синхронізовано: {new Date(cloudLastSynced).toLocaleTimeString('uk-UA')}</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight mt-1">
              Резервне копіювання логів та відновлення після системних збоїв
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Кожен бекап фіксує стан камер, історію запитів, 30-секундні дампи та автоматичний діагноз інцидентів
            </p>
          </div>

          <form onSubmit={handleCreateBackupSubmit} className="flex items-center gap-2">
            <label htmlFor="backup-label-input" className="sr-only">
              Назва точки відновлення
            </label>
            <input
              id="backup-label-input"
              type="text"
              value={backupLabel}
              onChange={(e) => setBackupLabel(e.target.value)}
              placeholder="Мітка бекапу (напр. Перед оновленням)"
              className={`px-3 py-2 text-xs rounded-lg border w-64 ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-sky-500 text-slate-950 hover:bg-sky-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <HardDriveDownload className="w-4 h-4" />
              <span>Створити бекап</span>
            </button>
          </form>
        </div>

        {restoredNotice && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/50 text-xs text-emerald-200 font-medium">
            {restoredNotice}
          </div>
        )}

        {/* Stored Backups List */}
        {backups.length === 0 ? (
          <div
            className={`mt-4 rounded-lg border p-6 text-center text-xs text-slate-500 dark:text-slate-400 ${
              isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}
          >
            Резервних копій ще не створено. Натисніть «Створити бекап» вище або система створить його автоматично при фіксації критичного збою.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {backups.map((bkp) => (
              <div
                key={bkp.id}
                className={`rounded-lg border p-3.5 flex flex-col justify-between ${
                  isDark ? 'bg-slate-900/75 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span>{new Date(bkp.createdAt).toLocaleString('uk-UA')}</span>
                    <span>
                      {bkp.servicesCount} камер · {bkp.logsCount} логів
                    </span>
                  </div>
                  <h3 className="text-sm font-bold mt-1">{bkp.label}</h3>
                  <p
                    className={`text-xs mt-1.5 leading-relaxed ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}
                  >
                    <span className="font-semibold text-sky-600 dark:text-sky-400">
                      Аналіз стану:{' '}
                    </span>
                    {bkp.forensicSummary}
                  </p>
                </div>

                <div
                  className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleRestoreClick(bkp)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    <span>Відновити дані</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadBackupJson(bkp)}
                    aria-label={`Завантажити JSON бекапу ${bkp.label}`}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1 whitespace-nowrap ${
                      isDark
                        ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Integrated Search & Date Filtering Bar */}
      <div
        className={`rounded-xl border p-5 ${
          isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold">
              Історія запитів у хмарному сховищі ({filteredLogs.length} із {logs.length} записів)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Миттєвий пошук за текстом, фільтрація за діапазоном дат, групою та критичністю події
            </p>
          </div>

          {/* Quick Date Range Filter Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 dark:text-slate-400 mr-1">Швидкий період:</span>
            <button
              type="button"
              onClick={() => applyDatePreset(null)}
              className={`px-2.5 py-1 rounded border font-mono ${
                !dateFrom && !dateTo
                  ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Усі дати
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset(30)}
              className={`px-2.5 py-1 rounded border font-mono ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Останні 30 сек
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset(300)}
              className={`px-2.5 py-1 rounded border font-mono ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Останні 5 хв
            </button>
            <button
              type="button"
              onClick={() => applyDatePreset(86400)}
              className={`px-2.5 py-1 rounded border font-mono ${
                isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              За добу (24г)
            </button>
          </div>
        </div>

        {/* Filter Inputs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <label
              htmlFor="cloud-log-search"
              className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              Пошук у логах та запитах
            </label>
            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"
                aria-hidden="true"
              />
              <input
                id="cloud-log-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Пошук: Wazuh, Ceph, Seph, Zabbix..."
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="log-date-from"
              className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              Від дати та часу
            </label>
            <input
              id="log-date-from"
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`w-full px-2.5 py-2 text-xs font-mono rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div>
            <label
              htmlFor="log-date-to"
              className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
            >
              До дати та часу
            </label>
            <input
              id="log-date-to"
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={`w-full px-2.5 py-2 text-xs font-mono rounded-lg border ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-100'
                  : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="log-group-filter"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Група
              </label>
              <select
                id="log-group-filter"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className={`w-full px-2 py-2 text-xs rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">Усі групи</option>
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="log-status-filter"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Статус
              </label>
              <select
                id="log-status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className={`w-full px-2 py-2 text-xs rounded-lg border ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100'
                    : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              >
                <option value="ALL">Усі</option>
                <option value="critical">ЗБІЙ</option>
                <option value="warning">УВАГА</option>
                <option value="nominal">НОРМА</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div
          className={`mt-4 overflow-x-auto max-h-96 border rounded-lg ${
            isDark ? 'border-slate-800' : 'border-slate-200'
          }`}
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr
                className={`border-b font-mono ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-400'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                <th className="py-2.5 px-3">Час запиту</th>
                <th className="py-2.5 px-3">Сервіс · Група</th>
                <th className="py-2.5 px-3">Тип операції</th>
                <th className="py-2.5 px-3">Статус</th>
                <th className="py-2.5 px-3 text-right">Відгук</th>
                <th className="py-2.5 px-3">Результат / Що відбулося</th>
                <th className="py-2.5 px-3">Зріз метрик</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y font-mono tabular-nums ${
                isDark ? 'divide-slate-800/60' : 'divide-slate-200'
              }`}
            >
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-slate-500 dark:text-slate-400 font-sans"
                  >
                    {logs.length === 0
                      ? 'Журнал запитів порожній. Підключіть робочі сервіси для початку запису телеметрії.'
                      : 'За обраними критеріями пошуку та датами записів не знайдено.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.slice(0, 80).map((log) => (
                  <tr
                    key={log.id}
                    className={
                      log.status === 'critical'
                        ? 'bg-red-950/30 text-red-200'
                        : log.status === 'warning'
                        ? 'bg-amber-950/20 text-amber-200'
                        : isDark
                        ? 'hover:bg-slate-800/40 text-slate-300'
                        : 'hover:bg-slate-50 text-slate-700'
                    }
                  >
                    <td className="py-2 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {new Date(log.timestamp).toLocaleString('uk-UA')}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span className="font-semibold">{log.serviceName}</span>
                      <span className="text-slate-500"> · {log.group}</span>
                    </td>
                    <td className="py-2 px-3 text-sky-600 dark:text-sky-400">{log.queryType}</td>
                    <td className="py-2 px-3 font-semibold">
                      {log.status === 'critical' ? (
                        <span className="text-red-500 dark:text-red-400 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> ЗБІЙ
                        </span>
                      ) : log.status === 'warning' ? (
                        <span className="text-amber-600 dark:text-amber-400">УВАГА</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">ОК</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">{log.latencyMs} мс</td>
                    <td className="py-2 px-3 font-sans">{log.summary}</td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.metricsSnapshot}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
