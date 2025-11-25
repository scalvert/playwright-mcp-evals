# UI Reporter Guide

`@mcp-testing/server-tester` includes a custom Playwright reporter with an interactive web UI for visualizing test results.

![MCP Test Reporter UI](../ui.png)

## Features

- **📊 Dual Test Tracking** - Automatically captures both Playwright test results and eval dataset executions
- **🎯 Tab-Based Filtering** - Switch between All Results, Eval Datasets, and Test Suites views
- **📈 Real-Time Metrics** - Pass rate, total tests, duration, and expectation breakdowns
- **🔍 Detailed Inspection** - Click any result to see full tool call details, responses, and validation results
- **🌓 Dark Mode** - Automatic theme detection with manual toggle
- **📱 Responsive Design** - Works on desktop and mobile browsers

## Configuration

Add the reporter to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'], // Keep the terminal output
    ['@mcp-testing/server-tester/reporters/mcpReporter'], // Add the UI reporter
  ],
  // ... rest of config
});
```

You can use both reporters together - `list` for terminal output and `mcpEvalReporter` for the web UI.

## Usage

The reporter automatically generates an HTML report after each test run:

```bash
npm test

# Report generated at: .mcp-test-results/latest/index.html
# Opens automatically in your default browser
```

### Running Tests

```bash
# Run tests and generate report
npm test

# Run tests without opening browser
PLAYWRIGHT_SKIP_BROWSER_OPEN=1 npm test

# Run in UI mode (Playwright's built-in UI)
npx playwright test --ui
```

## UI Components

### Metrics Cards

High-level summary at the top of the page:

- **Total Tests** - Total number of test cases executed
- **Passed** - Number of successful tests
- **Failed** - Number of failed tests
- **Pass Rate** - Percentage of passed tests
- **Duration** - Total execution time

### Tabs

Filter results by type:

- **All Results** - Show both eval datasets and test suites
- **Eval Datasets** - Show only dataset-driven evals (icon: BarChart3)
- **Test Suites** - Show only traditional Playwright tests (icon: FlaskConical)

### Results Table

Comprehensive table with:

- **ID/Name** - Test case or dataset identifier
- **Type** - Eval Dataset or Test Suite (with icons)
- **Status** - Pass/Fail badge
- **Expectations** - Count of passed/total expectations
- **Duration** - Execution time
- **Timestamp** - When the test ran

Features:
- **Sorting** - Click column headers to sort
- **Search** - Filter by name or ID
- **Click to Expand** - See full details in modal

### Detail Modal

Click any result row to see:

1. **Test Information**
   - Test case ID
   - Tool name
   - Status and duration

2. **Tool Call Details**
   - Arguments sent to the tool
   - Formatted JSON display

3. **Response Preview**
   - Full tool response
   - Syntax highlighting for JSON
   - Markdown rendering for text

4. **Expectation Results**
   - Each expectation type (exact, schema, regex, etc.)
   - Pass/fail status
   - Detailed failure messages
   - Diff views for mismatches

### Theme Toggle

Switch between light and dark modes:
- Click the theme toggle button in the top-right
- Preference saved to localStorage
- Automatic detection of system preference on first load

## Results Organization

Results are saved to `.mcp-test-results/`:

```
.mcp-test-results/
├── latest/                    # Symlink to most recent run
│   ├── index.html            # Main UI
│   ├── data.js               # Test results data
│   ├── app.js                # UI JavaScript
│   └── styles.css            # UI styles
└── run-2025-01-24T12-00-00/  # Timestamped runs
    ├── index.html
    ├── data.js
    ├── app.js
    └── styles.css
```

### Timestamped Runs

Each test run creates a new directory with an ISO timestamp:
- Format: `run-YYYY-MM-DDTHH-mm-ss`
- Preserves historical results
- Useful for comparing runs over time

### Latest Symlink

The `latest/` directory is a symlink to the most recent run:
- Always points to the newest results
- Easy to bookmark
- Consistent URL for CI/CD

### Git Integration

Add to your `.gitignore`:

```gitignore
# MCP test results
.mcp-test-results/
```

This prevents committing generated reports while keeping them available locally.

## Interpreting Results

### Pass/Fail Indicators

- **Green badge** - Test passed all expectations
- **Red badge** - Test failed one or more expectations
- **Expectation count** - Shows `X/Y` where X is passed and Y is total

### Expectation Details

Each expectation type shows specific information:

**Exact Match:**
```
✓ Exact match
  Expected: { "result": 5 }
  Actual: { "result": 5 }
```

**Schema Validation:**
```
✗ Schema validation failed
  Error: Expected number, received string at path "temperature"
```

**Text Contains:**
```
✓ Text contains
  All 3 substrings found
```

**Regex:**
```
✗ Regex pattern failed
  Failed patterns:
    - "Temperature: \d+°C"
  Reason: Pattern not found in response
```

**LLM Judge:**
```
✓ LLM judge passed
  Score: 0.85 (threshold: 0.7)
  Rubric: Evaluate search relevance
```

## Customization

### Changing Output Directory

Modify the reporter configuration:

```typescript
export default defineConfig({
  reporter: [
    ['list'],
    [
      '@mcp-testing/server-tester/reporters/mcpReporter',
      { outputDir: 'custom-results' }
    ],
  ],
});
```

### Disabling Auto-Open

Set environment variable:

```bash
PLAYWRIGHT_SKIP_BROWSER_OPEN=1 npm test
```

Or in your test script:

```json
{
  "scripts": {
    "test": "PLAYWRIGHT_SKIP_BROWSER_OPEN=1 playwright test",
    "test:open": "playwright test"
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: MCP Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test

      # Upload results as artifact
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: mcp-test-results
          path: .mcp-test-results/latest/
          retention-days: 30
```

### Viewing CI Results

1. Download the artifact from GitHub Actions
2. Extract the files
3. Open `index.html` in a browser

### Hosting Results

You can host results as static files:

```bash
# Copy latest results to web server
cp -r .mcp-test-results/latest/* /var/www/mcp-results/

# Or use GitHub Pages
gh-pages -d .mcp-test-results/latest
```

## Troubleshooting

### Report Not Generated

**Issue:** No report appears after test run

**Solutions:**
- Verify reporter is in `playwright.config.ts`
- Check for syntax errors in config
- Ensure tests actually ran (check terminal output)
- Look for write permission errors

### Browser Doesn't Open

**Issue:** Report generated but browser doesn't open

**Solutions:**
- Check `PLAYWRIGHT_SKIP_BROWSER_OPEN` env var
- Try opening manually: `open .mcp-test-results/latest/index.html`
- Verify browser is installed

### Missing Data

**Issue:** Report shows but some data is missing

**Solutions:**
- Check console for JavaScript errors (F12 → Console)
- Verify `data.js` was generated correctly
- Look for tool call failures in test output
- Ensure expectations are configured properly

### Styling Issues

**Issue:** UI looks broken or unstyled

**Solutions:**
- Verify `styles.css` and `app.js` exist
- Check browser console for loading errors
- Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
- Clear browser cache

## Next Steps

- See the [Quick Start Guide](./quickstart.md) for running tests
- Check the [Expectations Guide](./expectations.md) for validation setup
- Explore [Examples](../examples) for sample test suites
