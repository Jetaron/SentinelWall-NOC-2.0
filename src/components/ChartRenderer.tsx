import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend,
  type ChartOptions,
} from 'chart.js';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';
import type { ChartStyleType, MetricSample } from '../utils/monitoringEngine';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface ServiceChartProps {
  samples: MetricSample[];
  chartType: ChartStyleType;
  primaryLabel: string;
  primaryUnit: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
  accentColor: string;
  fillArea?: boolean;
  smoothCurve?: boolean;
  warningThreshold?: number;
  criticalThreshold?: number;
  showDualMetrics?: boolean;
  isDark?: boolean;
  heightClass?: string;
}

export const ServiceChartRenderer: React.FC<ServiceChartProps> = ({
  samples,
  chartType,
  primaryLabel,
  primaryUnit,
  secondaryLabel,
  accentColor,
  fillArea = true,
  smoothCurve = true,
  warningThreshold,
  criticalThreshold,
  showDualMetrics = false,
  isDark = true,
  heightClass = 'h-36',
}) => {
  const isHeadless =
    typeof navigator !== 'undefined' &&
    (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));

  const visibleSamples = samples.slice(-30);
  const labels = visibleSamples.map((s) => `${s.relativeSec}с`);
  const primaryData = visibleSamples.map((s) => s.primaryValue);
  const secondaryData = visibleSamples.map((s) => s.secondaryValue);

  const gridColor = isDark ? 'rgba(51, 65, 85, 0.35)' : 'rgba(203, 213, 225, 0.6)';
  const tickColor = isDark ? '#94A3B8' : '#475569';

  if (chartType === 'doughnut') {
    const latest = visibleSamples[visibleSamples.length - 1];
    const currentVal = latest ? latest.primaryValue : 0;
    const maxCap = criticalThreshold ? Math.max(criticalThreshold * 1.2, currentVal) : 100;
    const remaining = Math.max(0, Number((maxCap - currentVal).toFixed(1)));

    const doughnutData = {
      labels: [`${primaryLabel} (${primaryUnit})`, 'Запас до ліміту'],
      datasets: [
        {
          data: [currentVal, remaining],
          backgroundColor: [accentColor, isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(226, 232, 240, 0.9)'],
          borderColor: [accentColor, isDark ? '#334155' : '#CBD5E1'],
          borderWidth: 1,
        },
      ],
    };

    const doughnutOptions: ChartOptions<'doughnut'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: isHeadless ? false : { duration: 180 },
      cutout: '68%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: tickColor,
            boxWidth: 10,
            font: { family: "'JetBrains Mono', monospace", size: 11 },
          },
        },
      },
    };

    return (
      <div className={`w-full ${heightClass} relative`}>
        <Doughnut data={doughnutData} options={doughnutOptions} />
      </div>
    );
  }

  if (chartType === 'radar') {
    const radarSamples = visibleSamples.slice(-8);
    const radarData = {
      labels: radarSamples.map((s) => `${s.relativeSec}с`),
      datasets: [
        {
          label: `${primaryLabel} (${primaryUnit})`,
          data: radarSamples.map((s) => s.primaryValue),
          borderColor: accentColor,
          backgroundColor: `${accentColor}33`,
          borderWidth: 2,
          pointRadius: 2,
        },
      ],
    };

    const radarOptions: ChartOptions<'radar'> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: isHeadless ? false : { duration: 180 },
      scales: {
        r: {
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: { color: tickColor, font: { size: 10, family: "'JetBrains Mono', monospace" } },
          ticks: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
      },
    };

    return (
      <div className={`w-full ${heightClass} relative`}>
        <Radar data={radarData} options={radarOptions} />
      </div>
    );
  }

  const datasets: any[] = [
    {
      label: `${primaryLabel} (${primaryUnit})`,
      data: primaryData,
      borderColor: accentColor,
      backgroundColor: fillArea ? `${accentColor}26` : accentColor,
      borderWidth: 2,
      fill: fillArea,
      tension: smoothCurve ? 0.32 : 0,
      pointRadius: visibleSamples.map((s) => (s.status === 'critical' ? 4 : 0)),
      pointBackgroundColor: visibleSamples.map((s) =>
        s.status === 'critical' ? '#EF4444' : accentColor
      ),
    },
  ];

  if (showDualMetrics && secondaryLabel) {
    datasets.push({
      label: secondaryLabel,
      data: secondaryData,
      borderColor: '#94A3B8',
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      fill: false,
      tension: smoothCurve ? 0.3 : 0,
      pointRadius: 0,
    });
  }

  if (criticalThreshold && chartType === 'line') {
    datasets.push({
      label: `Критичний поріг (${criticalThreshold})`,
      data: visibleSamples.map(() => criticalThreshold),
      borderColor: 'rgba(239, 68, 68, 0.55)',
      borderWidth: 1,
      borderDash: [3, 3],
      pointRadius: 0,
      fill: false,
    });
  }

  const commonOptions: ChartOptions<'line' | 'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: isHeadless ? false : { duration: 160 },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: tickColor,
          maxTicksLimit: 6,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
        },
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: tickColor,
          maxTicksLimit: 4,
          font: { family: "'JetBrains Mono', monospace", size: 10 },
        },
        suggestedMin: 0,
        suggestedMax: warningThreshold ? Math.round(warningThreshold * 1.15) : undefined,
      },
    },
    plugins: {
      legend: {
        display: showDualMetrics,
        labels: {
          color: tickColor,
          boxWidth: 10,
          font: { family: "'JetBrains Mono', monospace", size: 11 },
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
        titleColor: isDark ? '#F8FAFC' : '#0F172A',
        bodyColor: isDark ? '#CBD5E1' : '#334155',
        borderColor: isDark ? '#334155' : '#CBD5E1',
        borderWidth: 1,
      },
    },
  };

  return (
    <div className={`w-full ${heightClass} relative`}>
      {chartType === 'bar' ? (
        <Bar data={{ labels, datasets }} options={commonOptions as ChartOptions<'bar'>} />
      ) : (
        <Line data={{ labels, datasets }} options={commonOptions as ChartOptions<'line'>} />
      )}
    </div>
  );
};
