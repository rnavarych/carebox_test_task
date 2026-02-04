#!/usr/bin/env node

/**
 * Main Test Runner Script
 *
 * Orchestrates all test scripts and generates a comprehensive report.
 * Designed for autonomous execution by Claude Code.
 *
 * Output: Comprehensive JSON report and Markdown report
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../output');
const REPORTS_DIR = path.join(__dirname, '../../test_reports');

async function runScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';

    const proc = spawn('node', [scriptPath], {
      cwd: __dirname,
      env: process.env
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', (code) => {
      resolve({
        script: scriptName,
        exitCode: code,
        duration: Date.now() - startTime,
        stdout,
        stderr,
        success: code === 0
      });
    });

    proc.on('error', (error) => {
      resolve({
        script: scriptName,
        exitCode: -1,
        duration: Date.now() - startTime,
        stdout,
        stderr: error.message,
        success: false
      });
    });
  });
}

async function loadJsonResults(filename) {
  try {
    const content = await fs.readFile(path.join(OUTPUT_DIR, 'compiled', filename), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function generateMarkdownReport(allResults) {
  const compilation = await loadJsonResults('compilation-results.json');
  const rendering = await loadJsonResults('rendering-results.json');
  const validation = await loadJsonResults('validation-results.json');
  const comparison = await loadJsonResults('comparison-results.json');

  let report = `# Email Template QA Report

**Generated:** ${new Date().toISOString()}
**Test Framework Version:** 1.0.0

---

## Executive Summary

| Metric | Status |
|--------|--------|
| Templates Tested | 3 |
| Compilation | ${compilation?.successful || 0}/${compilation?.totalTemplates || 3} passed |
| Rendering | ${rendering?.successful || 0}/${rendering?.totalTemplates || 3} passed |
| Validation | ${validation?.valid || 0}/${validation?.totalTemplates || 3} valid |
| Comparisons | ${comparison?.passed || 0}/${comparison?.totalComparisons || 2} passed |

---

## 1. Template Compilation Results

All MJML templates were compiled to HTML.

| Template | Status | HTML Size |
|----------|--------|-----------|
`;

  if (compilation?.templates) {
    for (const t of compilation.templates) {
      const status = t.success ? '✅ Success' : '❌ Failed';
      report += `| ${t.template} | ${status} | ${t.htmlLength || 'N/A'} bytes |\n`;
    }
  }

  report += `
---

## 2. EJS Rendering Results

Templates were rendered with test data.

| Template | Status | Variables Used |
|----------|--------|----------------|
`;

  if (rendering?.templates) {
    for (const t of rendering.templates) {
      const status = t.success ? '✅ Success' : '❌ Failed';
      const vars = t.variablesUsed?.length || 0;
      report += `| ${t.template} | ${status} | ${vars} variables |\n`;

      if (t.missingVariables?.length > 0) {
        report += `| ↳ Missing: | ${t.missingVariables.join(', ')} | |\n`;
      }
    }
  }

  report += `
---

## 3. HTML Validation Results

Rendered HTML was validated for correctness.

| Template | Valid | Errors | Warnings |
|----------|-------|--------|----------|
`;

  if (validation?.templates) {
    for (const t of validation.templates) {
      const validIcon = t.valid ? '✅' : '❌';
      report += `| ${t.template} | ${validIcon} | ${t.errors?.length || 0} | ${t.warnings?.length || 0} |\n`;
    }
  }

  report += `
---

## 4. Template Comparison Results

### Partner A vs Base Template (Styling Differences)

**Expected:** Different color scheme, same content

`;

  const partnerAComparison = comparison?.comparisons?.find(c => c.compareTemplate === 'site_visitor_welcome_partner_a');
  if (partnerAComparison) {
    report += `**Result:** ${partnerAComparison.analysis}\n\n`;

    if (partnerAComparison.differences?.colors?.added?.length > 0) {
      report += `**New Colors Added:**\n`;
      for (const color of partnerAComparison.differences.colors.added.slice(0, 10)) {
        report += `- \`${color}\`\n`;
      }
      report += '\n';
    }

    if (partnerAComparison.differences?.colors?.removed?.length > 0) {
      report += `**Colors Removed:**\n`;
      for (const color of partnerAComparison.differences.colors.removed.slice(0, 10)) {
        report += `- \`${color}\`\n`;
      }
      report += '\n';
    }
  }

  report += `
### Partner B vs Base Template (Content Differences)

**Expected:** Same color scheme, different content

`;

  const partnerBComparison = comparison?.comparisons?.find(c => c.compareTemplate === 'site_visitor_welcome_partner_b');
  if (partnerBComparison) {
    report += `**Result:** ${partnerBComparison.analysis}\n\n`;

    if (partnerBComparison.differences?.content?.changes?.length > 0) {
      report += `**Content Changes:**\n`;
      for (const change of partnerBComparison.differences.content.changes.slice(0, 10)) {
        const icon = change.type === 'added' ? '+' : '-';
        report += `- ${icon} "${change.value.substring(0, 50)}..."\n`;
      }
      report += '\n';
    }

    if (partnerBComparison.differences?.structure?.differences?.length > 0) {
      report += `**Structural Differences:**\n`;
      for (const diff of partnerBComparison.differences.structure.differences) {
        report += `- ${diff.element}: ${diff.base} → ${diff.compare}\n`;
      }
      report += '\n';
    }
  }

  report += `
---

## 5. Recommendations

`;

  // Generate recommendations based on results
  const recommendations = [];

  if (compilation?.failed > 0) {
    recommendations.push('⚠️ Fix MJML compilation errors before proceeding with testing.');
  }

  if (rendering?.templates?.some(t => t.missingVariables?.length > 0)) {
    recommendations.push('⚠️ Add missing EJS variables to the test data or templates.');
  }

  if (validation?.invalid > 0) {
    recommendations.push('⚠️ Review and fix HTML validation errors for better email client compatibility.');
  }

  if (partnerAComparison && !partnerAComparison.success) {
    recommendations.push('⚠️ Partner A template should have different colors than the base template.');
  }

  if (partnerBComparison && !partnerBComparison.success) {
    recommendations.push('⚠️ Partner B template should have different content than the base template.');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All tests passed! Templates are ready for production.');
  }

  for (const rec of recommendations) {
    report += `${rec}\n\n`;
  }

  report += `
---

## Test Execution Details

| Script | Duration | Exit Code |
|--------|----------|-----------|
`;

  for (const result of allResults) {
    const status = result.success ? '✅' : '❌';
    report += `| ${result.script} | ${result.duration}ms | ${status} ${result.exitCode} |\n`;
  }

  report += `

---

*This report was generated automatically by the Email Template QA Test Framework.*
*Designed for AI-driven quality assurance with Claude Code.*
`;

  return report;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Email Template QA Test Framework                    ║');
  console.log('║        Autonomous AI-Driven Testing Pipeline               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const allResults = [];

  // Ensure directories exist
  await fs.mkdir(path.join(OUTPUT_DIR, 'compiled'), { recursive: true });
  await fs.mkdir(path.join(OUTPUT_DIR, 'screenshots'), { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  // Run tests in sequence
  const scripts = [
    'compile-templates.js',
    'render-with-data.js',
    'validate-html.js',
    'compare-templates.js'
  ];

  // Only run screenshots if not in CI mode (no display)
  const isCi = process.argv.includes('--ci');
  if (!isCi) {
    scripts.push('capture-screenshots.js');
  }

  for (const script of scripts) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${script}`);
    console.log('='.repeat(60) + '\n');

    const result = await runScript(script);
    allResults.push(result);

    if (!result.success) {
      console.log(`\n⚠️ Script ${script} failed with exit code ${result.exitCode}`);
    }
  }

  // Generate comprehensive report
  console.log(`\n${'='.repeat(60)}`);
  console.log('Generating Final Report');
  console.log('='.repeat(60) + '\n');

  const markdownReport = await generateMarkdownReport(allResults);
  const reportPath = path.join(REPORTS_DIR, 'comparison-report.md');
  await fs.writeFile(reportPath, markdownReport, 'utf-8');

  // Save JSON summary
  const jsonSummary = {
    timestamp: new Date().toISOString(),
    totalDuration: Date.now() - startTime,
    scripts: allResults,
    allPassed: allResults.every(r => r.success)
  };

  const jsonPath = path.join(REPORTS_DIR, 'test-summary.json');
  await fs.writeFile(jsonPath, JSON.stringify(jsonSummary, null, 2), 'utf-8');

  // Final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST EXECUTION COMPLETE                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Total Duration: ${jsonSummary.totalDuration}ms`);
  console.log(`Scripts Run: ${allResults.length}`);
  console.log(`Passed: ${allResults.filter(r => r.success).length}`);
  console.log(`Failed: ${allResults.filter(r => !r.success).length}`);
  console.log(`\nReports generated:`);
  console.log(`  - ${reportPath}`);
  console.log(`  - ${jsonPath}`);

  // Exit with appropriate code
  const exitCode = jsonSummary.allPassed ? 0 : 1;
  console.log(`\nExit code: ${exitCode}`);
  process.exit(exitCode);
}

main().catch(console.error);
