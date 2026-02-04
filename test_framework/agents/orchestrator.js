import { TestPlannerAgent } from './test-planner-agent.js';
import { ChangeAnalyzerAgent } from './change-analyzer-agent.js';
import { DiffAnalyzerAgent } from './diff-analyzer-agent.js';
import { ReportGeneratorAgent } from './report-generator-agent.js';
import {
  TEMPLATE_NAMES,
  PIPELINE_STEPS,
  STEP_MARKERS,
  getStepMeta,
  PATHS,
} from '../config/constants.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Agent Orchestrator
 *
 * Coordinates the execution of all agents in the test pipeline.
 * Manages the flow: Planning → Change Analysis → Diff Analysis → Reporting
 */
export class AgentOrchestrator {
  constructor() {
    this.testPlanner = new TestPlannerAgent();
    this.changeAnalyzer = new ChangeAnalyzerAgent();
    this.diffAnalyzer = new DiffAnalyzerAgent();
    this.reportGenerator = new ReportGeneratorAgent();
    this.isRunning = false;
  }

  /**
   * Log a message with timestamp
   */
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Orchestrator] ${message}`);
  }

  /**
   * Emit a step marker for UI progress tracking
   */
  emitStepMarker(stepId) {
    const marker = STEP_MARKERS[stepId];
    if (marker) {
      console.log(marker);
    }
  }

  /**
   * Compile MJML templates to HTML before testing
   * Only compiles templates that don't have compiled HTML or are outdated
   */
  async compileTemplates(templates = null) {
    return new Promise((resolve, reject) => {
      this.log('Compiling MJML templates to HTML...');

      const scriptPath = path.resolve(__dirname, '../scripts/compile-templates.js');

      // Set TEST_TEMPLATES env var if specific templates requested
      const env = { ...process.env };
      if (templates && templates.length > 0) {
        env.TEST_TEMPLATES = templates.join(',');
      }

      const compileProcess = spawn('node', [scriptPath], {
        cwd: path.resolve(__dirname, '..'),
        env,
        stdio: 'pipe',
      });

      let output = '';

      compileProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Forward compilation output
        process.stdout.write(text);
      });

      compileProcess.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      compileProcess.on('close', (code) => {
        if (code === 0) {
          this.log('Template compilation complete');
          resolve({ success: true, output });
        } else {
          this.log(`Template compilation failed with code ${code}`);
          resolve({ success: false, output, exitCode: code });
        }
      });

      compileProcess.on('error', (error) => {
        this.log(`Compilation error: ${error.message}`);
        resolve({ success: false, error: error.message });
      });
    });
  }

  /**
   * Check if compiled HTML exists for templates
   */
  checkCompiledHtml(templates) {
    const compiledDir = PATHS.OUTPUT_COMPILED;
    const missing = [];

    for (const template of templates) {
      const baseName = template.replace('.mjml', '');
      const htmlPath = path.join(compiledDir, `${baseName}.html`);

      if (!fsSync.existsSync(htmlPath)) {
        missing.push(template);
      }
    }

    return missing;
  }

  /**
   * Run Playwright tests based on test plan
   */
  async runPlaywrightTests() {
    return new Promise((resolve, reject) => {
      this.log('Running Playwright tests...');

      const scriptPath = path.resolve(__dirname, '../scripts/run-playwright-tests.js');
      const testProcess = spawn('node', [scriptPath], {
        cwd: path.resolve(__dirname, '..'),
        env: process.env,
        stdio: 'pipe',
      });

      let output = '';
      let errorOutput = '';

      testProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Forward to console
        process.stdout.write(text);
      });

      testProcess.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        process.stderr.write(text);
      });

      testProcess.on('close', async (code) => {
        // Try to read the results file
        try {
          const resultsDir = path.resolve(__dirname, '../output/test-results');
          const files = await fs.readdir(resultsDir);
          const latestResult = files
            .filter(f => f.startsWith('playwright-results-'))
            .sort()
            .pop();

          if (latestResult) {
            const resultsPath = path.join(resultsDir, latestResult);
            const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
            resolve({
              exitCode: code,
              results,
              output,
            });
          } else {
            resolve({
              exitCode: code,
              results: null,
              output,
            });
          }
        } catch (error) {
          resolve({
            exitCode: code,
            results: null,
            output,
            error: error.message,
          });
        }
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Run the full test pipeline
   */
  async runTests(options = {}) {
    const {
      trigger = 'manual',
      changeEvents = [],
      forceFullTest = false,
      skipPlanning = false,
      templates = null,
    } = options;

    if (this.isRunning) {
      this.log('Test already in progress, skipping...');
      return { status: 'skipped', reason: 'already_running' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    // Use a single timestamp for all artifacts in this run (from env if available)
    const runTimestamp = process.env.RUN_TIMESTAMP || new Date().toISOString().replace(/[:.]/g, '-');

    this.log('═'.repeat(60));
    this.log('Starting Multi-Agent QA Test');
    this.log(`Trigger: ${trigger}`);
    this.log('═'.repeat(60));

    try {
      // Determine which templates to test FIRST (before any phase)
      let templatesToTest;
      if (templates && templates.length > 0) {
        // Use explicitly specified templates (remove .mjml extension if present)
        templatesToTest = templates.map(t => t.replace('.mjml', ''));
        this.log(`Testing specified templates: ${templatesToTest.join(', ')}`);
      } else {
        // Use default template list from constants (all templates)
        templatesToTest = [...TEMPLATE_NAMES];
        this.log(`Testing all templates: ${templatesToTest.join(', ')}`);
      }

      // Pre-Phase: Compile Templates
      this.log('');
      this.log('Pre-Phase: Template Compilation');
      this.log('─'.repeat(40));

      // Compile selected templates to ensure HTML is up-to-date
      const compileResult = await this.compileTemplates(templatesToTest);
      if (!compileResult.success) {
        this.log('Warning: Some templates may not have compiled successfully');
      }

      // Phase 0: Test Planning (only for selected templates)
      let testPlanResult = null;
      if (!skipPlanning) {
        this.log('');
        this.emitStepMarker(PIPELINE_STEPS.PLANNER);
        this.log('Phase 0: Test Planning');
        this.log('─'.repeat(40));

        testPlanResult = await this.testPlanner.createTestPlan(templatesToTest);

        this.log('Test Plan Created');
        this.log(`  Plan ID: ${testPlanResult.testPlan.testPlanId || 'generated'}`);
        this.log(`  Test Suites: ${testPlanResult.testPlan.testSuites?.length || 'N/A'}`);

        if (testPlanResult.testPlan.testSuites) {
          const totalCases = testPlanResult.testPlan.testSuites.reduce(
            (sum, suite) => sum + (suite.testCases?.length || 0),
            0
          );
          this.log(`  Total Test Cases: ${totalCases}`);
        }
      }

      // Phase 1: Change Analysis (only for selected templates)
      this.log('');
      this.emitStepMarker(PIPELINE_STEPS.ANALYZER);
      this.log('Phase 1: Change Analysis');
      this.log('─'.repeat(40));

      let changeAnalysis;
      if (changeEvents.length > 0) {
        changeAnalysis = await this.changeAnalyzer.analyzeChanges(changeEvents, templatesToTest);
      } else {
        changeAnalysis = await this.changeAnalyzer.analyzeChanges([
          { type: 'full_scan', reason: forceFullTest ? 'forced' : 'manual_trigger' },
        ], templatesToTest);
      }

      this.log('Change Analysis Complete');
      this.log(`  Affected Templates: ${changeAnalysis.affectedTemplates?.join(', ') || 'all'}`);
      this.log(`  Testing Required: ${changeAnalysis.testingRequired}`);

      // Phase 2: Diff Analysis (only for selected templates)
      this.log('');
      this.emitStepMarker(PIPELINE_STEPS.DIFF);
      this.log('Phase 2: Diff Analysis');
      this.log('─'.repeat(40));

      const diffAnalysis = await this.diffAnalyzer.analyzeTemplates(templatesToTest);

      this.log('Diff Analysis Complete');
      this.log(`  Overall Assessment: ${diffAnalysis.overallAssessment}`);
      this.log(`  Comparisons Made: ${diffAnalysis.comparisons?.length || 0}`);

      // Phase 2.5: Playwright Tests (if test plan exists)
      let playwrightResults = null;
      if (testPlanResult?.testPlan) {
        this.log('');
        this.log('Phase 2.5: Playwright Tests');
        this.log('─'.repeat(40));

        try {
          const pwResults = await this.runPlaywrightTests();
          playwrightResults = pwResults.results;

          if (playwrightResults) {
            this.log(`  Total Tests: ${playwrightResults.totalTests}`);
            this.log(`  Passed: ${playwrightResults.passed}`);
            this.log(`  Failed: ${playwrightResults.failed}`);
          }
        } catch (error) {
          this.log(`  Playwright tests failed: ${error.message}`);
        }
      }

      // Phase 3: Report Generation
      this.log('');
      this.emitStepMarker(PIPELINE_STEPS.REPORTER);
      this.log('Phase 3: Report Generation');
      this.log('─'.repeat(40));

      const report = await this.reportGenerator.generateReport(changeAnalysis, diffAnalysis, {
        trigger,
        timestamp: runTimestamp,
        templatesCount: templatesToTest.length,
        templatesTested: templatesToTest,
        duration: Date.now() - startTime,
        testPlan: testPlanResult?.testPlan,
        playwrightResults: playwrightResults,
      });

      this.log(`Report Generated: ${report.reportPath}`);

      // Final Summary
      const duration = Date.now() - startTime;
      this.log('');
      this.log('═'.repeat(60));
      this.log(`Test Complete in ${duration}ms`);
      this.log(`Status: ${report.summary.status.toUpperCase()}`);
      this.log('═'.repeat(60));

      return {
        status: 'complete',
        trigger,
        duration,
        testPlan: testPlanResult?.testPlan,
        changeAnalysis,
        diffAnalysis,
        report: report.summary,
        reportPath: report.reportPath,
      };
    } catch (error) {
      this.log(`Error during test execution: ${error.message}`);
      console.error(error);

      return {
        status: 'error',
        trigger,
        error: error.message,
        stack: error.stack,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

export default AgentOrchestrator;
