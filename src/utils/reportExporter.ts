import { jsPDF } from 'jspdf';
import {
  formatMetricsToCSV,
  type CloudQueryLog,
  type CrashBlackboxReport,
  type ServiceFeed,
} from './monitoringEngine';

export function downloadCsvReport(
  services: ServiceFeed[],
  logs: CloudQueryLog[],
  blackboxReports: CrashBlackboxReport[],
  filenamePrefix: string = 'sentinelwall-noc-report'
): void {
  const csvContent = formatMetricsToCSV(services, logs, blackboxReports);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const datePart = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}-${datePart}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a high-resolution PDF report using jsPDF with a high-DPI offscreen canvas
 * so Ukrainian Cyrillic typography, tabular metrics, and 30s Blackbox summaries render cleanly.
 */
export function downloadPdfReport(
  services: ServiceFeed[],
  logs: CloudQueryLog[],
  blackboxReports: CrashBlackboxReport[],
  filenamePrefix: string = 'sentinelwall-noc-report'
): void {
  const canvas = document.createElement('canvas');
  const width = 1240;
  const height = 1754; // A4 @ 150 DPI
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#0B0F17';
  ctx.fillRect(0, 0, width, height);

  // Header Banner
  ctx.fillStyle = '#111827';
  ctx.fillRect(48, 48, width - 96, 130);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, width - 96, 130);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('SentinelWall NOC — Звіт Мультисервісного Моніторингу (CCTV)', 76, 102);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '18px monospace';
  const nowStr = new Date().toLocaleString('uk-UA');
  ctx.fillText(
    `Згенеровано: ${nowStr}  ·  Активних камер: ${services.length}  ·  Дампів 30с: ${blackboxReports.length}  ·  Записів у хмарі: ${logs.length}`,
    76,
    144
  );

  let y = 224;

  // Section 1: Services table
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('1. Поточний стан підключених сервісів (Камери спостереження)', 48, y);
  y += 24;

  // Table header
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(48, y, width - 96, 42);
  ctx.fillStyle = '#E2E8F0';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Камера', 64, y + 27);
  ctx.fillText('Сервіс', 175, y + 27);
  ctx.fillText('Група', 450, y + 27);
  ctx.fillText('Статус', 660, y + 27);
  ctx.fillText('Основна метрика', 800, y + 27);
  ctx.fillText('Затримка', 1060, y + 27);
  y += 42;

  for (const s of services.slice(0, 10)) {
    const latest = s.ringBuffer30s[s.ringBuffer30s.length - 1];
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(48, y, width - 96, 44);
    ctx.strokeStyle = '#1E293B';
    ctx.strokeRect(48, y, width - 96, 44);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '16px monospace';
    ctx.fillText(s.cameraCode, 64, y + 28);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(s.name.slice(0, 26), 175, y + 28);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '15px sans-serif';
    ctx.fillText(s.group.slice(0, 20), 450, y + 28);

    ctx.fillStyle =
      s.status === 'critical' ? '#EF4444' : s.status === 'warning' ? '#F59E0B' : '#22C55E';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(
      s.status === 'critical' ? 'ЗБІЙ (CRIT)' : s.status === 'warning' ? 'УВАГА (WARN)' : 'НОРМА (OK)',
      660,
      y + 28
    );

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '16px monospace';
    ctx.fillText(`${latest?.primaryValue ?? 0} ${s.primaryMetricUnit}`, 800, y + 28);
    ctx.fillText(`${latest?.latencyMs ?? 0} мс`, 1060, y + 28);

    y += 44;
  }

  y += 44;

  // Section 2: Last 20-30s Crash Blackbox Reports
  ctx.fillStyle = '#F43F5E';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('2. Аварійні дампи метрик за останні 20–30 секунд (Чорна скринька)', 48, y);
  y += 24;

  if (blackboxReports.length === 0) {
    ctx.fillStyle = '#111827';
    ctx.fillRect(48, y, width - 96, 66);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '16px sans-serif';
    ctx.fillText(
      'Критичних аварійних дампів за поточну сесію не зафіксовано. 30-секундний кільцевий буфер активний на всіх камерах.',
      68,
      y + 40
    );
    y += 90;
  } else {
    for (const report of blackboxReports.slice(0, 4)) {
      ctx.fillStyle = '#18181B';
      ctx.fillRect(48, y, width - 96, 118);
      ctx.strokeStyle = '#EF4444';
      ctx.strokeRect(48, y, width - 96, 118);

      ctx.fillStyle = '#FCA5A5';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(
        `${report.cameraCode} · ${report.serviceName} — Збій: ${new Date(report.crashTimestamp).toLocaleTimeString('uk-UA')} (Вікно: ${report.windowDurationSec} сек)`,
        68,
        y + 30
      );

      ctx.fillStyle = '#E2E8F0';
      ctx.font = '15px sans-serif';
      ctx.fillText(`Діагноз: ${report.rootCauseDiagnosis.slice(0, 108)}`, 68, y + 62);
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(
        `Пік метрики: ${report.peakPrimaryValue} ${report.primaryMetricUnit} · Середнє за 30с: ${report.avgPrimaryValue} ${report.primaryMetricUnit} · Пікова затримка: ${report.peakLatencyMs} мс`,
        68,
        y + 94
      );
      y += 132;
    }
  }

  y += 20;

  // Section 3: Recent Cloud Query History
  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('3. Останні записи з хмарного сховища логів та запитів', 48, y);
  y += 24;

  for (const log of logs.slice(0, 8)) {
    if (y > height - 90) break;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(48, y, width - 96, 38);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '14px monospace';
    ctx.fillText(new Date(log.timestamp).toLocaleTimeString('uk-UA'), 64, y + 24);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(log.serviceName.slice(0, 22), 190, y + 24);
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(log.queryType, 430, y + 24);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '14px sans-serif';
    ctx.fillText(log.summary.slice(0, 62), 620, y + 24);
    y += 40;
  }

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [width, height],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, width, height);
  const datePart = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  pdf.save(`${filenamePrefix}-${datePart}.pdf`);
}
