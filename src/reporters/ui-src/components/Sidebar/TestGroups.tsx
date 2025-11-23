import React, { useState } from 'react';
import type { MCPEvalResult } from '../../types';

interface TestGroupsProps {
  results: MCPEvalResult[];
  selectedGroup?: string;
  onSelectGroup?: (group: string | undefined) => void;
}

export function TestGroups({
  results,
  selectedGroup,
  onSelectGroup,
}: TestGroupsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Group results by tool name (extracted from ID)
  const groupResults = (results: MCPEvalResult[]) => {
    const groups: Record<string, { passed: number; failed: number }> = {};

    results.forEach((result) => {
      // Extract tool name from ID (e.g., "weather-london" -> "weather")
      const toolName = result.id.split('-')[0] || 'unknown';

      if (!groups[toolName]) {
        groups[toolName] = { passed: 0, failed: 0 };
      }

      if (result.pass) {
        groups[toolName].passed++;
      } else {
        groups[toolName].failed++;
      }
    });

    return groups;
  };

  const groups = groupResults(results);
  const groupNames = Object.keys(groups).sort();

  return (
    <div className="px-3 mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Test Groups</span>
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
          {/* "All" option */}
          <button
            onClick={() => onSelectGroup?.(undefined)}
            className={`
              flex w-full items-center justify-between rounded-md px-3 py-2 text-sm
              transition-colors
              ${
                !selectedGroup
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }
            `}
          >
            <span>All Tests</span>
            <span className="text-xs opacity-75">{results.length}</span>
          </button>

          {/* Individual groups */}
          {groupNames.map((groupName) => {
            const group = groups[groupName];
            const isActive = selectedGroup === groupName;

            return (
              <button
                key={groupName}
                onClick={() => onSelectGroup?.(groupName)}
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
                <span className="font-mono text-xs">{groupName}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 dark:text-green-400">
                    {group.passed}
                  </span>
                  {group.failed > 0 && (
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {group.failed}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
