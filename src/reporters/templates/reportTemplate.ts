import type {
  MCPEvalRunData,
  MCPEvalHistoricalSummary,
} from '../types.js';

/**
 * Generates the HTML report from run data
 *
 * @param runData - Current run data
 * @param historical - Historical run summaries
 * @returns Complete HTML report string
 */
export function generateHTMLReport(
  runData: MCPEvalRunData,
  historical: Array<MCPEvalHistoricalSummary>
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Eval Report - ${new Date(runData.timestamp).toLocaleString()}</title>
  <style>
    :root {
      --color-bg-primary: #ffffff;
      --color-bg-secondary: #f8fafc;
      --color-bg-tertiary: #f1f5f9;
      --color-border: #e2e8f0;
      --color-border-hover: #cbd5e1;
      --color-text-primary: #0f172a;
      --color-text-secondary: #475569;
      --color-text-tertiary: #94a3b8;
      --color-accent: #6366f1;
      --color-accent-hover: #4f46e5;
      --color-success: #10b981;
      --color-success-bg: #d1fae5;
      --color-success-text: #065f46;
      --color-error: #ef4444;
      --color-error-bg: #fee2e2;
      --color-error-text: #991b1b;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      background: var(--color-bg-secondary);
      color: var(--color-text-primary);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    @media (min-width: 768px) {
      .container {
        padding: 2rem;
      }
    }

    header {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      padding: 2rem;
      border-radius: var(--radius-lg);
      margin-bottom: 2rem;
      box-shadow: var(--shadow-lg);
      position: relative;
      overflow: hidden;
    }

    header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 100%);
      pointer-events: none;
    }

    header h1 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      position: relative;
      z-index: 1;
    }

    @media (min-width: 768px) {
      header h1 {
        font-size: 2.25rem;
      }
    }

    header .subtitle {
      opacity: 0.95;
      font-size: 0.875rem;
      position: relative;
      z-index: 1;
      font-weight: 500;
    }

    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2rem;
    }

    @media (min-width: 768px) {
      .dashboard {
        gap: 1.5rem;
      }
    }

    .metric-card {
      background: var(--color-bg-primary);
      padding: 1.5rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-border);
      transition: var(--transition);
    }

    .metric-card:hover {
      box-shadow: var(--shadow-md);
      border-color: var(--color-border-hover);
    }

    .metric-card h3 {
      color: var(--color-text-tertiary);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .metric-value {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--color-text-primary);
      line-height: 1;
    }

    .metric-value.pass {
      color: var(--color-success);
    }

    .metric-value.fail {
      color: var(--color-error);
    }

    .chart-container {
      background: var(--color-bg-primary);
      padding: 1.5rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-border);
      margin-bottom: 2rem;
    }

    .chart-container h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: var(--color-text-primary);
    }

    .controls {
      background: var(--color-bg-primary);
      padding: 1.25rem;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-border);
      margin-bottom: 1rem;
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .search-input {
      flex: 1;
      min-width: 250px;
      padding: 0.625rem 0.875rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
      transition: var(--transition);
      background: var(--color-bg-primary);
      color: var(--color-text-primary);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .search-input::placeholder {
      color: var(--color-text-tertiary);
    }

    .filter-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 0.625rem 1.125rem;
      border: 1px solid var(--color-border);
      background: var(--color-bg-primary);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 600;
      transition: var(--transition);
      color: var(--color-text-secondary);
    }

    .filter-btn:hover {
      background: var(--color-bg-tertiary);
      border-color: var(--color-border-hover);
      color: var(--color-text-primary);
    }

    .filter-btn.active {
      background: var(--color-accent);
      color: white;
      border-color: var(--color-accent);
      box-shadow: var(--shadow-sm);
    }

    .results-table {
      background: var(--color-bg-primary);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
      border: 1px solid var(--color-border);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: var(--color-bg-tertiary);
      border-bottom: 2px solid var(--color-border);
    }

    th {
      text-align: left;
      padding: 1rem 1.25rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      user-select: none;
      transition: var(--transition);
    }

    th:hover {
      background: var(--color-bg-secondary);
      color: var(--color-text-primary);
    }

    td {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--color-border);
      color: var(--color-text-primary);
      font-size: 0.875rem;
    }

    tbody tr {
      cursor: pointer;
      transition: var(--transition);
      background: var(--color-bg-primary);
    }

    tbody tr:hover {
      background: var(--color-bg-secondary);
      box-shadow: inset 0 0 0 1px var(--color-border-hover);
    }

    tbody tr:active {
      background: var(--color-bg-tertiary);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.375rem 0.875rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      transition: var(--transition);
    }

    .status-badge.pass {
      background: var(--color-success-bg);
      color: var(--color-success-text);
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .status-badge.fail {
      background: var(--color-error-bg);
      color: var(--color-error-text);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .expectation-chips {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
    }

    .expectation-chip {
      padding: 0.25rem 0.625rem;
      background: var(--color-bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
      transition: var(--transition);
    }

    .expectation-chip:hover {
      background: var(--color-bg-secondary);
      color: var(--color-text-primary);
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      overflow-y: auto;
      padding: 2rem;
      animation: fadeIn 200ms ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .modal-content {
      background: var(--color-bg-primary);
      border-radius: var(--radius-lg);
      max-width: 900px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: var(--shadow-xl);
      border: 1px solid var(--color-border);
      animation: slideUp 200ms ease-out;
    }

    .modal-header {
      padding: 1.5rem 2rem;
      border-bottom: 1px solid var(--color-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--color-bg-secondary);
    }

    .modal-header h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: var(--color-text-tertiary);
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      transition: var(--transition);
    }

    .close-btn:hover {
      background: var(--color-bg-tertiary);
      color: var(--color-text-primary);
    }

    .modal-body {
      padding: 2rem;
    }

    .detail-section {
      margin-bottom: 2rem;
    }

    .detail-section:last-child {
      margin-bottom: 0;
    }

    .detail-section h3 {
      font-size: 0.75rem;
      color: var(--color-text-tertiary);
      margin-bottom: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }

    .code-block {
      background: #1a202c;
      color: #e2e8f0;
      padding: 1.25rem;
      border-radius: var(--radius-md);
      overflow-x: auto;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
      border: 1px solid #2d3748;
    }

    .expectation-result {
      padding: 1.25rem;
      border-left: 3px solid var(--color-border);
      background: var(--color-bg-secondary);
      border-radius: var(--radius-md);
      margin-bottom: 1rem;
      transition: var(--transition);
    }

    .expectation-result:hover {
      box-shadow: var(--shadow-sm);
    }

    .expectation-result.pass {
      border-left-color: var(--color-success);
      background: var(--color-success-bg);
    }

    .expectation-result.fail {
      border-left-color: var(--color-error);
      background: var(--color-error-bg);
    }

    .expectation-result h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-text-primary);
    }

    .expectation-result .details {
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      line-height: 1.6;
    }

    .no-results {
      padding: 4rem 2rem;
      text-align: center;
      color: var(--color-text-tertiary);
      font-size: 0.9375rem;
      font-weight: 500;
    }

    canvas {
      max-width: 100%;
      height: auto;
    }

    code {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      background: var(--color-bg-tertiary);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.875em;
      color: var(--color-accent);
      border: 1px solid var(--color-border);
    }

    @media (max-width: 640px) {
      .container {
        padding: 1rem;
      }

      header h1 {
        font-size: 1.5rem;
      }

      .dashboard {
        grid-template-columns: repeat(2, 1fr);
      }

      .controls {
        flex-direction: column;
        align-items: stretch;
      }

      .search-input {
        min-width: 100%;
      }

      .filter-buttons {
        width: 100%;
        justify-content: stretch;
      }

      .filter-btn {
        flex: 1;
      }

      .modal {
        padding: 1rem;
      }

      .modal-content {
        max-height: 95vh;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎭 MCP Eval Report</h1>
      <div class="subtitle">${new Date(runData.timestamp).toLocaleString()} · ${runData.durationMs.toFixed(0)}ms</div>
    </header>

    <div class="dashboard">
      <div class="metric-card">
        <h3>Pass Rate</h3>
        <div class="metric-value ${runData.metrics.passRate >= 0.8 ? 'pass' : 'fail'}">
          ${(runData.metrics.passRate * 100).toFixed(1)}%
        </div>
      </div>
      <div class="metric-card">
        <h3>Total Cases</h3>
        <div class="metric-value">${runData.metrics.total}</div>
      </div>
      <div class="metric-card">
        <h3>Passed</h3>
        <div class="metric-value pass">${runData.metrics.passed}</div>
      </div>
      <div class="metric-card">
        <h3>Failed</h3>
        <div class="metric-value fail">${runData.metrics.failed}</div>
      </div>
    </div>

    ${historical.length > 1 ? `
    <div class="chart-container">
      <h2>Historical Trend</h2>
      <canvas id="trendChart"></canvas>
    </div>
    ` : ''}

    <div class="controls">
      <input type="text" class="search-input" id="searchInput" placeholder="Search by case ID or tool name...">
      <div class="filter-buttons">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="pass">Passed</button>
        <button class="filter-btn" data-filter="fail">Failed</button>
      </div>
    </div>

    <div class="results-table">
      <table>
        <thead>
          <tr>
            <th data-sort="status">Status</th>
            <th data-sort="id">Case ID</th>
            <th data-sort="tool">Tool Name</th>
            <th data-sort="duration">Duration</th>
            <th>Expectations</th>
          </tr>
        </thead>
        <tbody id="resultsBody"></tbody>
      </table>
    </div>
  </div>

  <div class="modal" id="detailModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modalTitle">Case Details</h2>
        <button class="close-btn" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

  <script>
    const runData = ${JSON.stringify(runData)};
    const historical = ${JSON.stringify(historical)};

    let currentFilter = 'all';
    let searchQuery = '';
    let sortColumn = null;
    let sortDirection = 'asc';

    function renderResults() {
      const tbody = document.getElementById('resultsBody');
      let filtered = runData.results;

      // Apply filters
      if (currentFilter !== 'all') {
        filtered = filtered.filter(r => currentFilter === 'pass' ? r.pass : !r.pass);
      }

      // Apply search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(r =>
          r.id.toLowerCase().includes(query) ||
          (r.response && JSON.stringify(r.response).toLowerCase().includes(query))
        );
      }

      // Apply sort
      if (sortColumn) {
        filtered = [...filtered].sort((a, b) => {
          let aVal, bVal;

          switch(sortColumn) {
            case 'status':
              aVal = a.pass ? 1 : 0;
              bVal = b.pass ? 1 : 0;
              break;
            case 'id':
              aVal = a.id;
              bVal = b.id;
              break;
            case 'duration':
              aVal = a.durationMs;
              bVal = b.durationMs;
              break;
            default:
              return 0;
          }

          if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }

      if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5"><div class="no-results">No results found</div></td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(result => {
        const expectations = Object.entries(result.expectations)
          .filter(([_, v]) => v !== undefined)
          .map(([k]) => k);

        return \`
          <tr onclick="showDetail('\${result.id}')">
            <td>
              <span class="status-badge \${result.pass ? 'pass' : 'fail'}">
                \${result.pass ? '✓ Pass' : '✗ Fail'}
              </span>
            </td>
            <td>\${result.id}</td>
            <td><code>\${getToolName(result)}</code></td>
            <td>\${result.durationMs.toFixed(0)}ms</td>
            <td>
              <div class="expectation-chips">
                \${expectations.map(e => \`<span class="expectation-chip">\${e}</span>\`).join('')}
              </div>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function getToolName(result) {
      // Extract tool name from response metadata if available
      // Fallback to parsing from result structure
      return result.id.split('-')[0] || 'unknown';
    }

    function showDetail(caseId) {
      const result = runData.results.find(r => r.id === caseId);
      if (!result) return;

      const modal = document.getElementById('detailModal');
      const title = document.getElementById('modalTitle');
      const body = document.getElementById('modalBody');

      title.textContent = \`Case: \${result.id}\`;

      body.innerHTML = \`
        <div class="detail-section">
          <h3>Status</h3>
          <span class="status-badge \${result.pass ? 'pass' : 'fail'}">
            \${result.pass ? '✓ Pass' : '✗ Fail'}
          </span>
        </div>

        \${result.error ? \`
          <div class="detail-section">
            <h3>Error</h3>
            <div class="code-block">\${escapeHtml(result.error)}</div>
          </div>
        \` : ''}

        <div class="detail-section">
          <h3>Response</h3>
          <div class="code-block">\${escapeHtml(JSON.stringify(result.response, null, 2))}</div>
        </div>

        <div class="detail-section">
          <h3>Expectations</h3>
          \${Object.entries(result.expectations)
            .filter(([_, v]) => v !== undefined)
            .map(([type, exp]) => \`
              <div class="expectation-result \${exp.pass ? 'pass' : 'fail'}">
                <h4>
                  \${exp.pass ? '✓' : '✗'} \${type}
                </h4>
                <div class="details">\${escapeHtml(exp.details || '')}</div>
              </div>
            \`).join('')}
        </div>

        <div class="detail-section">
          <h3>Performance</h3>
          <p>Duration: <strong>\${result.durationMs.toFixed(2)}ms</strong></p>
        </div>
      \`;

      modal.classList.add('active');
    }

    function closeModal() {
      document.getElementById('detailModal').classList.remove('active');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Event listeners
    document.getElementById('searchInput').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderResults();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        renderResults();
      });
    });

    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (sortColumn === column) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = column;
          sortDirection = 'asc';
        }
        renderResults();
      });
    });

    document.getElementById('detailModal').addEventListener('click', (e) => {
      if (e.target.id === 'detailModal') {
        closeModal();
      }
    });

    // Render trend chart if historical data exists
    if (historical.length > 1) {
      const ctx = document.getElementById('trendChart').getContext('2d');
      const labels = historical.map(h => new Date(h.timestamp).toLocaleDateString());
      const passRates = historical.map(h => (h.passRate * 100).toFixed(1));

      // Simple canvas chart (no external dependencies)
      const width = ctx.canvas.width = ctx.canvas.offsetWidth;
      const height = ctx.canvas.height = 200;
      const padding = 40;
      const chartWidth = width - padding * 2;
      const chartHeight = height - padding * 2;

      // Draw axes
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();

      // Draw line
      ctx.strokeStyle = '#667eea';
      ctx.lineWidth = 3;
      ctx.beginPath();

      passRates.forEach((rate, i) => {
        const x = padding + (chartWidth / (passRates.length - 1)) * i;
        const y = height - padding - (chartHeight * rate / 100);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        // Draw point
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.stroke();

      // Draw labels
      ctx.fillStyle = '#4a5568';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';

      labels.forEach((label, i) => {
        const x = padding + (chartWidth / (labels.length - 1)) * i;
        ctx.fillText(label, x, height - padding + 20);
      });
    }

    // Initial render
    renderResults();
  </script>
</body>
</html>`;
}
