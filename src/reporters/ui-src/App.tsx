import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { MCPEvalData, MCPEvalResult } from './types';
import { Layout } from './components/Layout';
import { DarkModeToggle } from './components/DarkModeToggle';
import { HistoricalRuns } from './components/Sidebar/HistoricalRuns';
import { TestGroups } from './components/Sidebar/TestGroups';
import { MetricsCards } from './components/Dashboard/MetricsCards';
import { TrendChart } from './components/Dashboard/TrendChart';
import { ResultsTable } from './components/Results/ResultsTable';
import { DetailModal } from './components/Results/DetailModal';

function App() {
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
      },
      results: [],
    },
    historical: [],
  };

  const [selectedGroup, setSelectedGroup] = useState<string | undefined>();
  const [selectedResult, setSelectedResult] = useState<MCPEvalResult | null>(
    null
  );

  const sidebar = (
    <>
      <HistoricalRuns
        historical={data.historical}
        currentTimestamp={data.runData.timestamp}
      />
      <TestGroups
        results={data.runData.results}
        selectedGroup={selectedGroup}
        onSelectGroup={setSelectedGroup}
      />
    </>
  );

  const header = (
    <div className="flex items-center justify-between w-full">
      <div className="flex flex-col">
        <span className="text-sm font-semibold">
          {new Date(data.runData.timestamp).toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">
          {data.runData.durationMs.toFixed(0)}ms · {data.runData.environment.platform}
        </span>
      </div>
      <DarkModeToggle />
    </div>
  );

  return (
    <>
      <Layout sidebar={sidebar} header={header}>
        <div className="p-6 space-y-6">
          {/* Dashboard */}
          <div className="space-y-6">
            <MetricsCards
              metrics={data.runData.metrics}
              durationMs={data.runData.durationMs}
            />
            {data.historical.length > 1 && (
              <TrendChart historical={data.historical} />
            )}
          </div>

          {/* Results Table */}
          <div className="rounded-lg border bg-card shadow-sm overflow-hidden h-[600px]">
            <ResultsTable
              results={data.runData.results}
              selectedGroup={selectedGroup}
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
