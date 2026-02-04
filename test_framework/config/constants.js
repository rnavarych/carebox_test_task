/**
 * Centralized Constants for Email Template QA Test Framework
 *
 * This file contains all configuration constants used throughout the test framework.
 * Import from this file to ensure consistency across agents and scripts.
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// PATHS
// ============================================================================

export const PATHS = {
  // Root directories
  TEST_FRAMEWORK: path.resolve(__dirname, '..'),
  EMAIL_TEMPLATES: path.resolve(__dirname, '../../email_templates'),
  TEST_REPORTS: path.resolve(__dirname, '../../test_reports'),
  WEB_APP: path.resolve(__dirname, '../../web'),

  // Email template subdirectories
  EMAILS_DIR: path.resolve(__dirname, '../../email_templates/emails'),
  SHARED_DIR: path.resolve(__dirname, '../../email_templates/shared'),

  // Output directories
  OUTPUT: path.resolve(__dirname, '../output'),
  OUTPUT_COMPILED: path.resolve(__dirname, '../output/compiled'),
  OUTPUT_SCREENSHOTS: path.resolve(__dirname, '../output/screenshots'),
  OUTPUT_TEST_PLANS: path.resolve(__dirname, '../output/test-plans'),

  // Test data
  TEST_DATA: path.resolve(__dirname, '../test-data'),
  SAMPLE_CONTEXT: path.resolve(__dirname, '../test-data/sample-context.json'),

  // Web app directories
  WEB_ARTIFACTS: path.resolve(__dirname, '../../web/artifacts'),
  WEB_LOGS: path.resolve(__dirname, '../../web/logs'),
};

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * List of template files to process
 */
export const TEMPLATE_FILES = [
  'site_visitor_welcome.mjml',
  'site_visitor_welcome_copy.mjml',
  'site_visitor_welcome_partner_a.mjml',
  'site_visitor_welcome_partner_b.mjml',
];

/**
 * Template names (without extension)
 */
export const TEMPLATE_NAMES = TEMPLATE_FILES.map(f => f.replace('.mjml', ''));

/**
 * Base template for comparisons
 */
export const BASE_TEMPLATE = 'site_visitor_welcome';

/**
 * Template metadata with expected variations
 */
export const TEMPLATE_META = {
  site_visitor_welcome: {
    name: 'Site Visitor Welcome',
    description: 'Base template - Standard welcome email with blue color scheme',
    type: 'base',
    isBase: true,
  },
  site_visitor_welcome_copy: {
    name: 'Site Visitor Welcome Copy',
    description: 'Copy of base template - Must be identical to base',
    type: 'copy',
    isBase: false,
    expectedDifference: 'none',
    baseTemplate: 'site_visitor_welcome',
  },
  site_visitor_welcome_partner_a: {
    name: 'Partner A Welcome',
    description: 'Partner A variation - Same content, green color scheme',
    type: 'partner_a',
    isBase: false,
    expectedDifference: 'styling',
    baseTemplate: 'site_visitor_welcome',
  },
  site_visitor_welcome_partner_b: {
    name: 'Partner B Welcome',
    description: 'Partner B variation - Same colors, different content',
    type: 'partner_b',
    isBase: false,
    expectedDifference: 'content',
    baseTemplate: 'site_visitor_welcome',
  },
};

/**
 * Template comparisons to perform
 */
export const TEMPLATE_COMPARISONS = [
  {
    id: 'partner_a_vs_base',
    name: 'Partner A vs Base',
    base: 'site_visitor_welcome',
    compare: 'site_visitor_welcome_partner_a',
    expectedDifference: 'styling',
    description: 'Partner A should have different colors but same content',
  },
  {
    id: 'partner_b_vs_base',
    name: 'Partner B vs Base',
    base: 'site_visitor_welcome',
    compare: 'site_visitor_welcome_partner_b',
    expectedDifference: 'content',
    description: 'Partner B should have same colors but different content',
  },
];

// ============================================================================
// AI CONFIGURATION
// ============================================================================

export const AI_CONFIG = {
  defaultModel: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0,
};

// ============================================================================
// PIPELINE STEPS
// ============================================================================

/**
 * Pipeline step identifiers used for progress tracking
 */
export const PIPELINE_STEPS = {
  INIT: 'init',
  PLANNER: 'planner',
  ANALYZER: 'analyzer',
  GENERATOR: 'generator',
  DIFF: 'diff',
  PLAYWRIGHT: 'playwright',
  REPORTER: 'reporter',
  COMPLETE: 'complete',
  ERROR: 'error',
};

/**
 * Step markers for console output (parsed by web UI)
 */
export const STEP_MARKERS = {
  [PIPELINE_STEPS.PLANNER]: '[STEP:planner]',
  [PIPELINE_STEPS.ANALYZER]: '[STEP:analyzer]',
  [PIPELINE_STEPS.GENERATOR]: '[STEP:generator]',
  [PIPELINE_STEPS.DIFF]: '[STEP:diff]',
  [PIPELINE_STEPS.PLAYWRIGHT]: '[STEP:playwright]',
  [PIPELINE_STEPS.REPORTER]: '[STEP:reporter]',
};

/**
 * Pipeline step metadata
 */
export const PIPELINE_STEP_META = [
  {
    id: PIPELINE_STEPS.INIT,
    name: 'Initializing',
    description: 'Starting test pipeline...',
    icon: '🚀',
    progress: 0,
  },
  {
    id: PIPELINE_STEPS.PLANNER,
    name: 'Test Planner',
    description: 'Analyzing requirements and creating test plans',
    icon: '📋',
    progress: 15,
  },
  {
    id: PIPELINE_STEPS.ANALYZER,
    name: 'Change Analyzer',
    description: 'Detecting file changes and modified templates',
    icon: '🔍',
    progress: 30,
  },
  {
    id: PIPELINE_STEPS.GENERATOR,
    name: 'Test Generator',
    description: 'AI generating dynamic test cases from test plan',
    icon: '🤖',
    progress: 45,
  },
  {
    id: PIPELINE_STEPS.DIFF,
    name: 'Diff Analyzer',
    description: 'Comparing templates and detecting differences',
    icon: '⚖️',
    progress: 60,
  },
  {
    id: PIPELINE_STEPS.PLAYWRIGHT,
    name: 'Playwright Tests',
    description: 'Running AI-generated regression tests',
    icon: '🎭',
    progress: 75,
  },
  {
    id: PIPELINE_STEPS.REPORTER,
    name: 'Report Generator',
    description: 'Creating comprehensive test report',
    icon: '📊',
    progress: 90,
  },
  {
    id: PIPELINE_STEPS.COMPLETE,
    name: 'Complete',
    description: 'All tests completed successfully!',
    icon: '✅',
    progress: 100,
  },
  {
    id: PIPELINE_STEPS.ERROR,
    name: 'Error',
    description: 'Test failed - check reports for details',
    icon: '❌',
    progress: 100,
  },
];

// ============================================================================
// ANALYSIS SETTINGS
// ============================================================================

export const ANALYSIS = {
  // Difference types
  DIFFERENCE_TYPES: {
    STYLING: 'styling',
    CONTENT: 'content',
    STRUCTURE: 'structure',
    BOTH: 'both',
    NONE: 'none',
  },

  // Assessment levels
  ASSESSMENT: {
    PASS: 'pass',
    WARNING: 'warning',
    FAIL: 'fail',
  },

  // Priority levels
  PRIORITY: {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  },
};

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export const SERVER = {
  port: parseInt(process.env.PORT) || 3001,
  host: process.env.HOST || 'localhost',
};

// ============================================================================
// TIMEOUTS
// ============================================================================

export const TIMEOUTS = {
  apiRequest: 30000,      // 30 seconds for API requests
  compilation: 60000,     // 60 seconds for template compilation
  screenshot: 30000,      // 30 seconds per screenshot
  testRun: 300000,        // 5 minutes for full test run
};

// ============================================================================
// FILE PATTERNS
// ============================================================================

export const FILE_PATTERNS = {
  testPlan: (timestamp) => `test-plan-${timestamp}.json`,
  logFile: (timestamp) => `test-${timestamp}.log`,
  reportFile: (timestamp) => `report-${timestamp}.html`,

  // Regex patterns for extracting timestamps
  testPlanRegex: /test-plan-(.+)\.json$/,
  logFileRegex: /test-(.+)\.log$/,
  reportFileRegex: /report-(.+)\.html$/,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get template metadata by name
 */
export function getTemplateMeta(templateName) {
  return TEMPLATE_META[templateName] || {
    name: templateName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: '',
    type: 'unknown',
  };
}

/**
 * Get pipeline step metadata by id
 */
export function getStepMeta(stepId) {
  return PIPELINE_STEP_META.find(s => s.id === stepId) || PIPELINE_STEP_META[0];
}

/**
 * Get comparison config for a template
 */
export function getComparisonConfig(templateName) {
  return TEMPLATE_COMPARISONS.find(c => c.compare === templateName);
}

/**
 * Extract timestamp from a filename using file patterns
 */
export function extractTimestamp(filename, type) {
  const patterns = {
    testPlan: FILE_PATTERNS.testPlanRegex,
    log: FILE_PATTERNS.logFileRegex,
    report: FILE_PATTERNS.reportFileRegex,
  };

  const match = filename.match(patterns[type]);
  return match ? match[1] : null;
}

/**
 * Get all linked file names for a given timestamp
 */
export function getLinkedFiles(timestamp) {
  return {
    testPlan: FILE_PATTERNS.testPlan(timestamp),
    log: FILE_PATTERNS.logFile(timestamp),
    report: FILE_PATTERNS.reportFile(timestamp),
  };
}

export default {
  PATHS,
  TEMPLATE_FILES,
  TEMPLATE_NAMES,
  BASE_TEMPLATE,
  TEMPLATE_META,
  TEMPLATE_COMPARISONS,
  AI_CONFIG,
  PIPELINE_STEPS,
  STEP_MARKERS,
  PIPELINE_STEP_META,
  ANALYSIS,
  SERVER,
  TIMEOUTS,
  FILE_PATTERNS,
  getTemplateMeta,
  getStepMeta,
  getComparisonConfig,
  extractTimestamp,
  getLinkedFiles,
};
