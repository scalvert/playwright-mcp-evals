import React from 'react';
import {
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { MCPConformanceResultData } from '../../types';

interface ConformancePanelProps {
  conformanceChecks: MCPConformanceResultData[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function ConformancePanel({
  conformanceChecks,
  isExpanded,
  onToggle,
}: ConformancePanelProps) {

  if (!conformanceChecks || conformanceChecks.length === 0) {
    return null;
  }

  // Flatten all checks from all conformance results
  const allChecks = conformanceChecks.flatMap((result) =>
    (result.checks ?? []).map((check) => ({
      ...check,
      serverInfo: result.serverInfo,
      testTitle: result.testTitle,
    }))
  );

  // Deduplicate checks by name (take first occurrence)
  const uniqueChecks = Array.from(
    new Map(allChecks.map((c) => [c.name, c])).values()
  );

  const allPassed = uniqueChecks.every((check) => check.pass);
  const passedCount = uniqueChecks.filter((check) => check.pass).length;

  // Get server info from first result
  const serverInfo = conformanceChecks[0]?.serverInfo;

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Header - Clickable */}
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 border-b transition-colors ${
          allPassed
            ? 'bg-green-500/10 border-green-500/20 hover:bg-green-500/15'
            : 'bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            {allPassed ? (
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <ShieldX className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
            <h3 className="font-semibold">MCP Conformance Checks</h3>
            {serverInfo && (
              <span className="text-sm text-muted-foreground">
                ({serverInfo.name}
                {serverInfo.version && ` v${serverInfo.version}`})
              </span>
            )}
          </div>
          <span
            className={`text-sm font-medium ${
              allPassed
                ? 'text-green-600 dark:text-green-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {passedCount}/{uniqueChecks.length} passed
          </span>
        </div>
      </button>

      {/* Checks List - Collapsible with fixed height */}
      {isExpanded && (
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {uniqueChecks.map((check) => (
            <div
              key={check.name}
              className="px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                {check.pass ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <code
                    className={`text-sm font-semibold font-mono ${
                      check.pass
                        ? 'text-foreground'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {check.name}
                  </code>
                  {check.message && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {check.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
