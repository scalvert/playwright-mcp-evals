import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MCPEvalData, EvalCaseResult } from './types';
import { Layout } from './components/Layout';
import {
  MetricsCards,
  SourceBreakdown,
} from './components/Dashboard/MetricsCards';
import { ResultsTable } from './components/Results/ResultsTable';
import { DetailModal } from './components/Results/DetailModal';
import { ConformancePanel } from './components/Conformance/ConformancePanel';
import { ServerCapabilities } from './components/ServerInfo/ServerCapabilities';

function App() {
  const [serverInfoExpanded, setServerInfoExpanded] = useState(false);
  const data: MCPEvalData = window.MCP_EVAL_DATA || {
    runData: {
      timestamp: new Date().toISOString(),
      durationMs: 0,
      environment: { ci: false, node: '', platform: '' },
      metrics: {
        total: 0,
        passed: 0,
        failed: 0,
        passRate: 0,
        datasetBreakdown: {},
        expectationBreakdown: {
          exact: 0,
          schema: 0,
          textContains: 0,
          regex: 0,
          snapshot: 0,
          judge: 0,
          error: 0,
        },
      },
      results: [],
    },
    historical: [],
  };

  const [selectedResult, setSelectedResult] = useState<EvalCaseResult | null>(
    null
  );

  const hasConformanceChecks =
    data.runData.conformanceChecks && data.runData.conformanceChecks.length > 0;
  const hasServerCapabilities =
    data.runData.serverCapabilities &&
    data.runData.serverCapabilities.length > 0;

  return (
    <>
      <Layout
        timestamp={data.runData.timestamp}
        platform={data.runData.environment.platform}
        durationMs={data.runData.durationMs}
      >
        <div className="max-w-[1600px] mx-auto p-6 h-full flex flex-col gap-6">
          {/* Overall Summary */}
          <MetricsCards results={data.runData.results} />

          {/* Conformance Checks and Server Capabilities */}
          {(hasConformanceChecks || hasServerCapabilities) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {hasConformanceChecks && (
                <ConformancePanel
                  conformanceChecks={data.runData.conformanceChecks!}
                  isExpanded={serverInfoExpanded}
                  onToggle={() => setServerInfoExpanded(!serverInfoExpanded)}
                />
              )}
              {hasServerCapabilities && (
                <ServerCapabilities
                  serverCapabilities={data.runData.serverCapabilities!}
                  isExpanded={serverInfoExpanded}
                  onToggle={() => setServerInfoExpanded(!serverInfoExpanded)}
                />
              )}
            </div>
          )}

          {/* Breakdown by Source */}
          <SourceBreakdown results={data.runData.results} />

          {/* Results Table */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden flex-1 min-h-0">
            <ResultsTable
              results={data.runData.results}
              onSelectResult={setSelectedResult}
            />
          </div>
        </div>
      </Layout>

      {/* Detail Modal */}
      <DetailModal
        result={selectedResult}
        onClose={() => setSelectedResult(null)}
      />
    </>
  );
}

// Initialize React app
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
