import React, { useEffect, useRef } from 'react';
import type { MCPEvalHistoricalSummary } from '../../types';

interface TrendChartProps {
  historical: MCPEvalHistoricalSummary[];
}

export function TrendChart({ historical }: TrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || historical.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = (canvas.width = canvas.offsetWidth * 2); // 2x for retina
    const height = (canvas.height = 300);

    const padding = 60;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Prepare data
    const labels = historical.map((h) =>
      new Date(h.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    );
    const passRates = historical.map((h) => h.passRate * 100);

    // Get dark mode state
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const lineColor = isDark ? 'rgb(99, 102, 241)' : 'rgb(79, 70, 229)';
    const textColor = isDark ? 'rgb(226, 232, 240)' : 'rgb(71, 85, 105)';

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = textColor;
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${100 - (i * 25)}%`, padding - 10, y);
    }

    // Draw line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    passRates.forEach((rate, i) => {
      const x = padding + (chartWidth / (passRates.length - 1)) * i;
      const y = padding + chartHeight - (chartHeight * rate) / 100;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = lineColor;
    passRates.forEach((rate, i) => {
      const x = padding + (chartWidth / (passRates.length - 1)) * i;
      const y = padding + chartHeight - (chartHeight * rate) / 100;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw X-axis labels
    ctx.fillStyle = textColor;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    labels.forEach((label, i) => {
      const x = padding + (chartWidth / (labels.length - 1)) * i;
      ctx.fillText(label, x, height - padding + 15);
    });
  }, [historical]);

  if (historical.length < 2) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Historical Trend</h2>
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          Not enough data to show trends (need at least 2 runs)
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">Historical Trend</h2>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: '150px' }}
        />
      </div>
    </div>
  );
}
