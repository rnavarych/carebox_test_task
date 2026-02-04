#!/usr/bin/env node

/**
 * API Server for Multi-Agent Test System
 *
 * Provides HTTP endpoints for triggering tests from the web app.
 *
 * Endpoints:
 *   POST /api/run-tests     - Trigger a full test run
 *   GET  /api/test-status   - Get current test status
 *   GET  /api/latest-report - Get the latest report
 */

import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { AgentOrchestrator } from '../agents/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const REPORTS_DIR = path.resolve(__dirname, '../../test_reports');

class APIServer {
  constructor() {
    this.orchestrator = new AgentOrchestrator();
    this.currentTest = null;
    this.lastResult = null;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [API] ${message}`);
  }

  start() {
    const server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      this.handleRequest(req, res);
    });

    server.listen(PORT, () => {
      this.log(`API Server running on http://localhost:${PORT}`);
      this.log('');
      this.log('Available endpoints:');
      this.log('  POST /api/run-tests     - Trigger test run');
      this.log('  GET  /api/test-status   - Get test status');
      this.log('  GET  /api/latest-report - Get latest report');
      this.log('');
    });
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    try {
      if (url.pathname === '/api/run-tests' && req.method === 'POST') {
        await this.handleRunTests(req, res);
      } else if (url.pathname === '/api/test-status' && req.method === 'GET') {
        await this.handleTestStatus(req, res);
      } else if (url.pathname === '/api/latest-report' && req.method === 'GET') {
        await this.handleLatestReport(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      this.log(`Error handling request: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  async handleRunTests(req, res) {
    if (this.orchestrator.isRunning) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'busy',
        message: 'Test already in progress'
      }));
      return;
    }

    // Start test in background
    this.currentTest = {
      startedAt: new Date().toISOString(),
      status: 'running'
    };

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'started',
      message: 'Test started'
    }));

    // Run tests asynchronously
    this.log('Test triggered via API');

    try {
      this.lastResult = await this.orchestrator.runTests({
        trigger: 'web_api',
        forceFullTest: true
      });

      this.currentTest = null;
      this.log('Test completed via API');
    } catch (error) {
      this.lastResult = {
        status: 'error',
        error: error.message
      };
      this.currentTest = null;
      this.log(`Test failed: ${error.message}`);
    }
  }

  async handleTestStatus(req, res) {
    const status = {
      isRunning: this.orchestrator.isRunning,
      currentTest: this.currentTest,
      lastResult: this.lastResult ? {
        status: this.lastResult.status,
        trigger: this.lastResult.trigger,
        duration: this.lastResult.duration,
        report: this.lastResult.report
      } : null
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  }

  async handleLatestReport(req, res) {
    try {
      const reportPath = path.join(REPORTS_DIR, 'comparison-report.md');
      const content = await fs.readFile(reportPath, 'utf-8');

      res.writeHead(200, { 'Content-Type': 'text/markdown' });
      res.end(content);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Report not found' }));
    }
  }
}

// Start server
const server = new APIServer();
server.start();

export default APIServer;
