"use client";

import { useEffect, useRef } from "react";
import { Chart } from "chart.js/auto";

interface BarChartProps {
  labels: string[];
  data: number[];
  title: string;
  color?: string;
  horizontal?: boolean;
}

export function BarChart({ labels, data, title, color = "#861A22", horizontal = false }: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: color,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: horizontal ? "y" : "x",
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: title,
            font: { size: 16, family: "'EB Garamond', serif" },
            color: "#1A1A1A",
            padding: { bottom: 16 },
          },
        },
        scales: {
          y: { beginAtZero: true },
          x: { beginAtZero: horizontal },
        },
      },
    });

    return () => { chartRef.current?.destroy(); };
  }, [labels, data, title, color, horizontal]);

  return <canvas ref={canvasRef} />;
}
