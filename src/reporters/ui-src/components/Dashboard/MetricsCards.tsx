import React from 'react';

interface MetricsCardsProps {
  metrics: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  durationMs: number;
}

export function MetricsCards({ metrics, durationMs }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <MetricCard
        title="Pass Rate"
        value={`${(metrics.passRate * 100).toFixed(1)}%`}
        variant={metrics.passRate >= 0.8 ? 'success' : 'error'}
      />
      <MetricCard
        title="Total Tests"
        value={metrics.total.toString()}
        variant="neutral"
      />
      <MetricCard
        title="Passed"
        value={metrics.passed.toString()}
        variant="success"
      />
      <MetricCard
        title="Failed"
        value={metrics.failed.toString()}
        variant={metrics.failed === 0 ? 'neutral' : 'error'}
      />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  variant: 'success' | 'error' | 'neutral';
}

function MetricCard({ title, value, variant }: MetricCardProps) {
  const colors = {
    success: 'text-green-600 dark:text-green-400',
    error: 'text-red-600 dark:text-red-400',
    neutral: 'text-foreground',
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <span className={`mt-2 text-3xl font-bold ${colors[variant]}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
