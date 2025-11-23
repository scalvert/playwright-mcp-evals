import React, { useState } from 'react';
import type { MCPEvalHistoricalSummary } from '../../types';

interface HistoricalRunsProps {
  historical: MCPEvalHistoricalSummary[];
  currentTimestamp: string;
  onSelectRun?: (index: number) => void;
}

export function HistoricalRuns({
  historical,
  currentTimestamp,
  onSelectRun,
}: HistoricalRunsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (historical.length === 0) {
    return null;
  }

  // Group runs by date proximity
  const groupRuns = (runs: MCPEvalHistoricalSummary[]) => {
    const now = new Date();
    const today: MCPEvalHistoricalSummary[] = [];
    const thisWeek: MCPEvalHistoricalSummary[] = [];
    const older: MCPEvalHistoricalSummary[] = [];

    runs.forEach((run) => {
      const runDate = new Date(run.timestamp);
      const daysDiff = Math.floor(
        (now.getTime() - runDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) today.push(run);
      else if (daysDiff <= 7) thisWeek.push(run);
      else older.push(run);
    });

    return { today, thisWeek, older };
  };

  const { today, thisWeek, older } = groupRuns(historical);

  return (
    <div className="px-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Historical Runs</span>
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-1 space-y-1">
          {today.length > 0 && (
            <RunGroup
              title="Today"
              runs={today}
              currentTimestamp={currentTimestamp}
              onSelectRun={onSelectRun}
            />
          )}
          {thisWeek.length > 0 && (
            <RunGroup
              title="This Week"
              runs={thisWeek}
              currentTimestamp={currentTimestamp}
              onSelectRun={onSelectRun}
            />
          )}
          {older.length > 0 && (
            <RunGroup
              title="Older"
              runs={older}
              currentTimestamp={currentTimestamp}
              onSelectRun={onSelectRun}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RunGroup({
  title,
  runs,
  currentTimestamp,
  onSelectRun,
}: {
  title: string;
  runs: MCPEvalHistoricalSummary[];
  currentTimestamp: string;
  onSelectRun?: (index: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      {runs.map((run, index) => {
        const isActive = run.timestamp === currentTimestamp;
        const passRate = (run.passRate * 100).toFixed(0);

        return (
          <button
            key={run.timestamp}
            onClick={() => onSelectRun?.(index)}
            className={`
              flex w-full items-center justify-between rounded-md px-3 py-2 text-sm
              transition-colors
              ${
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }
            `}
          >
            <div className="flex flex-col items-start">
              <span className="text-xs">
                {new Date(run.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-xs opacity-75">
                {run.total} tests
              </span>
            </div>
            <span
              className={`
                rounded-full px-2 py-0.5 text-xs font-medium
                ${
                  run.passRate >= 0.8
                    ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                    : 'bg-red-500/20 text-red-700 dark:text-red-400'
                }
              `}
            >
              {passRate}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
