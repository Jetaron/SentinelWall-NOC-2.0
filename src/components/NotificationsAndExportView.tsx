import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  Moon,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Sun,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  NotificationConfig,
  NotificationRecord,
  ServiceFeed,
} from '../utils/monitoringEngine';

interface NotificationsAndExportViewProps {
  services: ServiceFeed[];
  config: NotificationConfig;
  history: NotificationRecord[];
  isDark: boolean;
  onSetTheme: (dark: boolean) => void;
  onUpdateConfig: (patch: Partial<NotificationConfig>) => void;
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
  config,
  history,
  isDark,
  onSetTheme,
  onUpdateConfig,
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

  useEffect(() => {
    if (services.length > 0 && !services.some((s) => s.id === selectedCrashServiceId)) {
      setSelectedCrashServiceId(services[0].id);
    } else if (services.length === 0) {
      setSelectedCrashServiceId('');
    }
  }, [services, selectedCrashServiceId]);

  const selectedCrashService =
    services.find((s) => s.id === selectedCrashServiceId) || services[0] || null;

  const handleTriggerSend = async (channel: 'telegram' | 'slack') => {
    setSendingChannel(channel);
    try {
      await onSendTestNotification(channel, customAlertText);
    } finally {
      setSendingChannel(null);
    }
  };

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

      {/* 2. Telegram & Slack Gateways */}
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

      {/* 3. Custom Alert Message & Export PDF / CSV */}
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

      {/* 4. Notification Delivery Log */}
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

      {/* 5. Deep Collapsible Environment Management */}
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
