#!/usr/bin/env node

/**
 * Multi-Agent Test Runner
 *
 * Run the multi-agent QA system manually from the command line.
 *
 * Usage:
 *   node scripts/run-agents.js              # Run full test
 *   node scripts/run-agents.js --watch      # Start file watcher
 *   node scripts/run-agents.js --server     # Start API server
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env from test_framework directory first, then from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { AgentOrchestrator } from '../agents/orchestrator.js';

// Log capture for saving to file
const logLines = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function captureLog(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  logLines.push(`[${timestamp}] [INFO] ${message}`);
  originalConsoleLog.apply(console, args);
}

function captureError(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  logLines.push(`[${timestamp}] [ERROR] ${message}`);
  originalConsoleError.apply(console, args);
}

// Web directories for artifacts
const WEB_LOGS_DIR = path.resolve(__dirname, '../../web/logs');

async function saveLogFile(timestamp) {
  try {
    if (!fs.existsSync(WEB_LOGS_DIR)) {
      fs.mkdirSync(WEB_LOGS_DIR, { recursive: true });
    }
    const logFileName = `test-${timestamp}.log`;
    const logContent = logLines.join('\n');
    fs.writeFileSync(path.join(WEB_LOGS_DIR, logFileName), logContent);
    originalConsoleLog(`\nLog file saved to: web/logs/${logFileName}`);
  } catch (err) {
    originalConsoleError('Failed to save log file:', err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--watch')) {
    // Import and run watcher
    await import('./watch-templates.js');
    return;
  }

  if (args.includes('--server')) {
    // Import and run server
    await import('./api-server.js');
    return;
  }

  // Generate timestamp for all artifacts FIRST (before capturing logs)
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Set timestamp in environment for orchestrator to use
  process.env.RUN_TIMESTAMP = runTimestamp;

  // Capture console output for log file
  console.log = captureLog;
  console.error = captureError;

  // Run tests manually
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Multi-Agent Email Template QA System                ║');
  console.log('║        Powered by Claude AI                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check for selected templates from environment
  const selectedTemplates = process.env.TEST_TEMPLATES
    ? process.env.TEST_TEMPLATES.split(',').filter(t => t.trim())
    : [];

  if (selectedTemplates.length > 0) {
    console.log(`Testing selected templates: ${selectedTemplates.join(', ')}`);
    console.log('');
  }

  const orchestrator = new AgentOrchestrator();

  try {
    const result = await orchestrator.runTests({
      trigger: 'cli',
      forceFullTest: true,
      templates: selectedTemplates.length > 0 ? selectedTemplates : null
    });

    console.log('');
    console.log('Final Result:', JSON.stringify(result.report || { status: result.status }, null, 2));

    // Save log file with same timestamp pattern
    await saveLogFile(runTimestamp);

    console.log('');
    console.log('═'.repeat(60));
    console.log('Artifacts saved to web app:');
    console.log(`  - Report: web/artifacts/report-*.html`);
    console.log(`  - Logs: web/logs/test-${runTimestamp}.log`);
    console.log(`  - Test Plan: test_framework/output/test-plans/test-plan-*.json`);
    console.log('');
    console.log('View results at: http://localhost:5173/reports');
    console.log('═'.repeat(60));

    process.exit(result.status === 'complete' ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error.message);
    await saveLogFile(runTimestamp);
    process.exit(1);
  }
}

main();
