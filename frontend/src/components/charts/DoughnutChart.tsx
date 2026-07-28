"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

interface DoughnutChartProps {
  labels: string[];
  data: number[];
  title: string;
  colors?: string[];
}

const DEFAULT_COLORS = [
  "#861A22",
  "#D4C3A5",
  "#6B151D",
  "#6B7280",
  "#D97706",
  "#16A34A",
  "#92400E",
  "#4B5563",
  "#B45309",
  "#059669",
];

export function DoughnutChart({ labels, data, title, colors = DEFAULT_COLORS }: DoughnutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 2,
          borderColor: "#FFFFFF",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: "circle",
              font: { size: 12 },
            },
          },
          title: {
            display: true,
            text: title,
            font: { size: 16, family: "'EB Garamond', serif" },
            color: "#1A1A1A",
            padding: { bottom: 16 },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [labels, data, title, colors]);

  return <canvas ref={canvasRef} />;
}
