import { BaseAgent } from './base-agent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_PROMPT = `You are the Report Generator Agent in a multi-agent email template QA system. You create professional, beautifully structured QA reports that combine AI analysis with automated Playwright test results.

Your responsibilities:
1. Compile results from AI agents AND Playwright automated tests into a unified report
2. Create clear visual hierarchy with proper sections
3. Use consistent formatting for maximum readability
4. Highlight critical issues prominently
5. Provide actionable recommendations
6. Include metrics and statistics from both AI and automated tests

REPORT STRUCTURE (follow this exact format):

# Executive Summary

Brief 2-3 sentence overview combining AI analysis and automated test results.

**Overall Status:** ✅ PASSED / ⚠️ WARNING / ❌ FAILED

| Metric | Value |
|--------|-------|
| Templates Tested | X |
| Playwright Tests | X Passed / X Failed |
| AI Analysis | Pass/Warning/Fail |
| Issues Found | X Critical, X Warning |
| Duration | Xms |

## Automated Test Results (Playwright)

### Test Execution Summary
| Metric | Value |
|--------|-------|
| Total Tests | X |
| Passed | X ✅ |
| Failed | X ❌ |
| Skipped | X ⏭️ |
| Pass Rate | X% |

### Test Suite Results
For each test suite from Playwright results:

#### [Suite Name]
Priority: [priority] | Tests: X passed, X failed

| ID | Test Case | Status | Duration | Details |
|----|-----------|--------|----------|---------|
| [TC001] | Test name | ✅ Pass | Xms | Assertions passed |
| [TC002] | Test name | ❌ Fail | Xms | What failed |

IMPORTANT: Include ALL test cases from Playwright results with their actual status and assertions.

## AI Analysis Results

### Template Comparison Analysis

#### Partner A vs Base Template
**Expected:** Styling differences only (green vs blue color scheme)

Partner A comparison ✅ PASSED (or Partner A comparison ❌ FAILED)

Key findings as bullet points.

#### Partner B vs Base Template
**Expected:** Content differences (additional sections)

Partner B comparison ✅ PASSED (or Partner B comparison ❌ FAILED)

Key findings as bullet points.

IMPORTANT: Always write "Partner A" or "Partner B" followed by status emoji (✅/❌/⚠️) on the same line for clickable links.

## Issues Found

### Critical Issues (from both Playwright and AI)
- Issue: [Description] - Critical - Source: Playwright/AI
- Issue: [Description] - High - Source: Playwright/AI

### Warnings
- Issue: [Description] - Medium - Source: Playwright/AI
- Issue: [Description] - Low - Source: Playwright/AI

IMPORTANT: Always include severity level and source (Playwright/AI) for each issue.

## Recommendations

Numbered list of specific, actionable recommendations based on both automated tests and AI analysis.

## Technical Details

### Playwright Test Details
- Browser: Chromium (headless)
- Screenshots captured: X
- Test results file: playwright-results-*.json

### AI Analysis Details
- Test Plan ID: [ID]
- Templates analyzed: [list]
- Comparison method: [details]

---

FORMATTING RULES:
- Use ✅ for passed tests, ❌ for failed tests, ⚠️ for warnings, ⏭️ for skipped
- Use tables for structured data - ALWAYS include Playwright test results table
- Use bullet points for lists
- Use **bold** for emphasis
- Use \`code\` for file names, values, and technical terms
- Keep paragraphs concise (2-3 sentences max)
- Include specific values and metrics from BOTH Playwright and AI analysis

Respond with the complete markdown report content only, no JSON wrapper needed.`;

export class ReportGeneratorAgent extends BaseAgent {
  constructor() {
    super('ReportGenerator', SYSTEM_PROMPT);
    this.reportsDir = path.resolve(__dirname, '../../test_reports');
    this.webArtifactsDir = path.resolve(__dirname, '../../web/artifacts');
    this.webLogsDir = path.resolve(__dirname, '../../web/logs');
    this.testPlansDir = path.resolve(__dirname, '../output/test-plans');
  }

  /**
   * Convert markdown to HTML with styling
   */
  convertMarkdownToHtml(mdContent, timestamp, status) {
    let htmlBody = mdContent;

    // Tables
    htmlBody = htmlBody.replace(/^\|(.+)\|$/gm, (match, content) => {
      const cells = content.split('|').map(c => c.trim());
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    });
    htmlBody = htmlBody.replace(/(<tr>.*<\/tr>\n?)+/g, (match) => {
      const rows = match.trim().split('\n').filter(r => r.trim());
      if (rows.length > 1) {
        const headerRow = rows[0].replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>');
        const bodyRows = rows.slice(2).join('\n');
        return `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
      }
      return `<table>${match}</table>`;
    });

    // Headers
    htmlBody = htmlBody.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    htmlBody = htmlBody.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    htmlBody = htmlBody.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    htmlBody = htmlBody.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    htmlBody = htmlBody.replace(/^---$/gm, '<hr>');

    // Lists
    htmlBody = htmlBody.replace(/^- (.+)$/gm, '<li>$1</li>');
    htmlBody = htmlBody.replace(/^\d+\. (.+)$/gm, '<li class="numbered">$1</li>');
    htmlBody = htmlBody.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
    htmlBody = htmlBody.replace(/(<li class="numbered">.*<\/li>\n?)+/g, (match) => `<ol>${match.replace(/ class="numbered"/g, '')}</ol>`);

    // Inline formatting
    htmlBody = htmlBody.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    htmlBody = htmlBody.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Add clickable issue links
    htmlBody = htmlBody.replace(/\[(TC\d+)\]/g, (match, testCaseId) => {
      const issueData = JSON.stringify({
        testCaseId,
        title: `Test Case ${testCaseId}`,
        severity: 'medium',
        status: 'info'
      }).replace(/"/g, '&quot;');
      return `<a href="#" class="issue-link" data-issue="${issueData}">[${testCaseId}]</a>`;
    });

    // Convert screenshot links to clickable links with preview
    // Format: [📸 View Diff](/screenshots/diffs/filename.png)
    htmlBody = htmlBody.replace(/\[📸 View Diff\]\(([^)]+)\)/g, (match, screenshotPath) => {
      return `<a href="${screenshotPath}" class="screenshot-link" target="_blank" title="Click to view diff image">📸 View Diff</a>`;
    });

    // Format: [📸](/screenshots/diffs/filename.png) - simplified format from table cells
    htmlBody = htmlBody.replace(/\[📸\]\(([^)]+)\)/g, (match, screenshotPath) => {
      return `<a href="${screenshotPath}" class="screenshot-link" target="_blank" title="Click to view diff image">📸 View</a>`;
    });

    // Format: [Side-by-Side](/screenshots/diffs/filename.png)
    htmlBody = htmlBody.replace(/\[Side-by-Side\]\(([^)]+)\)/g, (match, screenshotPath) => {
      return `<a href="${screenshotPath}" class="screenshot-link comparison-link" target="_blank" title="Click to view side-by-side comparison">📊 Side-by-Side</a>`;
    });

    // Format: [View Diff](/screenshots/diffs/filename.png)
    htmlBody = htmlBody.replace(/\[View Diff\]\(([^)]+)\)/g, (match, screenshotPath) => {
      return `<a href="${screenshotPath}" class="screenshot-link" target="_blank" title="Click to view diff image">🔍 View Diff</a>`;
    });

    // Generic markdown image/link for screenshots paths
    htmlBody = htmlBody.replace(/\[([^\]]+)\]\((\/screenshots\/[^)]+)\)/g, (match, linkText, screenshotPath) => {
      return `<a href="${screenshotPath}" class="screenshot-link" target="_blank" title="Click to view screenshot">${linkText}</a>`;
    });

    htmlBody = htmlBody.replace(/(Partner [AB])[^<]*?(✅|❌|⚠️)/g, (match, partner, statusEmoji) => {
      const linkStatus = statusEmoji === '✅' ? 'pass' : statusEmoji === '❌' ? 'fail' : 'warning';
      const compareTemplate = partner === 'Partner A' ? 'site_visitor_welcome_partner_a' : 'site_visitor_welcome_partner_b';
      const expectedDiff = partner === 'Partner A' ? 'styling' : 'content';
      const issueData = JSON.stringify({
        title: `${partner} Comparison`,
        baseTemplate: 'site_visitor_welcome',
        compareTemplate,
        expectedDifference: expectedDiff,
        status: linkStatus,
        severity: linkStatus === 'fail' ? 'high' : linkStatus === 'warning' ? 'medium' : 'low'
      }).replace(/"/g, '&quot;');
      return `<a href="#" class="issue-link status-${linkStatus}" data-issue="${issueData}">${match}</a>`;
    });

    // Paragraphs
    htmlBody = htmlBody.replace(/^([^<\n].+)$/gm, '<p>$1</p>');
    htmlBody = htmlBody.replace(/<p>\s*<\/p>/g, '');
    htmlBody = htmlBody.replace(/<p>(<h[1-4]>)/g, '$1');
    htmlBody = htmlBody.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
    htmlBody = htmlBody.replace(/<p>(<hr>)<\/p>/g, '$1');
    htmlBody = htmlBody.replace(/<p>(<table>)/g, '$1');
    htmlBody = htmlBody.replace(/(<\/table>)<\/p>/g, '$1');
    htmlBody = htmlBody.replace(/<p>(<ul>)/g, '$1');
    htmlBody = htmlBody.replace(/(<\/ul>)<\/p>/g, '$1');
    htmlBody = htmlBody.replace(/<p>(<ol>)/g, '$1');
    htmlBody = htmlBody.replace(/(<\/ol>)<\/p>/g, '$1');

    // Use the explicitly provided status (from determineOverallStatus)
    // Only fall back to content scanning if no status provided
    let reportStatus = status;
    if (!reportStatus) {
      // Scan markdown content to determine status if not explicitly provided
      if (mdContent.includes('❌ FAIL') || mdContent.includes('Critical')) {
        reportStatus = 'failed';
      } else if (mdContent.includes('⚠️ WARNING') || mdContent.match(/\bWARNING\b/)) {
        reportStatus = 'warning';
      } else {
        reportStatus = 'passed';
      }
    }

    const completedAt = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html lang="en" data-status="${reportStatus}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Template QA Report - ${completedAt}</title>
  <style>
    :root { --color-primary: #1e40af; --color-primary-light: #3b82f6; --color-success: #059669; --color-success-light: #d1fae5; --color-warning: #d97706; --color-warning-light: #fef3c7; --color-error: #dc2626; --color-error-light: #fee2e2; --color-gray-50: #f9fafb; --color-gray-100: #f3f4f6; --color-gray-200: #e5e7eb; --color-gray-500: #6b7280; --color-gray-700: #374151; --color-gray-800: #1f2937; --color-gray-900: #111827; --radius-md: 8px; --radius-lg: 12px; --radius-xl: 16px; --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1); --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1); }
    * { box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 32px 24px; line-height: 1.7; color: var(--color-gray-700); background: linear-gradient(135deg, #f0f4ff 0%, var(--color-gray-50) 100%); min-height: 100vh; }
    .report-header { background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%); border-radius: var(--radius-xl); padding: 32px 40px; margin-bottom: 32px; box-shadow: var(--shadow-lg); color: white; }
    .report-header h1 { margin: 0 0 16px 0; font-size: 28px; font-weight: 700; }
    .report-header .subtitle { opacity: 0.9; font-size: 15px; margin: 0; }
    .meta-bar { display: flex; align-items: center; gap: 24px; margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); flex-wrap: wrap; }
    .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; border-radius: 9999px; font-size: 14px; font-weight: 700; text-transform: uppercase; }
    .status-passed { background: var(--color-success-light); color: var(--color-success); }
    .status-failed { background: var(--color-error-light); color: var(--color-error); }
    .status-warning { background: var(--color-warning-light); color: var(--color-warning); }
    .meta-item { display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.85); font-size: 14px; }
    .report-container { background: white; border-radius: var(--radius-xl); padding: 40px 48px; box-shadow: var(--shadow-md); }
    h1 { color: var(--color-gray-900); font-size: 26px; font-weight: 700; margin: 0 0 24px 0; padding-bottom: 16px; border-bottom: 2px solid var(--color-gray-200); }
    h2 { color: var(--color-gray-900); font-size: 20px; font-weight: 700; margin: 40px 0 20px 0; padding: 16px 20px; background: linear-gradient(90deg, var(--color-gray-50) 0%, transparent 100%); border-left: 4px solid var(--color-primary); border-radius: 0 var(--radius-md) var(--radius-md) 0; }
    h3 { color: var(--color-gray-800); font-size: 17px; font-weight: 600; margin: 28px 0 14px 0; }
    h4 { color: var(--color-gray-700); font-size: 15px; font-weight: 600; margin: 20px 0 10px 0; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 20px 0; border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); border: 1px solid var(--color-gray-200); }
    th { background: var(--color-gray-50); font-weight: 600; text-align: left; padding: 14px 18px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-gray-600); border-bottom: 2px solid var(--color-gray-200); }
    td { padding: 14px 18px; border-bottom: 1px solid var(--color-gray-100); font-size: 14px; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--color-gray-50); }
    code { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 3px 10px; border-radius: 6px; font-size: 13px; font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace; color: var(--color-gray-800); font-weight: 500; }
    hr { border: none; border-top: 2px dashed var(--color-gray-200); margin: 40px 0; }
    ul, ol { padding-left: 0; margin: 16px 0; list-style: none; }
    li { position: relative; padding: 10px 16px 10px 32px; margin: 8px 0; background: var(--color-gray-50); border-radius: var(--radius-md); border-left: 3px solid var(--color-gray-300); }
    li:hover { border-left-color: var(--color-primary); background: white; }
    li::before { content: '→'; position: absolute; left: 12px; color: var(--color-gray-400); font-weight: bold; }
    ol { counter-reset: item; }
    ol li::before { counter-increment: item; content: counter(item) '.'; color: var(--color-primary); font-weight: 700; }
    p { margin: 14px 0; font-size: 15px; }
    strong { color: var(--color-gray-900); font-weight: 600; }
    .issue-link { color: var(--color-primary); text-decoration: none; cursor: pointer; padding: 4px 10px; border-radius: 6px; background: #eff6ff; transition: all 0.2s; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; }
    .issue-link:hover { background: #dbeafe; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); transform: translateY(-1px); }
    .issue-link.status-pass { background: var(--color-success-light); color: var(--color-success); }
    .issue-link.status-fail { background: var(--color-error-light); color: var(--color-error); }
    .issue-link.status-warning { background: var(--color-warning-light); color: var(--color-warning); }
    .issue-link::after { content: '📸'; font-size: 11px; margin-left: 4px; }
    .screenshot-link { color: var(--color-primary); text-decoration: none; cursor: pointer; padding: 4px 12px; border-radius: 6px; background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); transition: all 0.2s; font-weight: 500; display: inline-flex; align-items: center; gap: 4px; margin: 2px 4px; font-size: 13px; border: 1px solid #a5b4fc; }
    .screenshot-link:hover { background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%); box-shadow: 0 2px 4px rgb(0 0 0 / 0.1); transform: translateY(-1px); }
    .screenshot-link.comparison-link { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-color: #f59e0b; color: #92400e; }
    .screenshot-link.comparison-link:hover { background: linear-gradient(135deg, #fde68a 0%, #fbbf24 100%); }
    .diff-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: var(--color-error-light); color: var(--color-error); margin-left: 8px; }
    .diff-badge.low { background: var(--color-success-light); color: var(--color-success); }
    .diff-badge.medium { background: var(--color-warning-light); color: var(--color-warning); }
    .report-footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--color-gray-200); text-align: center; color: var(--color-gray-500); font-size: 13px; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>📋 Email Template QA Report</h1>
    <p class="subtitle">Automated quality assurance testing for email templates</p>
    <div class="meta-bar">
      <span class="status-badge status-${reportStatus}">${reportStatus === 'passed' ? '✓' : reportStatus === 'failed' ? '✗' : '!'} ${reportStatus.toUpperCase()}</span>
      <span class="meta-item">📅 ${completedAt}</span>
    </div>
  </div>
  <div class="report-container">
    ${htmlBody}
    <div class="report-footer">
      <p>Generated by Email Template QA System • Powered by Claude AI</p>
    </div>
  </div>
</body>
</html>`;
  }

  async generateReport(changeAnalysis, diffAnalysis, metadata = {}) {
    this.log('Generating comprehensive report');

    // Format Playwright results for the prompt
    let playwrightSection = 'No Playwright test results available';
    if (metadata.playwrightResults) {
      const pw = metadata.playwrightResults;

      // Group tests by suite
      const testsBySuite = {};
      if (pw.testCases) {
        pw.testCases.forEach(tc => {
          const suite = tc.suite || 'Other Tests';
          if (!testsBySuite[suite]) {
            testsBySuite[suite] = { tests: [], passed: 0, failed: 0, priority: tc.priority || 'medium' };
          }
          testsBySuite[suite].tests.push(tc);
          if (tc.status === 'passed') testsBySuite[suite].passed++;
          else if (tc.status === 'failed') testsBySuite[suite].failed++;
        });
      }

      playwrightSection = `
### Playwright Test Execution Results
- Total Tests: ${pw.totalTests || 0}
- Passed: ${pw.passed || 0}
- Failed: ${pw.failed || 0}
- Skipped: ${pw.skipped || 0}
- Pass Rate: ${pw.totalTests ? ((pw.passed / pw.totalTests) * 100).toFixed(1) : 0}%
- Test Plan ID: ${pw.testPlanId || 'N/A'}

### Test Suites Summary
${Object.entries(testsBySuite).map(([suite, data]) => `
#### ${suite}
Priority: ${data.priority} | Tests: ${data.passed} passed, ${data.failed} failed

| ID | Test Case | Status | Duration | Details |
|----|-----------|--------|----------|---------|
${data.tests.map(tc => {
  const screenshotAssertions = tc.assertions?.filter(a => a.screenshots) || [];
  const firstScreenshot = screenshotAssertions[0]?.screenshots;
  const status = tc.status === 'passed' ? '✅ Pass' : tc.status === 'failed' ? '❌ Fail' : '⏭️ Skip';
  const details = tc.assertions?.filter(a => !a.passed).map(a => a.message).join('; ') ||
                  tc.assertions?.find(a => a.message)?.message || tc.description || 'OK';
  const screenshot = firstScreenshot ? ` [📸](/screenshots/diffs/${firstScreenshot.diff})` : '';
  return `| ${tc.id} | ${tc.name} | ${status} | ${tc.duration}ms | ${details.substring(0, 60)}${screenshot} |`;
}).join('\n')}
`).join('\n')}
`;
    }

    // Get the list of templates being tested
    const templatesList = metadata.templatesTested || [];
    const templatesListStr = templatesList.length > 0 ? templatesList.join(', ') : 'all';

    const prompt = `Generate a professional QA report using the EXACT structure from your system prompt. This report MUST combine both Playwright automated test results AND AI analysis results.

## INPUT DATA

### Test Metadata
- Trigger: ${metadata.trigger || 'manual'}
- Timestamp: ${metadata.timestamp || new Date().toISOString()}
- Templates Tested: ${templatesListStr} (${metadata.templatesCount || templatesList.length} total)
- Duration: ${metadata.duration || 'N/A'}ms

### TEMPLATES BEING TESTED (ONLY INCLUDE THESE IN REPORT)
${templatesListStr}

### PLAYWRIGHT AUTOMATED TEST RESULTS (CRITICAL - MUST INCLUDE IN REPORT)
${playwrightSection}

### Test Plan
${metadata.testPlan ? JSON.stringify(metadata.testPlan, null, 2).substring(0, 2000) : 'No test plan data'}

### AI Change Analysis Results
${JSON.stringify(changeAnalysis, null, 2)}

### AI Diff Analysis Results
${JSON.stringify(diffAnalysis, null, 2)}

## REQUIREMENTS

1. Follow the EXACT report structure from your system prompt
2. **CRITICAL**: ONLY include results for the templates listed above: ${templatesListStr}
3. Do NOT include any templates that are not in the tested list
4. **TEST PLAN ALIGNMENT**: Tests use IDs TC001-TC023 matching the test plan. Group by suite:
   - Template Compilation (TC001-TC004): Verify MJML compiles to valid HTML
   - EJS Variable Rendering (TC005-TC008): Verify EJS variables render correctly
   - Color Scheme Validation (TC009-TC012): Verify correct colors per template
   - Content Validation (TC013-TC016): Verify text content
   - Structure Validation (TC017-TC020): Verify HTML structure per template
   - Cross-Template Comparison (TC021-TC023): Compare templates visually
5. Include the "Automated Test Results" section organized by test suite
6. Create a table for EACH SUITE showing test cases with ID, name, status, duration, and key findings
7. Use proper markdown tables (with header separator row using dashes)
8. Include metrics with actual values from both Playwright and AI analysis
9. Include "AI Analysis Results" section with comparisons for tested templates only
10. List specific issues found with severity levels AND source (Playwright/AI)
11. Provide actionable recommendations based on BOTH Playwright and AI findings
12. Use emoji indicators: ✅ pass, ❌ fail, ⚠️ warning, ⏭️ skipped
13. Keep the report professional and scannable
14. The Executive Summary should reflect COMBINED results from both Playwright and AI
15. **IMPORTANT FOR FAILED TESTS**: When a test has screenshots available, include diff links

Generate the complete markdown report now:`;

    const response = await this.sendMessage(prompt, { maxTokens: 8192 });

    // Save the report - use provided timestamp or generate one
    const reportContent = response.content;
    const timestamp = metadata.timestamp || new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.reportsDir, `qa-report-${timestamp}.md`);

    await fs.mkdir(this.reportsDir, { recursive: true });
    await fs.writeFile(reportPath, reportContent, 'utf-8');

    // Also update the main comparison report
    const mainReportPath = path.join(this.reportsDir, 'comparison-report.md');
    await fs.writeFile(mainReportPath, reportContent, 'utf-8');

    // Determine overall status (considering Playwright results)
    const overallStatus = this.determineOverallStatus(changeAnalysis, diffAnalysis, metadata.playwrightResults);

    // Generate and save HTML report to web/artifacts
    await fs.mkdir(this.webArtifactsDir, { recursive: true });
    const htmlContent = this.convertMarkdownToHtml(reportContent, timestamp, overallStatus);
    const htmlReportPath = path.join(this.webArtifactsDir, `report-${timestamp}.html`);
    await fs.writeFile(htmlReportPath, htmlContent, 'utf-8');
    this.log(`HTML Report saved to: ${htmlReportPath}`);

    // Note: Test plan is already saved by TestPlannerAgent, no need to duplicate

    // Generate JSON summary
    const jsonSummary = {
      timestamp: metadata.timestamp || new Date().toISOString(),
      trigger: metadata.trigger || 'manual',
      duration: metadata.duration,
      testPlan: metadata.testPlan ? {
        id: metadata.testPlan.testPlanId,
        suites: metadata.testPlan.testSuites?.length || 0,
        totalCases: metadata.testPlan.testSuites?.reduce(
          (sum, s) => sum + (s.testCases?.length || 0), 0
        ) || 0
      } : null,
      playwrightResults: metadata.playwrightResults ? {
        totalTests: metadata.playwrightResults.totalTests,
        passed: metadata.playwrightResults.passed,
        failed: metadata.playwrightResults.failed,
        skipped: metadata.playwrightResults.skipped,
        passRate: metadata.playwrightResults.totalTests
          ? ((metadata.playwrightResults.passed / metadata.playwrightResults.totalTests) * 100).toFixed(1) + '%'
          : '0%'
      } : null,
      changeAnalysis: {
        affectedTemplates: changeAnalysis.affectedTemplates || [],
        changeType: changeAnalysis.changeType || 'unknown',
        testingRequired: changeAnalysis.testingRequired
      },
      diffAnalysis: {
        overallAssessment: diffAnalysis.overallAssessment || 'unknown',
        comparisonsCount: diffAnalysis.comparisons?.length || 0
      },
      reportPath,
      htmlReportPath,
      status: overallStatus
    };

    const jsonPath = path.join(this.reportsDir, 'test-summary.json');
    await fs.writeFile(jsonPath, JSON.stringify(jsonSummary, null, 2), 'utf-8');

    this.log(`Report saved to: ${reportPath}`);

    return {
      reportPath,
      htmlReportPath,
      jsonPath,
      content: reportContent,
      summary: jsonSummary
    };
  }

  determineOverallStatus(changeAnalysis, diffAnalysis, playwrightResults = null) {
    // Check Playwright results for actual failures (not warnings)
    if (playwrightResults) {
      // Count actual failures vs warnings
      const failedTests = playwrightResults.testCases?.filter(tc => tc.status === 'failed' && !tc.hasWarnings) || [];
      const warningTests = playwrightResults.testCases?.filter(tc => tc.hasWarnings) || [];

      // Only mark as failed if there are actual failures (not just warnings)
      if (failedTests.length > 0) return 'failed';
      if (warningTests.length > 0) return 'warning';
    }

    // Check AI analysis results
    if (diffAnalysis.overallAssessment === 'fail' || diffAnalysis.overallAssessment === 'failed') return 'failed';
    if (changeAnalysis.warnings?.length > 0) return 'warning';
    if (diffAnalysis.overallAssessment === 'warning') return 'warning';

    // If all tests passed and AI analysis passed, overall pass
    return 'passed';
  }
}

export default ReportGeneratorAgent;
