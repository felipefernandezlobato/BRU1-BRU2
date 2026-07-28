"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

interface Dataset {
  label: string;
  data: number[];
  color: string;
}

interface BarChartProps {
  labels: string[];
  data?: number[];
  datasets?: Dataset[];
  title: string;
  color?: string;
  horizontal?: boolean;
  stacked?: boolean;
}

export function BarChart({ labels, data, datasets, title, color = "#861A22", horizontal = false, stacked = false }: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const chartDatasets = datasets
      ? datasets.map((ds) => ({
          label: ds.label,
          data: ds.data,
          backgroundColor: ds.color,
          borderRadius: 6,
        }))
      : [{
          data: data || [],
          backgroundColor: color,
          borderRadius: 6,
        }];

    const totalLabelPlugin = stacked ? {
      id: "stackedTotalLabel",
      afterDatasetsDraw(chart: Chart) {
        const { ctx } = chart;
        const dsCount = chart.data.datasets.length;
        // Find the topmost visible dataset to get bar positions
        let topVisibleIdx = -1;
        for (let d = dsCount - 1; d >= 0; d--) {
          if (chart.isDatasetVisible(d)) { topVisibleIdx = d; break; }
        }
        if (topVisibleIdx < 0) return;

        const topMeta = chart.getDatasetMeta(topVisibleIdx);
        if (!topMeta?.data) return;

        ctx.save();
        ctx.font = "bold 11px 'DM Sans', sans-serif";
        ctx.fillStyle = "#1A1A1A";
        ctx.textAlign = "center";
        const numPoints = topMeta.data.length;
        for (let i = 0; i < numPoints; i++) {
          let total = 0;
          let topY = topMeta.data[i].y;
          for (let d = 0; d < dsCount; d++) {
            if (!chart.isDatasetVisible(d)) continue;
            total += (chart.data.datasets[d].data[i] as number) || 0;
            const barY = chart.getDatasetMeta(d).data[i].y;
            if (barY < topY) topY = barY;
          }
          ctx.fillText(total.toLocaleString("de-CH", { maximumFractionDigits: 0 }), topMeta.data[i].x, topY - 6);
        }
        ctx.restore();
      },
    } : undefined;

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: chartDatasets,
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: true,
        layout: stacked ? { padding: { top: 20 } } : undefined,
        plugins: {
          legend: { display: !!datasets },
          title: {
            display: true,
            text: title,
            font: { size: 16, family: "'EB Garamond', serif" },
            color: "#1A1A1A",
            padding: { bottom: 16 },
          },
        },
        scales: {
          y: { beginAtZero: true, stacked },
          x: { beginAtZero: horizontal, stacked },
        },
      },
      plugins: totalLabelPlugin ? [totalLabelPlugin] : [],
    });

    return () => { chartRef.current?.destroy(); };
  }, [labels, data, datasets, title, color, horizontal, stacked]);

  return <canvas ref={canvasRef} />;
}
