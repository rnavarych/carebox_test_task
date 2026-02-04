#!/usr/bin/env node

/**
 * Template File Watcher
 *
 * Watches the email_templates folder for changes and triggers
 * the multi-agent test system when files are created, modified, or deleted.
 */

import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import { AgentOrchestrator } from '../agents/orchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.resolve(__dirname, '../../email_templates');
const DEBOUNCE_MS = 2000; // Wait 2 seconds after last change before running tests

class TemplateWatcher {
  constructor() {
    this.orchestrator = new AgentOrchestrator();
    this.pendingChanges = [];
    this.debounceTimer = null;
  }

  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Watcher] ${message}`);
  }

  start() {
    this.log('Starting template file watcher...');
    this.log(`Watching: ${TEMPLATES_DIR}`);

    const watcher = chokidar.watch(TEMPLATES_DIR, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('add', (filePath) => this.handleChange('created', filePath))
      .on('change', (filePath) => this.handleChange('modified', filePath))
      .on('unlink', (filePath) => this.handleChange('deleted', filePath))
      .on('error', (error) => this.log(`Watcher error: ${error.message}`));

    this.log('Watcher started. Press Ctrl+C to stop.');
    this.log('');

    // Keep process running
    process.on('SIGINT', () => {
      this.log('Stopping watcher...');
      watcher.close();
      process.exit(0);
    });
  }

  handleChange(eventType, filePath) {
    // Only watch .mjml files
    if (!filePath.endsWith('.mjml')) return;

    const relativePath = path.relative(TEMPLATES_DIR, filePath);
    const templateFolder = relativePath.split(path.sep)[0];

    this.log(`File ${eventType}: ${relativePath}`);

    this.pendingChanges.push({
      type: eventType,
      path: relativePath,
      template: templateFolder,
      timestamp: new Date().toISOString()
    });

    // Debounce - wait for more changes before running tests
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.runTests();
    }, DEBOUNCE_MS);
  }

  async runTests() {
    const changes = [...this.pendingChanges];
    this.pendingChanges = [];

    this.log('');
    this.log('Changes detected, triggering multi-agent test system...');

    try {
      const result = await this.orchestrator.runTests({
        trigger: 'file_watch',
        changeEvents: changes
      });

      if (result.status === 'complete') {
        this.log(`Tests completed. Status: ${result.report.status}`);
      } else if (result.status === 'skipped') {
        this.log('Tests skipped: ' + result.reason);
      } else {
        this.log('Tests failed: ' + result.error);
      }
    } catch (error) {
      this.log(`Error running tests: ${error.message}`);
    }

    this.log('');
    this.log('Continuing to watch for changes...');
  }
}

// Start watcher
const watcher = new TemplateWatcher();
watcher.start();
