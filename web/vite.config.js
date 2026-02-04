import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import https from 'https'
import mjml2html from 'mjml'
import ejs from 'ejs'

// ============================================================================
// PATH CONSTANTS
// ============================================================================

const PATHS = {
  TEMPLATES_DIR: path.resolve(__dirname, '../email_templates'),
  TEST_FRAMEWORK: path.resolve(__dirname, '../test_framework'),
  TEST_REPORTS: path.resolve(__dirname, '../test_reports'),
  COMPARISON_REPORT: path.resolve(__dirname, '../test_reports/comparison-report.md'),
  ARTIFACTS: path.resolve(__dirname, 'artifacts'),
  LOGS: path.resolve(__dirname, 'logs'),
  SETTINGS: path.resolve(__dirname, '.settings.json'),
  PLANS: path.resolve(__dirname, '../test_framework/output/test-plans'),
  SCREENSHOTS: path.resolve(__dirname, '../test_framework/output/screenshots'),
  DIFFS: path.resolve(__dirname, '../test_framework/output/diffs'),
  TEST_DATA: path.resolve(__dirname, '../test_framework/test-data/sample-context.json'),
}

// ============================================================================
// FILE PATTERN HELPERS
// ============================================================================

const FILE_PATTERNS = {
  // Regex patterns for extracting timestamps
  testPlanRegex: /test-plan-(.+)/,
  logFileRegex: /test-(.+)\.log/,
  reportFileRegex: /report-(.+)/,
}

/**
 * Extract timestamp from a file identifier
 */
const extractTimestamp = (identifier, type) => {
  const patterns = {
    testPlan: FILE_PATTERNS.testPlanRegex,
    log: FILE_PATTERNS.logFileRegex,
    report: FILE_PATTERNS.reportFileRegex,
  }
  const match = identifier.match(patterns[type])
  return match ? match[1] : null
}

// ============================================================================
// TEMPLATE COMPILATION HELPERS
// ============================================================================

const COMPILED_OUTPUT_DIR = path.resolve(__dirname, '../test_framework/output/compiled')

/**
 * Load test data for EJS variable substitution
 */
const loadTestData = () => {
  try {
    const content = fs.readFileSync(PATHS.TEST_DATA, 'utf-8')
    const data = JSON.parse(content)
    const ctx = data.context || {}

    return {
      context: ctx,
      company: {
        name: ctx.companyName || 'Carebox',
        address: ctx.companyAddress || '123 Main Street, San Francisco, CA 94102',
        logoUrl: ctx.logoUrl || '/templates/shared/carebox_logo.png',
        supportEmail: ctx.supportEmail || 'support@example.com'
      },
      visitor: {
        name: ctx.visitorName || 'Valued Visitor'
      },
      urls: {
        cta: ctx.ctaUrl || 'https://example.com/get-started',
        privacy: ctx.privacyUrl || 'https://example.com/privacy',
        terms: ctx.termsUrl || 'https://example.com/terms',
        unsubscribe: ctx.unsubscribeUrl || 'https://example.com/unsubscribe'
      },
      currentYear: ctx.currentYear || new Date().getFullYear()
    }
  } catch (error) {
    console.warn('Warning: Could not load test data, using empty context')
    return {
      context: {},
      company: { name: 'Carebox', address: '', logoUrl: '', supportEmail: '' },
      visitor: { name: 'Valued Visitor' },
      urls: { cta: '', privacy: '', terms: '', unsubscribe: '' },
      currentYear: new Date().getFullYear()
    }
  }
}

/**
 * Compile a single MJML template to HTML
 */
const compileTemplate = (templateFileName) => {
  const templatesDir = path.resolve(__dirname, '../email_templates')
  const emailsDir = path.join(templatesDir, 'emails')
  const templatePath = path.join(emailsDir, templateFileName)
  const baseName = templateFileName.replace('.mjml', '')
  const outputPath = path.join(COMPILED_OUTPUT_DIR, `${baseName}.html`)

  try {
    // Ensure output directory exists
    if (!fs.existsSync(COMPILED_OUTPUT_DIR)) {
      fs.mkdirSync(COMPILED_OUTPUT_DIR, { recursive: true })
    }

    // Read template
    const mjmlContent = fs.readFileSync(templatePath, 'utf-8')

    // Load test data
    const testData = loadTestData()

    // Process EJS
    const ejsOptions = {
      filename: templatePath,
      root: templatesDir,
    }

    let processedMjml
    try {
      processedMjml = ejs.render(mjmlContent, testData, ejsOptions)
    } catch (ejsError) {
      console.error(`EJS error compiling ${templateFileName}:`, ejsError.message)
      return { success: false, error: `EJS error: ${ejsError.message}` }
    }

    // Compile MJML to HTML
    const compilationResult = mjml2html(processedMjml, {
      validationLevel: 'soft',
      filePath: templatePath,
    })

    // Write HTML output
    fs.writeFileSync(outputPath, compilationResult.html, 'utf-8')

    console.log(`Compiled ${templateFileName} -> ${baseName}.html`)
    return { success: true, outputPath, errors: compilationResult.errors }
  } catch (error) {
    console.error(`Error compiling ${templateFileName}:`, error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Get linked file paths for a given timestamp
 */
const getLinkedFilePaths = (timestamp) => ({
  testPlan: path.join(PATHS.PLANS, `test-plan-${timestamp}.json`),
  log: path.join(PATHS.LOGS, `test-${timestamp}.log`),
  report: path.join(PATHS.ARTIFACTS, `report-${timestamp}.html`),
})

/**
 * Delete a file if it exists
 */
const deleteIfExists = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
    return true
  }
  return false
}

/**
 * Delete linked files (test plan, log, report) for a given timestamp
 */
const deleteLinkedFiles = (timestamp, excludeType = null) => {
  const paths = getLinkedFilePaths(timestamp)
  const deleted = { testPlan: false, log: false, report: false }

  if (excludeType !== 'testPlan') {
    deleted.testPlan = deleteIfExists(paths.testPlan)
  }
  if (excludeType !== 'log') {
    deleted.log = deleteIfExists(paths.log)
  }
  if (excludeType !== 'report') {
    deleted.report = deleteIfExists(paths.report)
  }

  return deleted
}

// ============================================================================
// STATE
// ============================================================================

// Store for test state when running embedded
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

// Store for API settings
let apiState = {
  apiKey: null, // User's custom key
  useDefaultKey: true, // Whether to use default key
  lastError: null,
  lastWarning: null
};

// Store for auto-test setting
let autoTestEnabled = false;

// Get the active API key (user's key or default)
const getActiveApiKey = () => {
  if (apiState.apiKey && !apiState.useDefaultKey) {
    return apiState.apiKey;
  }
  return DEFAULT_API_KEY;
};

// Settings file path (using PATHS constant)
const SETTINGS_FILE = PATHS.SETTINGS;

// Load settings from file
const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      if (data.apiKey) {
        apiState.apiKey = data.apiKey;
        apiState.useDefaultKey = data.useDefaultKey !== false;
      }
      autoTestEnabled = data.autoTestEnabled || false;
    }
  } catch (e) {
    console.warn('Failed to load settings:', e.message);
  }
};

// Save settings to file
const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      apiKey: apiState.apiKey,
      useDefaultKey: apiState.useDefaultKey,
      autoTestEnabled: autoTestEnabled
    }, null, 2));
  } catch (e) {
    console.warn('Failed to save settings:', e.message);
  }
};

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
  if (activeKey) {
    testEnv.ANTHROPIC_API_KEY = activeKey;
  }
  testEnv.TEST_TEMPLATES = changedTemplate;

  const testProcess = spawn('node', ['scripts/run-agents.js'], {
    cwd: PATHS.TEST_FRAMEWORK,
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
        type: line.includes('Error') || line.includes('error') ? 'error' :
              line.includes('Warning') || line.includes('warning') ? 'warning' :
              line.includes('✅') || line.includes('Complete') ? 'success' :
              line.includes('[STEP:') || line.includes('Phase') ? 'step' :
              'info'
      });
    });
    if (testState.logs.length > 200) {
      testState.logs = testState.logs.slice(-200);
    }

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
    console.log(`[Auto-Test] Completed with exit code ${code}`);
  });
};

// Initialize settings
loadSettings();

// Template metadata (keyed by filename without extension)
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

// Custom plugin for API routes and static file serving
function apiPlugin() {
  return {
    name: 'api-plugin',
    configureServer(server) {
      const TEMPLATES_DIR = PATHS.TEMPLATES_DIR

      // API endpoint to list all templates
      server.middlewares.use('/api/templates', (req, res, next) => {
        if (req.url !== '/' && req.url !== '') {
          next()
          return
        }

        try {
          const emailsDir = path.join(TEMPLATES_DIR, 'emails')

          // Get all .mjml files from the emails directory
          const files = fs.readdirSync(emailsDir).filter(f => {
            const filePath = path.join(emailsDir, f)
            return fs.statSync(filePath).isFile() && f.endsWith('.mjml')
          })

          const templates = files.map(file => {
            const name = file.replace('.mjml', '')
            const meta = TEMPLATE_META[name] || {}
            const filePath = path.join(emailsDir, file)
            const stats = fs.statSync(filePath)

            return {
              file,
              name: meta.name || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              description: meta.description || '',
              type: meta.type || 'base',
              fileInfo: {
                size: stats.size,
                modified: stats.mtime
              }
            }
          })

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ templates }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to create a new template
      server.middlewares.use('/api/create-template', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { name, copyFrom } = JSON.parse(body)
            const fileName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')

            if (!fileName) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid template name' }))
              return
            }

            const emailsDir = path.join(TEMPLATES_DIR, 'emails')
            const newFilePath = path.join(emailsDir, `${fileName}.mjml`)

            if (fs.existsSync(newFilePath)) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Template already exists' }))
              return
            }

            // Default template content using shared partials
            let templateContent = `<%- include('../shared/variables') %>
<%
  // Template-specific configuration
  const primaryColor = '#2563eb'
  const headingColor = '#1f2937'
  const bgColor = '#f4f4f5'
  const title = 'Welcome to ' + company.name
  const previewText = 'Welcome, ' + visitor.name + '!'
%>
<mjml>
  <%- include('../shared/partials/head', { title, previewText, primaryColor }) %>

  <mj-body background-color="<%= bgColor %>">
    <%- include('../shared/partials/header', { primaryColor }) %>

    <mj-section background-color="#ffffff" padding="40px 30px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="<%= headingColor %>">
          Hello <%= visitor.name %>!
        </mj-text>
        <mj-text>
          Your email content here.
        </mj-text>
        <mj-button href="<%= urls.cta %>">
          Click Here
        </mj-button>
      </mj-column>
    </mj-section>

    <%- include('../shared/partials/footer', { bgColor }) %>
  </mj-body>
</mjml>`

            if (copyFrom) {
              const sourcePath = path.join(emailsDir, copyFrom)
              if (fs.existsSync(sourcePath)) {
                templateContent = fs.readFileSync(sourcePath, 'utf-8')
              }
            }

            fs.writeFileSync(newFilePath, templateContent)

            // Compile template to HTML immediately
            const compileResult = compileTemplate(`${fileName}.mjml`)
            if (!compileResult.success) {
              console.warn(`Warning: Failed to compile new template: ${compileResult.error}`)
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, file: `${fileName}.mjml`, compiled: compileResult.success }))

            // Trigger auto-test if enabled
            triggerAutoTest(fileName)
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      // API endpoint to delete a template
      server.middlewares.use('/api/delete-template', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { file } = JSON.parse(body)

            if (!file || !file.endsWith('.mjml')) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid file' }))
              return
            }

            const emailsDir = path.join(TEMPLATES_DIR, 'emails')
            const filePath = path.join(emailsDir, file)

            if (!fs.existsSync(filePath)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Template not found' }))
              return
            }

            const templateName = file.replace('.mjml', '')
            fs.unlinkSync(filePath)

            // Also delete the compiled HTML file if it exists
            const compiledHtmlPath = path.join(COMPILED_OUTPUT_DIR, `${templateName}.html`)
            if (fs.existsSync(compiledHtmlPath)) {
              fs.unlinkSync(compiledHtmlPath)
              console.log(`Deleted compiled HTML: ${templateName}.html`)
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true }))

            // Trigger auto-test if enabled (test remaining templates after deletion)
            triggerAutoTest(templateName)
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      // Serve MJML templates from email_templates folder
      // Processes EJS includes recursively to inline shared variables and partials
      server.middlewares.use('/templates', (req, res, next) => {
        const urlPath = req.url.split('?')[0]
        const filePath = path.resolve(__dirname, '../email_templates', urlPath.slice(1))

        // Helper function to process includes recursively
        const processIncludes = (content, currentDir, depth = 0) => {
          if (depth > 10) return content // Prevent infinite recursion

          // Replace include directives with the actual file content
          // Matches: <%- include('path') %>, <%- include('path', { data }) %>
          return content.replace(/<%[-_]?\s*include\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*\{[^}]*\})?\s*\)\s*%>/g, (match, includePath) => {
            try {
              // Resolve path relative to the current file's directory
              let includeFullPath = path.resolve(currentDir, includePath)

              // Add .ejs extension if not present
              if (!path.extname(includeFullPath)) {
                includeFullPath += '.ejs'
              }

              if (fs.existsSync(includeFullPath)) {
                let includeContent = fs.readFileSync(includeFullPath, 'utf-8')
                // Recursively process includes in the included file
                const includeDir = path.dirname(includeFullPath)
                return processIncludes(includeContent, includeDir, depth + 1)
              }
            } catch (e) {
              console.warn(`Warning: Could not include ${includePath}: ${e.message}`)
            }
            return match // Return original if include fails
          })
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase()

          // Handle image files (read as binary with proper MIME types)
          if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
            const mimeTypes = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.svg': 'image/svg+xml',
              '.webp': 'image/webp',
              '.ico': 'image/x-icon'
            }
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
            res.end(fs.readFileSync(filePath))
            return
          }

          // Handle text files
          let content = fs.readFileSync(filePath, 'utf-8')

          // Process EJS includes for .mjml files
          if (ext === '.mjml') {
            const templateDir = path.dirname(filePath)
            content = processIncludes(content, templateDir)
          }

          const contentType = ext === '.mjml' ? 'text/plain' : 'application/octet-stream'
          res.setHeader('Content-Type', contentType)
          res.end(content)
        } else {
          next()
        }
      })

      // API endpoint to get test data
      server.middlewares.use('/api/test-data', (req, res) => {
        const testDataPath = PATHS.TEST_DATA
        try {
          const data = fs.readFileSync(testDataPath, 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(data)
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to save template
      server.middlewares.use('/api/save-template', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { file, content } = JSON.parse(body)

            if (!file || !content) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing file or content' }))
              return
            }

            if (!file.endsWith('.mjml')) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid file name' }))
              return
            }

            const emailsDir = path.join(TEMPLATES_DIR, 'emails')
            const templatePath = path.join(emailsDir, file)

            fs.writeFileSync(templatePath, content, 'utf-8')

            // Compile template to HTML immediately
            const compileResult = compileTemplate(file)
            if (!compileResult.success) {
              console.warn(`Warning: Failed to compile template: ${compileResult.error}`)
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, compiled: compileResult.success }))

            // Trigger auto-test if enabled
            const templateName = file.replace('.mjml', '')
            triggerAutoTest(templateName)
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      // API endpoint to run multi-agent tests
      server.middlewares.use('/api/run-tests', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (testState.isRunning) {
          res.statusCode = 409
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'busy', message: 'Test already in progress' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          let selectedTemplates = []
          try {
            const data = JSON.parse(body)
            selectedTemplates = data.templates || []
          } catch (e) {
            // No body or invalid JSON - test all templates
          }

          testState.isRunning = true
          testState.currentTest = {
            startedAt: new Date().toISOString(),
            status: 'running',
            templates: selectedTemplates.length > 0 ? selectedTemplates : 'all',
            step: 'init',
            stepDescription: 'Initializing test pipeline...',
            progress: 0
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            status: 'started',
            message: selectedTemplates.length > 0
              ? `Testing ${selectedTemplates.length} template(s)`
              : 'Testing all templates'
          }))

          // Run the multi-agent test in background with API key
          const testEnv = { ...process.env }
          const activeKey = getActiveApiKey()
          if (activeKey) {
            testEnv.ANTHROPIC_API_KEY = activeKey
          }

          // Pass selected templates as environment variable
          if (selectedTemplates.length > 0) {
            testEnv.TEST_TEMPLATES = selectedTemplates.join(',')
          }

          const testProcess = spawn('node', ['scripts/run-agents.js'], {
            cwd: PATHS.TEST_FRAMEWORK,
            env: testEnv
          })

        let output = ''
        testState.logs = [] // Clear previous logs

        testProcess.stdout.on('data', (data) => {
          const text = data.toString()
          output += text
          console.log(text)

          // Add to logs (keep last 200 lines)
          const lines = text.split('\n').filter(l => l.trim())
          lines.forEach(line => {
            testState.logs.push({
              timestamp: new Date().toISOString(),
              message: line,
              type: line.includes('Error') || line.includes('error') ? 'error' :
                    line.includes('Warning') || line.includes('warning') ? 'warning' :
                    line.includes('✅') || line.includes('Complete') ? 'success' :
                    line.includes('[STEP:') || line.includes('Phase') ? 'step' :
                    'info'
            })
          })
          if (testState.logs.length > 200) {
            testState.logs = testState.logs.slice(-200)
          }

          // Parse pipeline step markers from output
          if (text.includes('[STEP:planner]') || text.includes('Test Planner') || text.includes('Creating test plan')) {
            testState.currentTest.step = 'planner'
            testState.currentTest.stepDescription = 'Analyzing requirements and creating test plans...'
            testState.currentTest.progress = 25
          } else if (text.includes('[STEP:analyzer]') || text.includes('Change Analyzer') || text.includes('Analyzing changes')) {
            testState.currentTest.step = 'analyzer'
            testState.currentTest.stepDescription = 'Detecting file changes and modified templates...'
            testState.currentTest.progress = 50
          } else if (text.includes('[STEP:diff]') || text.includes('Diff Analyzer') || text.includes('Comparing templates')) {
            testState.currentTest.step = 'diff'
            testState.currentTest.stepDescription = 'Comparing templates and analyzing differences...'
            testState.currentTest.progress = 75
          } else if (text.includes('[STEP:reporter]') || text.includes('Report Generator') || text.includes('Generating report')) {
            testState.currentTest.step = 'reporter'
            testState.currentTest.stepDescription = 'Creating comprehensive test report...'
            testState.currentTest.progress = 90
          }
        })

        testProcess.stderr.on('data', (data) => {
          output += data.toString()
          console.error(data.toString())
        })

        testProcess.on('close', (code) => {
          testState.isRunning = false
          const completedAt = new Date().toISOString()
          const status = code === 0 ? 'passed' : 'failed'

          testState.lastResult = {
            status: code === 0 ? 'complete' : 'error',
            exitCode: code,
            completedAt,
            output: output.slice(-5000)
          }
          testState.currentTest = null
          console.log(`Multi-agent test completed with exit code ${code}`)

          // Note: Logs are saved by the CLI pipeline (run-agents.js)
          // No need to save duplicates here

          // Check for API errors in output
          if (code !== 0) {
            const outputLower = output.toLowerCase()
            if (outputLower.includes('rate limit') || outputLower.includes('429') || outputLower.includes('too many requests')) {
              apiState.lastError = 'API rate limit exceeded. Please wait before running more tests or upgrade your Anthropic plan.'
            } else if (outputLower.includes('credit') || outputLower.includes('billing') || outputLower.includes('insufficient')) {
              apiState.lastError = 'Insufficient API credits. Please add funds to your Anthropic account.'
            } else if (outputLower.includes('invalid api key') || outputLower.includes('401') || outputLower.includes('unauthorized')) {
              apiState.lastError = 'Invalid API key. Please check your settings.'
            } else if (outputLower.includes('anthropic_api_key') || outputLower.includes('api key not')) {
              apiState.lastError = 'API key not configured. Please add your Anthropic API key in Settings.'
            }
          } else {
            // Clear any previous errors on success
            apiState.lastError = null
          }

          // Note: Reports are saved by the CLI pipeline (report-generator-agent.js)
          // No need to save duplicates here
        })
        }) // Close req.on('end')
      })

      // API endpoint to get test status
      server.middlewares.use('/api/test-status', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          isRunning: testState.isRunning,
          currentTest: testState.currentTest,
          lastResult: testState.lastResult,
          logs: testState.logs || []
        }))
      })

      // API endpoint to get latest report (legacy)
      server.middlewares.use('/api/latest-report', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const reportPath = PATHS.COMPARISON_REPORT
        try {
          const content = fs.readFileSync(reportPath, 'utf-8')
          res.setHeader('Content-Type', 'text/markdown')
          res.end(content)
        } catch (error) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Report not found' }))
        }
      })

      // API endpoint to list all reports from artifacts folder
      server.middlewares.use('/api/reports', (req, res, next) => {
        if (req.url !== '/' && req.url !== '') {
          next()
          return
        }

        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const artifactsDir = PATHS.ARTIFACTS
        try {
          if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true })
          }

          const files = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.html'))

          const reports = files.map(file => {
            const filePath = path.join(artifactsDir, file)
            const stats = fs.statSync(filePath)
            const content = fs.readFileSync(filePath, 'utf-8')

            // Extract status from HTML meta tag or data attribute
            const statusMatch = content.match(/data-status="([^"]+)"/) ||
                               content.match(/<!--\s*status:\s*(\w+)\s*-->/)
            const status = statusMatch ? statusMatch[1] : 'unknown'

            // Extract title from HTML
            const titleMatch = content.match(/<title>([^<]+)<\/title>/)
            const title = titleMatch ? titleMatch[1] : file.replace('.html', '')

            return {
              id: file.replace('.html', ''),
              file,
              title,
              status,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              size: stats.size
            }
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ reports }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to get a specific report
      server.middlewares.use('/api/reports/', (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        const reportId = req.url.split('?')[0].slice(1) // Remove leading /
        if (!reportId || reportId.includes('/')) {
          next()
          return
        }

        const artifactsDir = PATHS.ARTIFACTS
        const filePath = path.join(artifactsDir, `${reportId}.html`)

        try {
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Report not found' }))
            return
          }

          const content = fs.readFileSync(filePath, 'utf-8')
          res.setHeader('Content-Type', 'text/html')
          res.end(content)
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to save a new report
      server.middlewares.use('/api/save-report', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { title, content, status } = JSON.parse(body)

            if (!content) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing content' }))
              return
            }

            const artifactsDir = PATHS.ARTIFACTS
            if (!fs.existsSync(artifactsDir)) {
              fs.mkdirSync(artifactsDir, { recursive: true })
            }

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const fileName = `report-${timestamp}.html`
            const filePath = path.join(artifactsDir, fileName)

            // Wrap content in HTML with metadata
            const reportTitle = title || `Test Report - ${new Date().toLocaleString()}`
            const reportStatus = status || 'completed'
            const htmlContent = `<!DOCTYPE html>
<html lang="en" data-status="${reportStatus}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    h3 { color: #4b5563; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .status-passed, .status-completed { background: #d1fae5; color: #065f46; }
    .status-failed { background: #fee2e2; color: #991b1b; }
    .status-warning { background: #fef3c7; color: #92400e; }
    .status-running { background: #dbeafe; color: #1e40af; }
    pre { background: #f3f4f6; padding: 15px; border-radius: 8px; overflow-x: auto; }
    code { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
    th { background: #f9fafb; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="meta">
    <span class="status status-${reportStatus}">${reportStatus.toUpperCase()}</span>
    <span style="margin-left: 10px;">Generated: ${new Date().toLocaleString()}</span>
  </div>
  ${content}
</body>
</html>`

            fs.writeFileSync(filePath, htmlContent)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              file: fileName,
              id: fileName.replace('.html', '')
            }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      // API endpoint to delete a report (with cascading delete of linked files)
      server.middlewares.use('/api/delete-report', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body)

            if (!id) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing report id' }))
              return
            }

            const artifactsDir = PATHS.ARTIFACTS
            const filePath = path.join(artifactsDir, `${id}.html`)

            if (!fs.existsSync(filePath)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Report not found' }))
              return
            }

            // Extract timestamp and delete linked files
            const timestamp = extractTimestamp(id, 'report')
            let linkedDeleted = { testPlan: false, log: false }

            if (timestamp) {
              linkedDeleted = deleteLinkedFiles(timestamp, 'report')
            }

            // Delete the report itself
            fs.unlinkSync(filePath)

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({
              success: true,
              linkedDeleted
            }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      // Serve artifacts folder for direct HTML viewing
      server.middlewares.use('/artifacts', (req, res, next) => {
        const urlPath = req.url.split('?')[0]
        const filePath = path.join(PATHS.ARTIFACTS, urlPath.slice(1))

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, 'utf-8')
          res.setHeader('Content-Type', 'text/html')
          res.end(content)
        } else {
          next()
        }
      })

      // Serve screenshots from test framework output
      server.middlewares.use('/screenshots', (req, res, next) => {
        const urlPath = req.url.split('?')[0]

        // Check if it's a request for diff images
        if (urlPath.startsWith('/diffs/')) {
          const diffsDir = PATHS.DIFFS
          const diffFilePath = path.join(diffsDir, urlPath.slice(7)) // Remove '/diffs/'

          // Security: ensure path is within diffs directory
          const normalizedDiffPath = path.normalize(diffFilePath)
          if (!normalizedDiffPath.startsWith(diffsDir)) {
            res.statusCode = 403
            res.end(JSON.stringify({ error: 'Access denied' }))
            return
          }

          if (fs.existsSync(diffFilePath) && fs.statSync(diffFilePath).isFile()) {
            const ext = path.extname(diffFilePath).toLowerCase()
            const mimeTypes = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.webp': 'image/webp'
            }
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
            res.setHeader('Cache-Control', 'public, max-age=3600')
            res.end(fs.readFileSync(diffFilePath))
          } else {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Diff image not found', path: urlPath }))
          }
          return
        }

        const screenshotsDir = PATHS.SCREENSHOTS
        const filePath = path.join(screenshotsDir, urlPath.slice(1))

        // Security: ensure path is within screenshots directory
        const normalizedPath = path.normalize(filePath)
        if (!normalizedPath.startsWith(screenshotsDir)) {
          res.statusCode = 403
          res.end(JSON.stringify({ error: 'Access denied' }))
          return
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase()
          const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
          }
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
          res.setHeader('Cache-Control', 'public, max-age=3600')
          res.end(fs.readFileSync(filePath))
        } else {
          // Return placeholder image or 404
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Screenshot not found', path: urlPath }))
        }
      })

      // API endpoint to list available screenshots
      server.middlewares.use('/api/screenshots', (req, res, next) => {
        if (req.url !== '/' && req.url !== '') {
          next()
          return
        }

        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const screenshotsDir = PATHS.SCREENSHOTS
        try {
          if (!fs.existsSync(screenshotsDir)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ screenshots: [] }))
            return
          }

          const files = fs.readdirSync(screenshotsDir).filter(f =>
            ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(f).toLowerCase())
          )

          const screenshots = files.map(file => {
            const filePath = path.join(screenshotsDir, file)
            const stats = fs.statSync(filePath)

            // Parse filename to extract template and viewport
            // Expected format: template-name_viewport.png or template-name-viewport.png
            const baseName = file.replace(/\.[^/.]+$/, '')
            const parts = baseName.split(/[-_]/)
            const viewport = parts.pop() || 'unknown'
            const template = parts.join('_') || baseName

            return {
              file,
              url: `/screenshots/${file}`,
              template,
              viewport,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              size: stats.size
            }
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ screenshots }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to get screenshots for a specific template
      server.middlewares.use('/api/screenshots/', (req, res, next) => {
        if (req.method !== 'GET') {
          next()
          return
        }

        const templateName = req.url.split('?')[0].slice(1)
        if (!templateName || templateName.includes('/')) {
          next()
          return
        }

        const screenshotsDir = PATHS.SCREENSHOTS
        try {
          if (!fs.existsSync(screenshotsDir)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ screenshots: [] }))
            return
          }

          const files = fs.readdirSync(screenshotsDir).filter(f => {
            const ext = path.extname(f).toLowerCase()
            const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)
            const matchesTemplate = f.toLowerCase().includes(templateName.toLowerCase())
            return isImage && matchesTemplate
          })

          const screenshots = files.map(file => {
            const filePath = path.join(screenshotsDir, file)
            const stats = fs.statSync(filePath)

            const baseName = file.replace(/\.[^/.]+$/, '')
            const parts = baseName.split(/[-_]/)
            const viewport = parts.pop() || 'unknown'
            const template = parts.join('_') || baseName

            return {
              file,
              url: `/screenshots/${file}`,
              template,
              viewport,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              size: stats.size
            }
          })

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ screenshots }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to list diff images
      server.middlewares.use('/api/diffs', (req, res, next) => {
        if (req.url !== '/' && req.url !== '') {
          next()
          return
        }

        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const diffsDir = PATHS.DIFFS
        try {
          if (!fs.existsSync(diffsDir)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ diffs: [] }))
            return
          }

          const files = fs.readdirSync(diffsDir).filter(f =>
            ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(f).toLowerCase())
          )

          const diffs = files.map(file => {
            const filePath = path.join(diffsDir, file)
            const stats = fs.statSync(filePath)

            // Parse filename to extract template comparison info
            const baseName = file.replace(/\.[^/.]+$/, '')
            const isComparison = baseName.startsWith('comparison-')
            const isDiff = baseName.startsWith('diff-')
            const templateName = baseName.replace(/^(comparison-|diff-)/, '')

            return {
              file,
              url: `/screenshots/diffs/${file}`,
              type: isComparison ? 'comparison' : isDiff ? 'diff' : 'unknown',
              template: templateName,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              size: stats.size
            }
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ diffs }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to get API key (masked)
      server.middlewares.use('/api/settings/api-key', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          const activeKey = getActiveApiKey()
          const hasDefaultKey = !!DEFAULT_API_KEY
          const hasCustomKey = !!apiState.apiKey
          const usingDefault = apiState.useDefaultKey || !apiState.apiKey

          if (activeKey) {
            const masked = activeKey.slice(0, 10) + '...' + activeKey.slice(-4)
            res.end(JSON.stringify({
              maskedKey: masked,
              hasDefaultKey,
              hasCustomKey,
              usingDefault,
              canRestore: hasDefaultKey && !usingDefault
            }))
          } else {
            res.end(JSON.stringify({
              maskedKey: null,
              hasDefaultKey,
              hasCustomKey: false,
              usingDefault: true,
              canRestore: false
            }))
          }
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { apiKey } = JSON.parse(body)
              if (!apiKey || !apiKey.startsWith('sk-')) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Invalid API key format' }))
                return
              }
              apiState.apiKey = apiKey
              apiState.useDefaultKey = false
              apiState.lastError = null
              apiState.lastWarning = null
              saveSettings()
              const masked = apiKey.slice(0, 10) + '...' + apiKey.slice(-4)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, maskedKey: masked, usingDefault: false }))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: error.message }))
            }
          })
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })

      // API endpoint to restore default API key
      server.middlewares.use('/api/settings/restore-default-key', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (!DEFAULT_API_KEY) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'No default API key configured' }))
          return
        }

        apiState.useDefaultKey = true
        apiState.lastError = null
        saveSettings()

        const masked = DEFAULT_API_KEY.slice(0, 10) + '...' + DEFAULT_API_KEY.slice(-4)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, maskedKey: masked, usingDefault: true }))
      })

      // API endpoint to test API key
      server.middlewares.use('/api/settings/test-api-key', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const activeKey = getActiveApiKey()
          if (!activeKey) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'No API key configured' }))
            return
          }

          // Validate key format
          if (typeof activeKey !== 'string' || activeKey.length < 10) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: 'Invalid API key format' }))
            return
          }

          const postData = JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })

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
          }

          const apiReq = https.request(options, (apiRes) => {
            let data = ''
            apiRes.on('data', (chunk) => { data += chunk })
            apiRes.on('end', () => {
              try {
                res.setHeader('Content-Type', 'application/json')

                if (apiRes.statusCode === 200) {
                  apiState.lastError = null
                  res.end(JSON.stringify({ success: true, model: 'claude-sonnet-4-20250514' }))
                } else {
                  let errorMessage = `API request failed (${apiRes.statusCode})`
                  try {
                    const errorData = JSON.parse(data)
                    errorMessage = errorData.error?.message || errorMessage
                  } catch (e) {}

                  // Check for specific error types
                  if (apiRes.statusCode === 429 || errorMessage.toLowerCase().includes('rate')) {
                    apiState.lastError = 'Rate limit exceeded. Please wait or upgrade your plan.'
                  } else if (errorMessage.toLowerCase().includes('credit') || errorMessage.toLowerCase().includes('billing')) {
                    apiState.lastError = 'Insufficient credits. Please add funds to your account.'
                  } else if (apiRes.statusCode === 401) {
                    apiState.lastError = 'Invalid API key. Please check your settings.'
                  } else {
                    apiState.lastError = errorMessage
                  }

                  res.end(JSON.stringify({ success: false, error: apiState.lastError, canRestore: !!DEFAULT_API_KEY }))
                }
              } catch (e) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: false, error: 'Error processing response', canRestore: !!DEFAULT_API_KEY }))
              }
            })
          })

          apiReq.on('timeout', () => {
            apiReq.destroy()
            apiState.lastError = 'Request timeout - API took too long to respond'
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: apiState.lastError, canRestore: !!DEFAULT_API_KEY }))
          })

          apiReq.on('error', (error) => {
            apiState.lastError = 'Failed to connect to API: ' + error.message
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: false, error: apiState.lastError, canRestore: !!DEFAULT_API_KEY }))
          })

          apiReq.write(postData)
          apiReq.end()
        } catch (error) {
          console.error('Test API key error:', error)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: false, error: 'Internal server error: ' + error.message, canRestore: !!DEFAULT_API_KEY }))
        }
      })

      // API endpoint to get usage information
      server.middlewares.use('/api/settings/usage', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (!apiState.apiKey) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'No API key configured' }))
          return
        }

        try {
          // Note: Anthropic doesn't have a public usage/balance API yet
          // This is a placeholder that returns simulated data
          // In production, you would integrate with Anthropic's billing API when available

          // For now, we'll return placeholder data
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            balance: null, // Not available via API yet
            tokensUsed: null,
            estimatedCost: null,
            rateLimit: null,
            lastUpdated: new Date().toISOString(),
            note: 'Usage data requires Anthropic Console. Visit console.anthropic.com for detailed billing info.'
          }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to get API status (for notifications)
      server.middlewares.use('/api/settings/api-status', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        res.setHeader('Content-Type', 'application/json')

        if (apiState.lastError) {
          res.end(JSON.stringify({
            error: apiState.lastError,
            action: {
              label: 'Go to Settings',
              url: '/settings'
            }
          }))
          return
        }

        if (apiState.lastWarning) {
          res.end(JSON.stringify({
            warning: apiState.lastWarning,
            action: {
              label: 'View Details',
              url: '/settings'
            }
          }))
          return
        }

        res.end(JSON.stringify({ status: 'ok' }))
      })

      // API endpoint to list logs
      server.middlewares.use('/api/logs', (req, res, next) => {
        // Check if it's a specific log file request
        const logFile = req.url.slice(1).split('?')[0]
        if (logFile && logFile.endsWith('.log')) {
          const logsDir = PATHS.LOGS
          const filePath = path.join(logsDir, logFile)

          if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8')
            res.setHeader('Content-Type', 'text/plain')
            res.end(content)
          } else {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'Log file not found' }))
          }
          return
        }

        // List all logs
        if (req.url === '/' || req.url === '') {
          if (req.method !== 'GET') {
            res.statusCode = 405
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          const logsDir = PATHS.LOGS
          try {
            if (!fs.existsSync(logsDir)) {
              fs.mkdirSync(logsDir, { recursive: true })
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ logs: [] }))
              return
            }

            const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'))
            const logs = files.map(file => {
              const filePath = path.join(logsDir, file)
              const stats = fs.statSync(filePath)
              return {
                file,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                size: stats.size
              }
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ logs }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
          return
        }

        next()
      })

      // API endpoint to get test plans
      server.middlewares.use('/api/test-plans', (req, res, next) => {
        if (req.url !== '/' && req.url !== '') {
          next()
          return
        }

        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const plansDir = PATHS.PLANS
        const artifactsDir = PATHS.ARTIFACTS
        const logsDir = PATHS.LOGS

        try {
          if (!fs.existsSync(plansDir)) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ plans: [] }))
            return
          }

          // Get list of reports and logs for linking
          const reportFiles = fs.existsSync(artifactsDir)
            ? fs.readdirSync(artifactsDir).filter(f => f.endsWith('.html'))
            : []
          const logFiles = fs.existsSync(logsDir)
            ? fs.readdirSync(logsDir).filter(f => f.endsWith('.log'))
            : []

          const files = fs.readdirSync(plansDir).filter(f => f.endsWith('.json') && f !== 'latest-test-plan.json')

          const plans = files.map(file => {
            const filePath = path.join(plansDir, file)
            try {
              const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
              const stats = fs.statSync(filePath)
              const planId = file.replace('.json', '')

              // Extract timestamp from plan ID (test-plan-TIMESTAMP)
              const timestamp = extractTimestamp(planId, 'testPlan')

              // Find linked report and log by timestamp
              let linkedReport = null
              let linkedLog = null

              if (timestamp) {
                const matchingReport = reportFiles.find(r => r.includes(timestamp))
                if (matchingReport) {
                  const reportPath = path.join(artifactsDir, matchingReport)
                  const reportStats = fs.statSync(reportPath)
                  const reportContent = fs.readFileSync(reportPath, 'utf-8')
                  const statusMatch = reportContent.match(/data-status="([^"]+)"/)
                  linkedReport = {
                    id: matchingReport.replace('.html', ''),
                    file: matchingReport,
                    status: statusMatch ? statusMatch[1] : 'unknown',
                    createdAt: reportStats.birthtime
                  }
                }

                const matchingLog = logFiles.find(l => l.includes(timestamp))
                if (matchingLog) {
                  linkedLog = {
                    file: matchingLog
                  }
                }
              }

              return {
                id: planId,
                file,
                createdAt: content.createdAt || stats.birthtime,
                testPlanId: content.testPlanId,
                templateContext: content.templateContext,
                testSuites: content.testSuites,
                riskAssessment: content.riskAssessment,
                summary: content.summary,
                parseError: content.parseError,
                rawResponse: content.rawResponse,
                linkedReport,
                linkedLog
              }
            } catch (e) {
              return { id: file.replace('.json', ''), file, error: e.message }
            }
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ plans }))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: error.message }))
        }
      })

      // API endpoint to delete a test plan (with cascading delete of linked log and report)
      server.middlewares.use('/api/delete-test-plan', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { id } = JSON.parse(body)

            if (!id) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Missing test plan id' }))
              return
            }

            // Delete the test plan file
            const planPath = path.join(PATHS.PLANS, `${id}.json`)
            const deleted = { testPlan: deleteIfExists(planPath), log: false, report: false }

            // Extract timestamp and delete linked files
            const timestamp = extractTimestamp(id, 'testPlan')
            if (timestamp) {
              const linkedDeleted = deleteLinkedFiles(timestamp, 'testPlan')
              deleted.log = linkedDeleted.log
              deleted.report = linkedDeleted.report
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, deleted }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      // API endpoint to delete a log file (with cascading delete of linked report and test plan)
      server.middlewares.use('/api/delete-log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const { file } = JSON.parse(body)

            if (!file || !file.endsWith('.log')) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid log file' }))
              return
            }

            // Delete the log file
            const logPath = path.join(PATHS.LOGS, file)
            if (!fs.existsSync(logPath)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Log file not found' }))
              return
            }

            const deleted = { testPlan: false, log: deleteIfExists(logPath), report: false }

            // Extract timestamp and delete linked files
            const timestamp = extractTimestamp(file, 'log')
            if (timestamp) {
              const linkedDeleted = deleteLinkedFiles(timestamp, 'log')
              deleted.testPlan = linkedDeleted.testPlan
              deleted.report = linkedDeleted.report
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ success: true, deleted }))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      // Clear API error (after user acknowledges)
      server.middlewares.use('/api/settings/clear-error', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        apiState.lastError = null
        apiState.lastWarning = null
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true }))
      })

      // API endpoint for auto-test settings
      server.middlewares.use('/api/settings/auto-test', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ enabled: autoTestEnabled }))
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            try {
              const { enabled } = JSON.parse(body)
              autoTestEnabled = !!enabled
              saveSettings()
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, enabled: autoTestEnabled }))
            } catch (error) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: error.message }))
            }
          })
          return
        }

        res.statusCode = 405
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
