/**
 * Production Server for Email Template QA System
 * Serves the built React app and handles API routes
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import https from 'https';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import mjml2html from 'mjml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Paths
const TEMPLATES_DIR = path.resolve(__dirname, '../email_templates');
const TEST_FRAMEWORK_DIR = path.resolve(__dirname, '../test_framework');
const REPORTS_DIR = path.resolve(__dirname, '../test_reports');
const ARTIFACTS_DIR = path.resolve(__dirname, 'artifacts');
const LOGS_DIR = path.resolve(__dirname, 'logs');
const PLANS_DIR = path.resolve(TEST_FRAMEWORK_DIR, 'output/test-plans');
const SETTINGS_FILE = path.resolve(__dirname, '.settings.json');

// Ensure directories exist
[ARTIFACTS_DIR, LOGS_DIR, REPORTS_DIR, PLANS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================================================
// FILE PATTERN HELPERS
// ============================================================================

const FILE_PATTERNS = {
  testPlanRegex: /test-plan-(.+)/,
  logFileRegex: /test-(.+)\.log/,
  reportFileRegex: /report-(.+)/,
};

const extractTimestamp = (identifier, type) => {
  const patterns = {
    testPlan: FILE_PATTERNS.testPlanRegex,
    log: FILE_PATTERNS.logFileRegex,
    report: FILE_PATTERNS.reportFileRegex,
  };
  const match = identifier.match(patterns[type]);
  return match ? match[1] : null;
};

const getLinkedFilePaths = (timestamp) => ({
  testPlan: path.join(PLANS_DIR, `test-plan-${timestamp}.json`),
  log: path.join(LOGS_DIR, `test-${timestamp}.log`),
  report: path.join(ARTIFACTS_DIR, `report-${timestamp}.html`),
});

const deleteIfExists = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

const deleteLinkedFiles = (timestamp, excludeType = null) => {
  const paths = getLinkedFilePaths(timestamp);
  const deleted = { testPlan: false, log: false, report: false };
  if (excludeType !== 'testPlan') deleted.testPlan = deleteIfExists(paths.testPlan);
  if (excludeType !== 'log') deleted.log = deleteIfExists(paths.log);
  if (excludeType !== 'report') deleted.report = deleteIfExists(paths.report);
  return deleted;
};

// State
let testState = {
  isRunning: false,
  lastResult: null,
  currentTest: null,
  pipelineStep: null,
  stepDescription: null,
  logs: []
};

// Default API key from environment (fallback)
const DEFAULT_API_KEY = process.env.ANTHROPIC_API_KEY || null;

let apiState = {
  apiKey: null, // User's custom key (if set)
  useDefaultKey: true, // Whether to use default key
  lastError: null,
  lastWarning: null
};

// Auto-test setting
let autoTestEnabled = false;

// Test mode setting: 'strict' or 'weak'
let testMode = 'strict';

// Get the active API key (user's key or default)
const getActiveApiKey = () => {
  if (apiState.apiKey && !apiState.useDefaultKey) {
    return apiState.apiKey;
  }
  return DEFAULT_API_KEY;
};

// Load settings
const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      if (data.apiKey) {
        apiState.apiKey = data.apiKey;
        apiState.useDefaultKey = data.useDefaultKey !== false;
      }
      autoTestEnabled = data.autoTestEnabled || false;
      testMode = data.testMode || 'strict';
    }
  } catch (e) {
    console.warn('Failed to load settings:', e.message);
  }
};

const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      apiKey: apiState.apiKey,
      useDefaultKey: apiState.useDefaultKey,
      autoTestEnabled: autoTestEnabled,
      testMode: testMode
    }, null, 2));
  } catch (e) {
    console.warn('Failed to save settings:', e.message);
  }
};

loadSettings();

// Trigger auto-test if enabled
const triggerAutoTest = (changedTemplate) => {
  if (!autoTestEnabled || testState.isRunning) return;

  console.log(`[Auto-Test] Triggered by change to: ${changedTemplate}`);

  testState.isRunning = true;
  testState.logs = [];
  testState.currentTest = {
    startedAt: new Date().toISOString(),
    status: 'running',
    templates: [changedTemplate],
    step: 'init',
    stepDescription: 'Auto-test triggered by file change...',
    progress: 0
  };

  const testEnv = { ...process.env };
  const activeKey = getActiveApiKey();
  if (activeKey) testEnv.ANTHROPIC_API_KEY = activeKey;
  testEnv.TEST_TEMPLATES = changedTemplate;
  testEnv.TEST_MODE = testMode; // Pass test mode to the pipeline

  const testProcess = spawn('node', ['scripts/run-agents.js'], {
    cwd: TEST_FRAMEWORK_DIR,
    env: testEnv
  });

  let output = '';

  testProcess.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(text);

    const lines = text.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      testState.logs.push({
        timestamp: new Date().toISOString(),
        message: line,
        type: line.includes('Error') ? 'error' : line.includes('Warning') ? 'warning' :
              line.includes('Complete') ? 'success' : line.includes('[STEP:') ? 'step' : 'info'
      });
    });
    if (testState.logs.length > 200) testState.logs = testState.logs.slice(-200);

    // Update step
    if (text.includes('[STEP:planner]')) {
      testState.currentTest.step = 'planner';
      testState.currentTest.stepDescription = 'Analyzing requirements...';
      testState.currentTest.progress = 25;
    } else if (text.includes('[STEP:analyzer]')) {
      testState.currentTest.step = 'analyzer';
      testState.currentTest.stepDescription = 'Detecting changes...';
      testState.currentTest.progress = 50;
    } else if (text.includes('[STEP:diff]')) {
      testState.currentTest.step = 'diff';
      testState.currentTest.stepDescription = 'Comparing templates...';
      testState.currentTest.progress = 75;
    } else if (text.includes('[STEP:reporter]')) {
      testState.currentTest.step = 'reporter';
      testState.currentTest.stepDescription = 'Generating report...';
      testState.currentTest.progress = 90;
    }
  });

  testProcess.stderr.on('data', (data) => {
    output += data.toString();
    console.error(data.toString());
  });

  testProcess.on('close', (code) => {
    testState.isRunning = false;
    const completedAt = new Date().toISOString();

    testState.lastResult = {
      status: code === 0 ? 'complete' : 'error',
      exitCode: code,
      completedAt,
      output: output.slice(-5000),
      autoTriggered: true
    };
    testState.currentTest = null;

    // Note: Logs and reports are saved by the CLI pipeline (run-agents.js and report-generator-agent.js)
    // No need to save duplicates here - just log completion
    console.log(`[Auto-Test] Completed with exit code ${code}`);
  });
};

// Template metadata
const TEMPLATE_META = {
  'site_visitor_welcome': {
    name: 'Site Visitor Welcome',
    description: 'Base template - Standard welcome email with blue color scheme',
    type: 'base'
  },
  'site_visitor_welcome_partner_a': {
    name: 'Partner A Welcome',
    description: 'Partner A variation - Same content, green color scheme',
    type: 'partner_a'
  },
  'site_visitor_welcome_partner_b': {
    name: 'Partner B Welcome',
    description: 'Partner B variation - Same colors, different content',
    type: 'partner_b'
  }
};

// Helper: Process EJS includes
const processIncludes = (content, currentDir, depth = 0) => {
  if (depth > 10) return content;
  return content.replace(/<%[-_]?\s*include\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*\{[^}]*\})?\s*\)\s*%>/g, (match, includePath) => {
    try {
      let includeFullPath = path.resolve(currentDir, includePath);
      if (!path.extname(includeFullPath)) includeFullPath += '.ejs';
      if (fs.existsSync(includeFullPath)) {
        const includeContent = fs.readFileSync(includeFullPath, 'utf-8');
        return processIncludes(includeContent, path.dirname(includeFullPath), depth + 1);
      }
    } catch (e) {
      console.warn(`Warning: Could not include ${includePath}: ${e.message}`);
    }
    return match;
  });
};

// API: List templates
app.get('/api/templates', (req, res) => {
  try {
    const emailsDir = path.join(TEMPLATES_DIR, 'emails');
    const files = fs.readdirSync(emailsDir).filter(f => f.endsWith('.mjml'));

    const templates = files.map(file => {
      const name = file.replace('.mjml', '');
      const meta = TEMPLATE_META[name] || {};
      const stats = fs.statSync(path.join(emailsDir, file));

      return {
        file,
        name: meta.name || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description: meta.description || '',
        type: meta.type || 'base',
        fileInfo: { size: stats.size, modified: stats.mtime }
      };
    });

    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Serve templates and static assets
app.get('/templates/*', (req, res) => {
  const urlPath = req.params[0];
  const filePath = path.resolve(TEMPLATES_DIR, urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();

    // Handle image files
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon'
      };
      res.type(mimeTypes[ext] || 'application/octet-stream');
      res.send(fs.readFileSync(filePath));
      return;
    }

    // Handle text files (MJML, EJS, etc.)
    let content = fs.readFileSync(filePath, 'utf-8');
    if (ext === '.mjml') {
      content = processIncludes(content, path.dirname(filePath));
    }
    res.type('text/plain').send(content);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// API: Get test data
app.get('/api/test-data', (req, res) => {
  try {
    const testDataPath = path.resolve(TEST_FRAMEWORK_DIR, 'test-data/sample-context.json');
    const data = fs.readFileSync(testDataPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Save template
app.post('/api/save-template', (req, res) => {
  const { file, content } = req.body;
  if (!file || !content || !file.endsWith('.mjml')) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const templatePath = path.join(TEMPLATES_DIR, 'emails', file);
    fs.writeFileSync(templatePath, content, 'utf-8');
    res.json({ success: true });

    // Trigger auto-test if enabled
    const templateName = file.replace('.mjml', '');
    triggerAutoTest(templateName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Create template
app.post('/api/create-template', (req, res) => {
  const { name, copyFrom } = req.body;
  const fileName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  if (!fileName) {
    return res.status(400).json({ error: 'Invalid template name' });
  }

  const emailsDir = path.join(TEMPLATES_DIR, 'emails');
  const newFilePath = path.join(emailsDir, `${fileName}.mjml`);

  if (fs.existsSync(newFilePath)) {
    return res.status(400).json({ error: 'Template already exists' });
  }

  try {
    let templateContent = `<%- include('../shared/variables') %>
<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>New template content</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

    if (copyFrom) {
      const sourcePath = path.join(emailsDir, copyFrom);
      if (fs.existsSync(sourcePath)) {
        templateContent = fs.readFileSync(sourcePath, 'utf-8');
      }
    }

    fs.writeFileSync(newFilePath, templateContent);
    res.json({ success: true, file: `${fileName}.mjml` });

    // Trigger auto-test if enabled
    triggerAutoTest(fileName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete template
app.post('/api/delete-template', (req, res) => {
  const { file } = req.body;
  if (!file || !file.endsWith('.mjml')) {
    return res.status(400).json({ error: 'Invalid file' });
  }

  try {
    const templateName = file.replace('.mjml', '');
    const filePath = path.join(TEMPLATES_DIR, 'emails', file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Template not found' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true });

    // Trigger auto-test if enabled (test remaining templates after deletion)
    triggerAutoTest(templateName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Run tests
app.post('/api/run-tests', (req, res) => {
  if (testState.isRunning) {
    return res.status(409).json({ status: 'busy', message: 'Test already in progress' });
  }

  const selectedTemplates = req.body.templates || [];

  testState.isRunning = true;
  testState.logs = [];
  testState.currentTest = {
    startedAt: new Date().toISOString(),
    status: 'running',
    templates: selectedTemplates.length > 0 ? selectedTemplates : 'all',
    step: 'init',
    stepDescription: 'Initializing test pipeline...',
    progress: 0
  };

  res.json({
    status: 'started',
    message: selectedTemplates.length > 0
      ? `Testing ${selectedTemplates.length} template(s)`
      : 'Testing all templates'
  });

  // Run tests in background
  const testEnv = { ...process.env };
  const activeKey = getActiveApiKey();
  if (activeKey) testEnv.ANTHROPIC_API_KEY = activeKey;
  if (selectedTemplates.length > 0) testEnv.TEST_TEMPLATES = selectedTemplates.join(',');
  testEnv.TEST_MODE = testMode; // Pass test mode to the pipeline

  const testProcess = spawn('node', ['scripts/run-agents.js'], {
    cwd: TEST_FRAMEWORK_DIR,
    env: testEnv
  });

  let output = '';

  testProcess.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log(text);

    const lines = text.split('\n').filter(l => l.trim());
    lines.forEach(line => {
      testState.logs.push({
        timestamp: new Date().toISOString(),
        message: line,
        type: line.includes('Error') ? 'error' : line.includes('Warning') ? 'warning' :
              line.includes('Complete') ? 'success' : line.includes('[STEP:') ? 'step' : 'info'
      });
    });
    if (testState.logs.length > 200) testState.logs = testState.logs.slice(-200);

    // Update step
    if (text.includes('[STEP:planner]')) {
      testState.currentTest.step = 'planner';
      testState.currentTest.stepDescription = 'Analyzing requirements...';
      testState.currentTest.progress = 25;
    } else if (text.includes('[STEP:analyzer]')) {
      testState.currentTest.step = 'analyzer';
      testState.currentTest.stepDescription = 'Detecting changes...';
      testState.currentTest.progress = 50;
    } else if (text.includes('[STEP:diff]')) {
      testState.currentTest.step = 'diff';
      testState.currentTest.stepDescription = 'Comparing templates...';
      testState.currentTest.progress = 75;
    } else if (text.includes('[STEP:reporter]')) {
      testState.currentTest.step = 'reporter';
      testState.currentTest.stepDescription = 'Generating report...';
      testState.currentTest.progress = 90;
    }
  });

  testProcess.stderr.on('data', (data) => {
    output += data.toString();
    console.error(data.toString());
  });

  testProcess.on('close', (code) => {
    testState.isRunning = false;
    const completedAt = new Date().toISOString();

    testState.lastResult = {
      status: code === 0 ? 'complete' : 'error',
      exitCode: code,
      completedAt,
      output: output.slice(-5000)
    };
    testState.currentTest = null;

    // Note: Logs and reports are saved by the CLI pipeline (run-agents.js and report-generator-agent.js)
    // No need to save duplicates here - just log completion
    console.log(`Test completed with exit code ${code}`);
  });
});

// API: Test status
app.get('/api/test-status', (req, res) => {
  res.json({
    isRunning: testState.isRunning,
    currentTest: testState.currentTest,
    lastResult: testState.lastResult,
    logs: testState.logs || []
  });
});

// API: Reports list
app.get('/api/reports', (req, res) => {
  try {
    if (!fs.existsSync(ARTIFACTS_DIR)) {
      return res.json({ reports: [] });
    }

    const files = fs.readdirSync(ARTIFACTS_DIR).filter(f => f.endsWith('.html'));
    const reports = files.map(file => {
      const filePath = path.join(ARTIFACTS_DIR, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      const statusMatch = content.match(/data-status="([^"]+)"/);

      return {
        id: file.replace('.html', ''),
        file,
        status: statusMatch ? statusMatch[1] : 'unknown',
        createdAt: stats.birthtime,
        size: stats.size
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get specific report
app.get('/api/reports/:id', (req, res) => {
  const filePath = path.join(ARTIFACTS_DIR, `${req.params.id}.html`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' });
  }
  res.type('text/html').send(fs.readFileSync(filePath, 'utf-8'));
});

// API: Delete report (with cascading delete of linked files)
app.post('/api/delete-report', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing report id' });

  const filePath = path.join(ARTIFACTS_DIR, `${id}.html`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  try {
    // Extract timestamp and delete linked files
    const timestamp = extractTimestamp(id, 'report');
    let linkedDeleted = { testPlan: false, log: false };
    if (timestamp) {
      linkedDeleted = deleteLinkedFiles(timestamp, 'report');
    }

    // Delete the report itself
    fs.unlinkSync(filePath);
    res.json({ success: true, linkedDeleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Logs list
app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return res.json({ logs: [] });
    }

    const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
    const logs = files.map(file => {
      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        file,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        size: stats.size
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get specific log content
app.get('/api/logs/:file', (req, res) => {
  const file = req.params.file;
  if (!file.endsWith('.log')) {
    return res.status(400).json({ error: 'Invalid file' });
  }

  const filePath = path.join(LOGS_DIR, file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Log file not found' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('text/plain').send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Test plans
app.get('/api/test-plans', (req, res) => {
  try {
    if (!fs.existsSync(PLANS_DIR)) {
      return res.json({ plans: [] });
    }

    const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.json') && f !== 'latest-test-plan.json');
    const plans = files.map(file => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(PLANS_DIR, file), 'utf-8'));
        return {
          id: file.replace('.json', ''),
          file,
          createdAt: content.createdAt,
          testPlanId: content.testPlanId,
          templateContext: content.templateContext,
          testSuites: content.testSuites,
          riskAssessment: content.riskAssessment,
          summary: content.summary
        };
      } catch (e) {
        return { id: file.replace('.json', ''), file, error: e.message };
      }
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete test plan (with cascading delete of linked log and report)
app.post('/api/delete-test-plan', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing test plan id' });

  const deleted = { testPlan: false, log: false, report: false };

  try {
    // Delete test plan
    const planPath = path.join(PLANS_DIR, `${id}.json`);
    if (fs.existsSync(planPath)) {
      fs.unlinkSync(planPath);
      deleted.testPlan = true;
    }

    // Extract timestamp from test plan id (e.g., "test-plan-2024-01-15T10-30-00-000Z")
    const timestampMatch = id.match(/test-plan-(.+)/);
    if (timestampMatch) {
      const timestamp = timestampMatch[1];

      // Delete linked log file
      const logPath = path.join(LOGS_DIR, `test-${timestamp}.log`);
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
        deleted.log = true;
      }

      // Delete linked report file
      const reportPath = path.join(ARTIFACTS_DIR, `report-${timestamp}.html`);
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
        deleted.report = true;
      }
    }

    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete log file (with cascading delete of linked report and test plan)
app.post('/api/delete-log', (req, res) => {
  const { file } = req.body;
  if (!file || !file.endsWith('.log')) {
    return res.status(400).json({ error: 'Invalid log file' });
  }

  const deleted = { testPlan: false, log: false, report: false };

  try {
    // Delete log file
    const logPath = path.join(LOGS_DIR, file);
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }
    fs.unlinkSync(logPath);
    deleted.log = true;

    // Extract timestamp from log file (e.g., "test-2024-01-15T10-30-00-000Z.log")
    const timestampMatch = file.match(/test-(.+)\.log/);
    if (timestampMatch) {
      const timestamp = timestampMatch[1];

      // Delete linked test plan
      const planPath = path.join(PLANS_DIR, `test-plan-${timestamp}.json`);
      if (fs.existsSync(planPath)) {
        fs.unlinkSync(planPath);
        deleted.testPlan = true;
      }

      // Delete linked report
      const reportPath = path.join(ARTIFACTS_DIR, `report-${timestamp}.html`);
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
        deleted.report = true;
      }
    }

    res.json({ success: true, deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Settings - API Key
app.get('/api/settings/api-key', (req, res) => {
  const activeKey = getActiveApiKey();
  const hasDefaultKey = !!DEFAULT_API_KEY;
  const hasCustomKey = !!apiState.apiKey;
  const usingDefault = apiState.useDefaultKey || !apiState.apiKey;

  if (activeKey) {
    const masked = activeKey.slice(0, 10) + '...' + activeKey.slice(-4);
    res.json({
      maskedKey: masked,
      hasDefaultKey,
      hasCustomKey,
      usingDefault,
      canRestore: hasDefaultKey && !usingDefault
    });
  } else {
    res.json({
      maskedKey: null,
      hasDefaultKey,
      hasCustomKey: false,
      usingDefault: true,
      canRestore: false
    });
  }
});

app.post('/api/settings/api-key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return res.status(400).json({ error: 'Invalid API key format' });
  }

  apiState.apiKey = apiKey;
  apiState.useDefaultKey = false; // Use the custom key
  apiState.lastError = null;
  saveSettings();

  const masked = apiKey.slice(0, 10) + '...' + apiKey.slice(-4);
  res.json({ success: true, maskedKey: masked, usingDefault: false });
});

// API: Restore default API key
app.post('/api/settings/restore-default-key', (req, res) => {
  if (!DEFAULT_API_KEY) {
    return res.status(400).json({ error: 'No default API key configured' });
  }

  apiState.useDefaultKey = true;
  apiState.lastError = null;
  saveSettings();

  const masked = DEFAULT_API_KEY.slice(0, 10) + '...' + DEFAULT_API_KEY.slice(-4);
  res.json({ success: true, maskedKey: masked, usingDefault: true });
});

// API: Test API key
app.post('/api/settings/test-api-key', (req, res) => {
  try {
    const activeKey = getActiveApiKey();
    if (!activeKey) {
      return res.json({ success: false, error: 'No API key configured' });
    }

    // Validate key format
    if (typeof activeKey !== 'string' || activeKey.length < 10) {
      return res.json({ success: false, error: 'Invalid API key format' });
    }

    const postData = JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': activeKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', (chunk) => { data += chunk; });
      apiRes.on('end', () => {
        try {
          if (apiRes.statusCode === 200) {
            apiState.lastError = null;
            res.json({ success: true, model: 'claude-sonnet-4-20250514' });
          } else {
            let errorMessage = `API request failed (${apiRes.statusCode})`;
            try {
              const errorData = JSON.parse(data);
              errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {}
            apiState.lastError = errorMessage;
            res.json({ success: false, error: errorMessage, canRestore: !!DEFAULT_API_KEY });
          }
        } catch (e) {
          res.json({ success: false, error: 'Error processing response: ' + e.message, canRestore: !!DEFAULT_API_KEY });
        }
      });
    });

    apiReq.on('timeout', () => {
      apiReq.destroy();
      apiState.lastError = 'Request timeout - API took too long to respond';
      res.json({ success: false, error: apiState.lastError, canRestore: !!DEFAULT_API_KEY });
    });

    apiReq.on('error', (error) => {
      apiState.lastError = 'Failed to connect to API: ' + error.message;
      res.json({ success: false, error: apiState.lastError, canRestore: !!DEFAULT_API_KEY });
    });

    apiReq.write(postData);
    apiReq.end();
  } catch (error) {
    console.error('Test API key error:', error);
    res.status(500).json({ success: false, error: 'Internal server error: ' + error.message, canRestore: !!DEFAULT_API_KEY });
  }
});

// API: Usage info
app.get('/api/settings/usage', (req, res) => {
  res.json({
    balance: null,
    note: 'Visit console.anthropic.com for billing info.'
  });
});

// API: Status
app.get('/api/settings/api-status', (req, res) => {
  if (apiState.lastError) {
    res.json({ error: apiState.lastError, action: { label: 'Go to Settings', url: '/settings' } });
  } else {
    res.json({ status: 'ok' });
  }
});

// API: Clear error
app.post('/api/settings/clear-error', (req, res) => {
  apiState.lastError = null;
  apiState.lastWarning = null;
  res.json({ success: true });
});

// API: Auto-test settings
app.get('/api/settings/auto-test', (req, res) => {
  res.json({ enabled: autoTestEnabled });
});

app.post('/api/settings/auto-test', (req, res) => {
  const { enabled } = req.body;
  autoTestEnabled = !!enabled;
  saveSettings();
  res.json({ success: true, enabled: autoTestEnabled });
});

// API: Test mode settings (strict/weak)
app.get('/api/settings/test-mode', (req, res) => {
  res.json({ mode: testMode });
});

app.post('/api/settings/test-mode', (req, res) => {
  const { mode } = req.body;
  if (mode !== 'strict' && mode !== 'weak') {
    return res.status(400).json({ error: 'Invalid mode. Must be "strict" or "weak".' });
  }
  testMode = mode;
  saveSettings();
  res.json({ success: true, mode: testMode });
});

// Serve artifacts
app.get('/artifacts/:file', (req, res) => {
  const filePath = path.join(ARTIFACTS_DIR, req.params.file);
  if (fs.existsSync(filePath)) {
    res.type('text/html').send(fs.readFileSync(filePath, 'utf-8'));
  } else {
    res.status(404).send('Not found');
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Email Template QA System running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
