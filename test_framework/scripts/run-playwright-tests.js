#!/usr/bin/env node

/**
 * Playwright Test Runner - CONFIGURABLE VALIDATION MODE
 *
 * MODES:
 * - STRICT: Tests WILL FAIL if template requirements are not met
 * - WEAK: Tests PASS with warnings, differences are reported but don't cause failure
 *
 * Set via TEST_MODE environment variable ('strict' or 'weak')
 *
 * REQUIREMENTS:
 * 1. Partner A: SAME content as base, DIFFERENT colors (green #16a34a)
 * 2. Partner B: DIFFERENT content from base, SAME colors (blue #2563eb)
 *
 * Test Categories:
 * - Render Validation: Templates compile, no errors, valid HTML
 * - Visual/Structural Comparison: Detect style and content differences
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

// Always use strict mode (weak mode removed from UI)
const TEST_MODE = 'strict';
const IS_STRICT_MODE = true;

// Templates to test from environment (comma-separated filenames or 'all')
// Format: "site_visitor_welcome.mjml,site_visitor_welcome_partner_a.mjml"
const TEST_TEMPLATES_ENV = process.env.TEST_TEMPLATES || '';
const SELECTED_TEMPLATES = TEST_TEMPLATES_ENV
  ? TEST_TEMPLATES_ENV.split(',').map(t => t.trim().replace('.mjml', ''))
  : []; // Empty array means test all

// All available templates
const ALL_TEMPLATES = [
  'site_visitor_welcome',
  'site_visitor_welcome_copy',
  'site_visitor_welcome_partner_a',
  'site_visitor_welcome_partner_b'
];

// Visual regression threshold (2% = 0.02)
const VISUAL_DIFF_THRESHOLD = 0.02;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const COMPILED_DIR = path.join(__dirname, '../output/compiled');
const SCREENSHOTS_DIR = path.join(__dirname, '../output/screenshots');
const BASELINE_DIR = path.join(__dirname, '../output/baselines');
const DIFF_DIR = path.join(__dirname, '../output/diffs');
const TEST_PLANS_DIR = path.join(__dirname, '../output/test-plans');
const RESULTS_DIR = path.join(__dirname, '../output/test-results');

// STRICT COLOR REQUIREMENTS
const COLORS = {
  BASE_PRIMARY: '#2563eb',      // Blue
  BASE_HEADING: '#1f2937',      // Dark gray
  PARTNER_A_PRIMARY: '#16a34a', // Green - MUST BE DIFFERENT
  PARTNER_A_HEADING: '#166534', // Dark green
  PARTNER_B_PRIMARY: '#2563eb', // Blue - MUST MATCH BASE
};

// STRICT CONTENT REQUIREMENTS
const CONTENT = {
  BASE_GREETING: 'Hello',
  BASE_BUTTON: 'Get Started Now',
  PARTNER_B_GREETING: 'Greetings',      // MUST BE DIFFERENT
  PARTNER_B_BUTTON: 'Begin Your Journey', // MUST BE DIFFERENT
};

const VIEWPORTS = [
  { name: 'desktop', width: 1200, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

class PlaywrightTestRunner {
  constructor() {
    this.browser = null;
    this.testMode = TEST_MODE;
    this.isStrictMode = IS_STRICT_MODE;
    // Determine which templates to test
    this.templatesToTest = SELECTED_TEMPLATES.length > 0 ? SELECTED_TEMPLATES : ALL_TEMPLATES;
    this.testAllTemplates = SELECTED_TEMPLATES.length === 0;
    this.results = {
      timestamp: new Date().toISOString(),
      testPlanId: null,
      testMode: TEST_MODE,
      templatesToTest: this.templatesToTest,
      totalTests: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      skipped: 0,
      testCases: [],
    };
  }

  log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }

  /**
   * Check if a template should be tested
   */
  shouldTestTemplate(templateName) {
    const name = templateName.replace('.mjml', '');
    return this.templatesToTest.includes(name);
  }

  /**
   * Check if a comparison test should run (both templates must be selected)
   */
  shouldTestComparison(baseTemplate, compareTemplate) {
    return this.shouldTestTemplate(baseTemplate) && this.shouldTestTemplate(compareTemplate);
  }

  async initialize() {
    this.log('Launching Playwright browser...');
    this.browser = await chromium.launch({ headless: true });
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await fs.mkdir(BASELINE_DIR, { recursive: true });
    await fs.mkdir(DIFF_DIR, { recursive: true });
    await fs.mkdir(RESULTS_DIR, { recursive: true });
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async loadTestPlan() {
    const files = await fs.readdir(TEST_PLANS_DIR);
    const testPlanFiles = files
      .filter(f => f.startsWith('test-plan-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (testPlanFiles.length === 0) {
      throw new Error('No test plan found. Run the test planner first.');
    }

    const latestPlan = path.join(TEST_PLANS_DIR, testPlanFiles[0]);
    this.log(`Loading test plan: ${testPlanFiles[0]}`);

    const content = await fs.readFile(latestPlan, 'utf-8');
    return JSON.parse(content);
  }

  async loadTemplate(templateName) {
    const htmlPath = path.join(COMPILED_DIR, `${templateName}.html`);
    return await fs.readFile(htmlPath, 'utf-8');
  }

  /**
   * Run validation tests based on test mode (strict or weak)
   * In strict mode: failed assertions cause test failure
   * In weak mode: failed assertions become warnings, tests pass
   * Tests are filtered based on selected templates
   */
  async runValidationTests(context) {
    // Define all validation tests aligned with Test Plan (TC001-TC023)
    const allValidationTests = [
      // ========== Template Compilation Suite (TC001-TC004) ==========
      {
        id: 'TC001',
        name: 'Base Template Compilation',
        description: 'Verify site_visitor_welcome.mjml compiles successfully',
        category: 'compilation',
        suite: 'Template Compilation',
        priority: 'critical',
        templates: ['site_visitor_welcome'],
        run: () => this.testCompilation('site_visitor_welcome'),
      },
      {
        id: 'TC002',
        name: 'Copy Template Compilation',
        description: 'Verify site_visitor_welcome_copy.mjml compiles successfully',
        category: 'compilation',
        suite: 'Template Compilation',
        priority: 'critical',
        templates: ['site_visitor_welcome_copy'],
        run: () => this.testCompilation('site_visitor_welcome_copy'),
      },
      {
        id: 'TC003',
        name: 'Partner A Template Compilation',
        description: 'Verify site_visitor_welcome_partner_a.mjml compiles successfully',
        category: 'compilation',
        suite: 'Template Compilation',
        priority: 'critical',
        templates: ['site_visitor_welcome_partner_a'],
        run: () => this.testCompilation('site_visitor_welcome_partner_a'),
      },
      {
        id: 'TC004',
        name: 'Partner B Template Compilation',
        description: 'Verify site_visitor_welcome_partner_b.mjml compiles successfully',
        category: 'compilation',
        suite: 'Template Compilation',
        priority: 'critical',
        templates: ['site_visitor_welcome_partner_b'],
        run: () => this.testCompilation('site_visitor_welcome_partner_b'),
      },
      // ========== EJS Variable Rendering Suite (TC005-TC008) ==========
      {
        id: 'TC005',
        name: 'Base Template Variable Rendering',
        description: 'Verify EJS variables render correctly in site_visitor_welcome',
        category: 'rendering',
        suite: 'EJS Variable Rendering',
        priority: 'critical',
        templates: ['site_visitor_welcome'],
        run: () => this.testEjsRendering('site_visitor_welcome', context),
      },
      {
        id: 'TC006',
        name: 'Copy Template Variable Rendering',
        description: 'Verify EJS variables render correctly in site_visitor_welcome_copy',
        category: 'rendering',
        suite: 'EJS Variable Rendering',
        priority: 'critical',
        templates: ['site_visitor_welcome_copy'],
        run: () => this.testEjsRendering('site_visitor_welcome_copy', context),
      },
      {
        id: 'TC007',
        name: 'Partner A Template Variable Rendering',
        description: 'Verify EJS variables render correctly in site_visitor_welcome_partner_a',
        category: 'rendering',
        suite: 'EJS Variable Rendering',
        priority: 'critical',
        templates: ['site_visitor_welcome_partner_a'],
        run: () => this.testEjsRendering('site_visitor_welcome_partner_a', context),
      },
      {
        id: 'TC008',
        name: 'Partner B Template Variable Rendering',
        description: 'Verify EJS variables render correctly in site_visitor_welcome_partner_b',
        category: 'rendering',
        suite: 'EJS Variable Rendering',
        priority: 'critical',
        templates: ['site_visitor_welcome_partner_b'],
        run: () => this.testEjsRendering('site_visitor_welcome_partner_b', context),
      },
      // ========== Color Scheme Validation Suite (TC009-TC012) ==========
      // REGRESSION MODE: All templates must use BASE blue color (#2563eb)
      {
        id: 'TC009',
        name: 'Base Template Color Validation',
        description: 'REGRESSION: Verify blue color scheme in base template',
        category: 'styling',
        suite: 'Color Scheme Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome'],
        run: () => this.testBaseColors(context),
      },
      {
        id: 'TC010',
        name: 'Copy Template Color Regression',
        description: 'REGRESSION: Copy must use same blue color as base',
        category: 'styling',
        suite: 'Color Scheme Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome_copy'],
        run: () => this.testTemplateMatchesBaseColors('site_visitor_welcome_copy', context),
      },
      {
        id: 'TC011',
        name: 'Partner A Color Regression',
        description: 'REGRESSION: Partner A must use same blue color as base - green is a FAILURE',
        category: 'styling',
        suite: 'Color Scheme Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome_partner_a'],
        run: () => this.testTemplateMatchesBaseColors('site_visitor_welcome_partner_a', context),
      },
      {
        id: 'TC012',
        name: 'Partner B Color Regression',
        description: 'REGRESSION: Partner B must use same blue color as base',
        category: 'styling',
        suite: 'Color Scheme Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome_partner_b'],
        run: () => this.testTemplateMatchesBaseColors('site_visitor_welcome_partner_b', context),
      },
      // ========== Content Validation Suite (TC013-TC016) ==========
      // REGRESSION MODE: All templates must have SAME content as base
      {
        id: 'TC013',
        name: 'Base Template Content Check',
        description: 'REGRESSION: Verify base template content elements',
        category: 'content',
        suite: 'Content Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome'],
        run: () => this.testBaseContent(context),
      },
      {
        id: 'TC014',
        name: 'Copy Template Content Regression',
        description: 'REGRESSION: Copy must have identical content to base',
        category: 'content',
        suite: 'Content Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome', 'site_visitor_welcome_copy'],
        run: () => this.testTemplateMatchesBaseContent('site_visitor_welcome_copy', context),
      },
      {
        id: 'TC015',
        name: 'Partner A Content Regression',
        description: 'REGRESSION: Partner A must have same content as base',
        category: 'content',
        suite: 'Content Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome', 'site_visitor_welcome_partner_a'],
        run: () => this.testTemplateMatchesBaseContent('site_visitor_welcome_partner_a', context),
      },
      {
        id: 'TC016',
        name: 'Partner B Content Regression',
        description: 'REGRESSION: Partner B must have same content as base - different content is a FAILURE',
        category: 'content',
        suite: 'Content Validation',
        priority: 'critical',
        templates: ['site_visitor_welcome', 'site_visitor_welcome_partner_b'],
        run: () => this.testTemplateMatchesBaseContent('site_visitor_welcome_partner_b', context),
      },
      // ========== Structure Validation Suite (TC017-TC020) ==========
      {
        id: 'TC017',
        name: 'Base Template Structure',
        description: 'Verify base template has expected HTML structure',
        category: 'structure',
        suite: 'Structure Validation',
        priority: 'medium',
        templates: ['site_visitor_welcome'],
        run: () => this.testTemplateStructure('site_visitor_welcome'),
      },
      {
        id: 'TC018',
        name: 'Copy Template Structure Consistency',
        description: 'Verify copy template has identical structure to base',
        category: 'structure',
        suite: 'Structure Validation',
        priority: 'medium',
        templates: ['site_visitor_welcome_copy'],
        run: () => this.testTemplateStructure('site_visitor_welcome_copy'),
      },
      {
        id: 'TC019',
        name: 'Partner A Structure Consistency',
        description: 'Verify partner A has minimal structural changes',
        category: 'structure',
        suite: 'Structure Validation',
        priority: 'medium',
        templates: ['site_visitor_welcome_partner_a'],
        run: () => this.testTemplateStructure('site_visitor_welcome_partner_a'),
      },
      {
        id: 'TC020',
        name: 'Partner B Extended Structure',
        description: 'Verify partner B has expected additional content structure',
        category: 'structure',
        suite: 'Structure Validation',
        priority: 'medium',
        templates: ['site_visitor_welcome_partner_b'],
        run: () => this.testTemplateStructure('site_visitor_welcome_partner_b'),
      },
      // ========== Cross-Template Comparison Suite (TC021-TC023) ==========
      // REGRESSION MODE: All templates must match base - any difference is a FAILURE
      {
        id: 'TC021',
        name: 'Base vs Copy Regression',
        description: 'REGRESSION: Copy must be pixel-identical to base template',
        category: 'comparison',
        suite: 'Cross-Template Comparison',
        priority: 'critical',
        templates: ['site_visitor_welcome', 'site_visitor_welcome_copy'],
        run: () => this.testVisualRegression('site_visitor_welcome', 'site_visitor_welcome_copy', context, false),
      },
      {
        id: 'TC022',
        name: 'Partner A vs Base Regression',
        description: 'REGRESSION: Partner A must match base template - any difference is a failure',
        category: 'comparison',
        suite: 'Cross-Template Comparison',
        priority: 'critical',
        templates: ['site_visitor_welcome', 'site_visitor_welcome_partner_a'],
        run: () => this.testVisualRegression('site_visitor_welcome', 'site_visitor_welcome_partner_a', context, false),
      },
      {
        id: 'TC023',
        name: 'Partner B vs Base Regression',
        description: 'REGRESSION: Partner B must match base template - any difference is a failure',
        category: 'comparison',
        suite: 'Cross-Template Comparison',
        priority: 'critical',
        templates: ['site_visitor_welcome', 'site_visitor_welcome_partner_b'],
        run: () => this.testVisualRegression('site_visitor_welcome', 'site_visitor_welcome_partner_b', context, false),
      },
    ];

    // Filter tests based on selected templates
    const validationTests = allValidationTests.filter(test => {
      // If test has no specific templates, always run (uses this.templatesToTest internally)
      if (!test.templates || test.templates.length === 0) {
        return true;
      }
      // For tests with specific templates, check if all required templates are selected
      return test.templates.every(t => this.shouldTestTemplate(t));
    });

    this.log(`\n  Testing templates: ${this.templatesToTest.join(', ')}`);
    this.log(`  Running ${validationTests.length} of ${allValidationTests.length} tests (filtered by selected templates)`);

    for (const test of validationTests) {
      this.log(`\n  Running: [${test.id}] ${test.name}`);
      const startTime = Date.now();

      const result = {
        id: test.id,
        name: test.name,
        description: test.description || '',
        category: test.category,
        suite: test.suite || '',
        priority: test.priority || 'medium',
        status: 'pending',
        assertions: [],
        duration: 0,
        error: null,
        hasWarnings: false,
      };

      try {
        const assertions = await test.run();
        result.assertions = assertions;

        // Check if all assertions passed
        const allPassed = assertions.every(a => a.passed);
        const failedCount = assertions.filter(a => !a.passed).length;

        if (allPassed) {
          result.status = 'passed';
        } else if (this.isStrictMode) {
          // STRICT MODE: Failed assertions cause test failure
          result.status = 'failed';
        } else {
          // WEAK MODE: Failed assertions become warnings, test passes
          result.status = 'passed';
          result.hasWarnings = true;
          // Mark failed assertions as warnings
          result.assertions = assertions.map(a => ({
            ...a,
            isWarning: !a.passed,
            originalPassed: a.passed,
          }));
        }
      } catch (error) {
        result.status = 'failed';
        result.error = error.message;
        result.assertions.push({
          name: 'Test execution',
          passed: false,
          message: `Error: ${error.message}`,
        });
      }

      result.duration = Date.now() - startTime;
      this.results.testCases.push(result);
      this.results.totalTests++;

      if (result.status === 'passed' && result.hasWarnings) {
        this.results.passed++;
        this.results.warnings++;
        this.log(`    ⚠️  PASSED WITH WARNINGS (${result.duration}ms)`);
      } else if (result.status === 'passed') {
        this.results.passed++;
        this.log(`    ✅ PASSED (${result.duration}ms)`);
      } else {
        this.results.failed++;
        this.log(`    ❌ FAILED (${result.duration}ms)`);
      }

      for (const assertion of result.assertions) {
        const icon = assertion.passed ? '✓' : (assertion.isWarning ? '⚠' : '✗');
        const prefix = assertion.isWarning ? '[WARNING] ' : '';
        this.log(`       ${icon} ${prefix}${assertion.name}: ${assertion.message}`);
      }
    }
  }

  /**
   * TEST: Template Compilation
   */
  async testCompilation(templateName) {
    const assertions = [];

    try {
      const html = await this.loadTemplate(templateName);

      assertions.push({
        name: 'Template exists and loads',
        passed: html && html.length > 0,
        message: html ? `Loaded ${html.length} bytes` : 'FAILED: Template empty or missing',
      });

      const hasDoctype = html.toLowerCase().includes('<!doctype');
      const hasHtmlTag = html.includes('<html');
      const hasBodyTag = html.includes('<body');

      assertions.push({
        name: 'Valid HTML structure',
        passed: hasDoctype && hasHtmlTag && hasBodyTag,
        message: hasDoctype && hasHtmlTag && hasBodyTag
          ? 'DOCTYPE, HTML, BODY tags present'
          : `FAILED: Missing ${!hasDoctype ? 'DOCTYPE ' : ''}${!hasHtmlTag ? 'HTML ' : ''}${!hasBodyTag ? 'BODY' : ''}`,
      });

      // Check for unresolved EJS
      const hasUnresolvedEjs = html.includes('<%') || html.includes('%>');
      assertions.push({
        name: 'No unresolved EJS tags',
        passed: !hasUnresolvedEjs,
        message: hasUnresolvedEjs ? 'FAILED: Found unresolved EJS tags' : 'All EJS resolved',
      });
    } catch (error) {
      assertions.push({
        name: 'Template loads',
        passed: false,
        message: `FAILED: ${error.message}`,
      });
    }

    return assertions;
  }

  /**
   * TEST: EJS Rendering
   */
  async testEjsRendering(templateName, context) {
    const assertions = [];
    const page = await context.newPage();

    try {
      const html = await this.loadTemplate(templateName);
      await page.setContent(html, { waitUntil: 'networkidle' });

      const bodyText = await page.evaluate(() => document.body.innerText);

      // Check personalization
      const hasPersonalization = bodyText.includes('John') || bodyText.includes('Valued Visitor') || bodyText.includes('Carebox');
      assertions.push({
        name: 'Variables rendered',
        passed: hasPersonalization,
        message: hasPersonalization ? 'Personalization content found' : 'FAILED: No personalization found',
      });
    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * TEST: Base Template Colors (Blue #2563eb)
   */
  async testBaseColors(context) {
    const assertions = [];
    const html = await this.loadTemplate('site_visitor_welcome');
    const htmlLower = html.toLowerCase();

    const hasBlue = htmlLower.includes(COLORS.BASE_PRIMARY.toLowerCase());
    assertions.push({
      name: `Base has blue primary color (${COLORS.BASE_PRIMARY})`,
      passed: hasBlue,
      message: hasBlue
        ? `✓ Found ${COLORS.BASE_PRIMARY}`
        : `FAILED: Base template missing blue color ${COLORS.BASE_PRIMARY}`,
    });

    return assertions;
  }

  /**
   * TEST: Partner A Colors - MUST be GREEN, MUST NOT be BASE BLUE
   */
  async testPartnerAColors(context) {
    const assertions = [];
    const html = await this.loadTemplate('site_visitor_welcome_partner_a');
    const htmlLower = html.toLowerCase();

    // MUST have green
    const hasGreen = htmlLower.includes(COLORS.PARTNER_A_PRIMARY.toLowerCase());
    assertions.push({
      name: `Partner A has green primary color (${COLORS.PARTNER_A_PRIMARY})`,
      passed: hasGreen,
      message: hasGreen
        ? `✓ Found green color ${COLORS.PARTNER_A_PRIMARY}`
        : `FAILED: Partner A MUST have green color ${COLORS.PARTNER_A_PRIMARY} - NOT FOUND!`,
    });

    // MUST NOT have base blue as primary (check for blue in style attributes)
    const bluePattern = new RegExp(`(background-color|bgcolor|color)\\s*[:=]\\s*['"]?${COLORS.BASE_PRIMARY}`, 'gi');
    const hasBlueAsPrimary = bluePattern.test(html);

    assertions.push({
      name: `Partner A does NOT use base blue (${COLORS.BASE_PRIMARY})`,
      passed: !hasBlueAsPrimary,
      message: hasBlueAsPrimary
        ? `FAILED: Partner A uses base blue ${COLORS.BASE_PRIMARY} - should use GREEN ${COLORS.PARTNER_A_PRIMARY}!`
        : `✓ Partner A correctly avoids base blue color`,
    });

    // Take screenshot
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'partner-a-colors.png'), fullPage: true });
    await page.close();

    return assertions;
  }

  /**
   * TEST: Partner B Colors - MUST be SAME as Base (Blue #2563eb)
   */
  async testPartnerBColors(context) {
    const assertions = [];
    const html = await this.loadTemplate('site_visitor_welcome_partner_b');
    const htmlLower = html.toLowerCase();

    // MUST have same blue as base
    const hasBlue = htmlLower.includes(COLORS.PARTNER_B_PRIMARY.toLowerCase());
    assertions.push({
      name: `Partner B has blue primary color (${COLORS.PARTNER_B_PRIMARY})`,
      passed: hasBlue,
      message: hasBlue
        ? `✓ Found blue color ${COLORS.PARTNER_B_PRIMARY} matching base`
        : `FAILED: Partner B MUST have same blue color as base ${COLORS.PARTNER_B_PRIMARY} - NOT FOUND!`,
    });

    // MUST NOT have Partner A green
    const hasGreen = htmlLower.includes(COLORS.PARTNER_A_PRIMARY.toLowerCase());
    assertions.push({
      name: `Partner B does NOT use Partner A green`,
      passed: !hasGreen,
      message: hasGreen
        ? `FAILED: Partner B has green ${COLORS.PARTNER_A_PRIMARY} - should have BLUE like base!`
        : `✓ Partner B correctly uses base colors, not Partner A colors`,
    });

    // Take screenshot
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'partner-b-colors.png'), fullPage: true });
    await page.close();

    return assertions;
  }

  /**
   * TEST: Copy Template Colors - MUST match Base (Blue #2563eb)
   */
  async testCopyColors(context) {
    const assertions = [];
    const html = await this.loadTemplate('site_visitor_welcome_copy');
    const htmlLower = html.toLowerCase();

    // MUST have same blue as base
    const hasBlue = htmlLower.includes(COLORS.BASE_PRIMARY.toLowerCase());
    assertions.push({
      name: `Copy has blue primary color (${COLORS.BASE_PRIMARY})`,
      passed: hasBlue,
      message: hasBlue
        ? `✓ Found blue color ${COLORS.BASE_PRIMARY} matching base`
        : `FAILED: Copy template MUST have same blue color as base ${COLORS.BASE_PRIMARY}`,
    });

    // MUST NOT have Partner A green
    const hasGreen = htmlLower.includes(COLORS.PARTNER_A_PRIMARY.toLowerCase());
    assertions.push({
      name: `Copy does NOT use Partner A green`,
      passed: !hasGreen,
      message: hasGreen
        ? `FAILED: Copy template has green ${COLORS.PARTNER_A_PRIMARY} - should match base blue!`
        : `✓ Copy template correctly uses base colors`,
    });

    return assertions;
  }

  /**
   * REGRESSION TEST: Template must match base colors (Blue #2563eb)
   * Any non-base color is a FAILURE
   */
  async testTemplateMatchesBaseColors(templateName, context) {
    const assertions = [];
    const html = await this.loadTemplate(templateName);
    const htmlLower = html.toLowerCase();

    // MUST have base blue color
    const hasBlue = htmlLower.includes(COLORS.BASE_PRIMARY.toLowerCase());
    assertions.push({
      name: `${templateName} has base blue color (${COLORS.BASE_PRIMARY})`,
      passed: hasBlue,
      message: hasBlue
        ? `✓ Found base blue color ${COLORS.BASE_PRIMARY}`
        : `REGRESSION FAILURE: ${templateName} is missing base blue color ${COLORS.BASE_PRIMARY}`,
    });

    // MUST NOT have green (Partner A color)
    const hasGreen = htmlLower.includes(COLORS.PARTNER_A_PRIMARY.toLowerCase());
    assertions.push({
      name: `${templateName} does NOT use green (${COLORS.PARTNER_A_PRIMARY})`,
      passed: !hasGreen,
      message: hasGreen
        ? `REGRESSION FAILURE: ${templateName} uses green ${COLORS.PARTNER_A_PRIMARY} instead of base blue ${COLORS.BASE_PRIMARY}!`
        : `✓ No unauthorized green color found`,
    });

    // Take screenshot for evidence
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `regression-colors-${templateName}.png`), fullPage: true });
    await page.close();

    return assertions;
  }

  /**
   * REGRESSION TEST: Template must match base content
   * Any different content is a FAILURE
   */
  async testTemplateMatchesBaseContent(templateName, context) {
    const assertions = [];
    const page = await context.newPage();

    try {
      const html = await this.loadTemplate(templateName);
      await page.setContent(html, { waitUntil: 'networkidle' });
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // MUST have base greeting "Hello"
      const hasHello = bodyText.includes(CONTENT.BASE_GREETING.toLowerCase());
      assertions.push({
        name: `${templateName} has base greeting "${CONTENT.BASE_GREETING}"`,
        passed: hasHello,
        message: hasHello
          ? `✓ Found base greeting "${CONTENT.BASE_GREETING}"`
          : `REGRESSION FAILURE: ${templateName} is missing base greeting "${CONTENT.BASE_GREETING}"`,
      });

      // MUST NOT have Partner B greeting "Greetings"
      const hasGreetings = bodyText.includes(CONTENT.PARTNER_B_GREETING.toLowerCase());
      assertions.push({
        name: `${templateName} does NOT have "${CONTENT.PARTNER_B_GREETING}"`,
        passed: !hasGreetings,
        message: hasGreetings
          ? `REGRESSION FAILURE: ${templateName} has "${CONTENT.PARTNER_B_GREETING}" instead of base "${CONTENT.BASE_GREETING}"!`
          : `✓ No unauthorized content variations found`,
      });

      // MUST have base button "Get Started Now"
      const hasBaseButton = bodyText.includes(CONTENT.BASE_BUTTON.toLowerCase());
      assertions.push({
        name: `${templateName} has base button "${CONTENT.BASE_BUTTON}"`,
        passed: hasBaseButton,
        message: hasBaseButton
          ? `✓ Found base button "${CONTENT.BASE_BUTTON}"`
          : `REGRESSION FAILURE: ${templateName} is missing base button "${CONTENT.BASE_BUTTON}"`,
      });

      // MUST NOT have Partner B button "Begin Your Journey"
      const hasJourneyButton = bodyText.includes(CONTENT.PARTNER_B_BUTTON.toLowerCase());
      assertions.push({
        name: `${templateName} does NOT have "${CONTENT.PARTNER_B_BUTTON}"`,
        passed: !hasJourneyButton,
        message: hasJourneyButton
          ? `REGRESSION FAILURE: ${templateName} has "${CONTENT.PARTNER_B_BUTTON}" instead of base "${CONTENT.BASE_BUTTON}"!`
          : `✓ No unauthorized button text found`,
      });
    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * TEST: Base Template Content - verify standard content elements
   */
  async testBaseContent(context) {
    const assertions = [];
    const page = await context.newPage();

    try {
      const html = await this.loadTemplate('site_visitor_welcome');
      await page.setContent(html, { waitUntil: 'networkidle' });
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Check greeting
      const hasHello = bodyText.includes(CONTENT.BASE_GREETING.toLowerCase());
      assertions.push({
        name: `Base template has greeting "${CONTENT.BASE_GREETING}"`,
        passed: hasHello,
        message: hasHello
          ? `✓ Found greeting "${CONTENT.BASE_GREETING}"`
          : `FAILED: Base template missing "${CONTENT.BASE_GREETING}" greeting`,
      });

      // Check button text
      const hasButton = bodyText.includes(CONTENT.BASE_BUTTON.toLowerCase());
      assertions.push({
        name: `Base template has button "${CONTENT.BASE_BUTTON}"`,
        passed: hasButton,
        message: hasButton
          ? `✓ Found button "${CONTENT.BASE_BUTTON}"`
          : `FAILED: Base template missing "${CONTENT.BASE_BUTTON}" button`,
      });
    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * TEST: Copy Template Content - MUST be identical to Base
   */
  async testCopyContent(context) {
    const assertions = [];
    const page = await context.newPage();

    try {
      // Load base template
      const baseHtml = await this.loadTemplate('site_visitor_welcome');
      await page.setContent(baseHtml, { waitUntil: 'networkidle' });
      const baseText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Load copy template
      const copyHtml = await this.loadTemplate('site_visitor_welcome_copy');
      await page.setContent(copyHtml, { waitUntil: 'networkidle' });
      const copyText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Check greeting matches
      const baseHasHello = baseText.includes(CONTENT.BASE_GREETING.toLowerCase());
      const copyHasHello = copyText.includes(CONTENT.BASE_GREETING.toLowerCase());
      assertions.push({
        name: `Copy greeting matches base ("${CONTENT.BASE_GREETING}")`,
        passed: baseHasHello && copyHasHello,
        message: copyHasHello
          ? `✓ Copy has same greeting "${CONTENT.BASE_GREETING}" as base`
          : `FAILED: Copy template MUST have "${CONTENT.BASE_GREETING}" greeting like base`,
      });

      // Check button matches
      const baseHasButton = baseText.includes(CONTENT.BASE_BUTTON.toLowerCase());
      const copyHasButton = copyText.includes(CONTENT.BASE_BUTTON.toLowerCase());
      assertions.push({
        name: `Copy button matches base ("${CONTENT.BASE_BUTTON}")`,
        passed: baseHasButton && copyHasButton,
        message: copyHasButton
          ? `✓ Copy has same button "${CONTENT.BASE_BUTTON}" as base`
          : `FAILED: Copy template MUST have "${CONTENT.BASE_BUTTON}" button like base`,
      });
    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * TEST: Template Structure - verify HTML structure per template
   */
  async testTemplateStructure(templateName) {
    const assertions = [];

    try {
      const html = await this.loadTemplate(templateName);

      // Check basic HTML structure
      const hasDoctype = html.toLowerCase().includes('<!doctype');
      const hasHtml = html.includes('<html');
      const hasHead = html.includes('<head');
      const hasBody = html.includes('<body');
      const isValid = hasDoctype && hasHtml && hasHead && hasBody;

      assertions.push({
        name: `${templateName} has valid HTML structure`,
        passed: isValid,
        message: isValid
          ? `✓ Valid HTML structure (DOCTYPE, HTML, HEAD, BODY)`
          : `FAILED: Invalid HTML structure`,
      });

      // Check file size
      const sizeKb = Buffer.byteLength(html, 'utf-8') / 1024;
      const MAX_SIZE_KB = 102;
      const withinLimit = sizeKb < MAX_SIZE_KB;

      assertions.push({
        name: `${templateName} size under ${MAX_SIZE_KB}KB`,
        passed: withinLimit,
        message: withinLimit
          ? `✓ ${sizeKb.toFixed(1)}KB (under ${MAX_SIZE_KB}KB limit)`
          : `FAILED: ${sizeKb.toFixed(1)}KB exceeds ${MAX_SIZE_KB}KB limit`,
      });

      // Check no unresolved EJS
      const hasUnresolvedEjs = html.includes('<%') || html.includes('%>');
      assertions.push({
        name: `${templateName} has no unresolved EJS`,
        passed: !hasUnresolvedEjs,
        message: hasUnresolvedEjs
          ? `FAILED: Found unresolved EJS tags`
          : `✓ All EJS resolved`,
      });
    } catch (error) {
      assertions.push({
        name: `${templateName} loads`,
        passed: false,
        message: `FAILED: ${error.message}`,
      });
    }

    return assertions;
  }

  /**
   * TEST: Partner A Content - MUST be SAME as Base
   */
  async testPartnerAContent(context) {
    const assertions = [];
    const page = await context.newPage();

    try {
      // Load base template
      const baseHtml = await this.loadTemplate('site_visitor_welcome');
      await page.setContent(baseHtml, { waitUntil: 'networkidle' });
      const baseText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Load Partner A
      const partnerAHtml = await this.loadTemplate('site_visitor_welcome_partner_a');
      await page.setContent(partnerAHtml, { waitUntil: 'networkidle' });
      const partnerAText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Check greeting - MUST be same
      const baseHasHello = baseText.includes(CONTENT.BASE_GREETING.toLowerCase());
      const partnerAHasHello = partnerAText.includes(CONTENT.BASE_GREETING.toLowerCase());

      assertions.push({
        name: `Partner A greeting matches base ("${CONTENT.BASE_GREETING}")`,
        passed: baseHasHello && partnerAHasHello,
        message: partnerAHasHello
          ? `✓ Partner A has same greeting "${CONTENT.BASE_GREETING}" as base`
          : `FAILED: Partner A MUST have "${CONTENT.BASE_GREETING}" greeting like base - content should be SAME!`,
      });

      // Check button text - MUST be same
      const baseHasButton = baseText.includes(CONTENT.BASE_BUTTON.toLowerCase());
      const partnerAHasButton = partnerAText.includes(CONTENT.BASE_BUTTON.toLowerCase());

      assertions.push({
        name: `Partner A button matches base ("${CONTENT.BASE_BUTTON}")`,
        passed: baseHasButton && partnerAHasButton,
        message: partnerAHasButton
          ? `✓ Partner A has same button "${CONTENT.BASE_BUTTON}" as base`
          : `FAILED: Partner A MUST have "${CONTENT.BASE_BUTTON}" button like base - content should be SAME!`,
      });

      // Partner A MUST NOT have Partner B's different content
      const partnerAHasGreetings = partnerAText.includes(CONTENT.PARTNER_B_GREETING.toLowerCase());
      assertions.push({
        name: `Partner A does NOT have Partner B's greeting`,
        passed: !partnerAHasGreetings,
        message: partnerAHasGreetings
          ? `FAILED: Partner A has "${CONTENT.PARTNER_B_GREETING}" - should have "${CONTENT.BASE_GREETING}" like base!`
          : `✓ Partner A correctly uses base content`,
      });
    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * TEST: Partner B Content - MUST be DIFFERENT from Base
   */
  async testPartnerBContent(context) {
    const assertions = [];
    const page = await context.newPage();

    try {
      // Load base template
      const baseHtml = await this.loadTemplate('site_visitor_welcome');
      await page.setContent(baseHtml, { waitUntil: 'networkidle' });
      const baseText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Load Partner B
      const partnerBHtml = await this.loadTemplate('site_visitor_welcome_partner_b');
      await page.setContent(partnerBHtml, { waitUntil: 'networkidle' });
      const partnerBText = await page.evaluate(() => document.body.innerText.toLowerCase());

      // Check greeting - MUST be different ("Greetings" not "Hello")
      const partnerBHasGreetings = partnerBText.includes(CONTENT.PARTNER_B_GREETING.toLowerCase());
      const partnerBHasHello = partnerBText.includes(CONTENT.BASE_GREETING.toLowerCase());

      assertions.push({
        name: `Partner B has different greeting ("${CONTENT.PARTNER_B_GREETING}")`,
        passed: partnerBHasGreetings,
        message: partnerBHasGreetings
          ? `✓ Partner B correctly uses "${CONTENT.PARTNER_B_GREETING}" instead of "${CONTENT.BASE_GREETING}"`
          : `FAILED: Partner B MUST have "${CONTENT.PARTNER_B_GREETING}" - NOT "${CONTENT.BASE_GREETING}"! Content should be DIFFERENT!`,
      });

      assertions.push({
        name: `Partner B does NOT have base greeting ("${CONTENT.BASE_GREETING}")`,
        passed: !partnerBHasHello,
        message: partnerBHasHello
          ? `FAILED: Partner B still has "${CONTENT.BASE_GREETING}" - should be replaced with "${CONTENT.PARTNER_B_GREETING}"!`
          : `✓ Partner B correctly removed base greeting`,
      });

      // Check button - MUST be different
      const partnerBHasJourney = partnerBText.includes(CONTENT.PARTNER_B_BUTTON.toLowerCase());
      const partnerBHasGetStarted = partnerBText.includes(CONTENT.BASE_BUTTON.toLowerCase());

      assertions.push({
        name: `Partner B has different button ("${CONTENT.PARTNER_B_BUTTON}")`,
        passed: partnerBHasJourney,
        message: partnerBHasJourney
          ? `✓ Partner B correctly uses "${CONTENT.PARTNER_B_BUTTON}" button`
          : `FAILED: Partner B MUST have "${CONTENT.PARTNER_B_BUTTON}" button - NOT "${CONTENT.BASE_BUTTON}"!`,
      });

      assertions.push({
        name: `Partner B does NOT have base button ("${CONTENT.BASE_BUTTON}")`,
        passed: !partnerBHasGetStarted,
        message: partnerBHasGetStarted
          ? `FAILED: Partner B still has "${CONTENT.BASE_BUTTON}" button - should be replaced!`
          : `✓ Partner B correctly removed base button`,
      });
    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * TEST: HTML Structure (tests only selected templates)
   */
  async testHtmlStructure() {
    const assertions = [];

    for (const name of this.templatesToTest) {
      try {
        const html = await this.loadTemplate(name);
        const hasDoctype = html.toLowerCase().includes('<!doctype');
        const hasHtml = html.includes('<html');
        const hasHead = html.includes('<head');
        const hasBody = html.includes('<body');
        const isValid = hasDoctype && hasHtml && hasHead && hasBody;

        assertions.push({
          name: `${name} valid structure`,
          passed: isValid,
          message: isValid ? '✓ Valid HTML' : `FAILED: Invalid HTML structure`,
        });
      } catch (error) {
        assertions.push({
          name: `${name} loads`,
          passed: false,
          message: `FAILED: ${error.message}`,
        });
      }
    }

    return assertions;
  }

  /**
   * TEST: Size Limits (tests only selected templates)
   */
  async testSizeLimits() {
    const assertions = [];
    const MAX_SIZE_KB = 102;

    for (const name of this.templatesToTest) {
      try {
        const html = await this.loadTemplate(name);
        const sizeKb = Buffer.byteLength(html, 'utf-8') / 1024;
        const withinLimit = sizeKb < MAX_SIZE_KB;

        assertions.push({
          name: `${name} size`,
          passed: withinLimit,
          message: withinLimit
            ? `✓ ${sizeKb.toFixed(1)}KB (under ${MAX_SIZE_KB}KB)`
            : `FAILED: ${sizeKb.toFixed(1)}KB exceeds ${MAX_SIZE_KB}KB limit`,
        });
      } catch (error) {
        assertions.push({
          name: `${name} size check`,
          passed: false,
          message: `FAILED: ${error.message}`,
        });
      }
    }

    return assertions;
  }

  /**
   * TEST: Responsive
   */
  async testResponsive(context) {
    const assertions = [];
    const page = await context.newPage();

    try {
      const html = await this.loadTemplate('site_visitor_welcome');

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.setContent(html, { waitUntil: 'networkidle' });

        const hasHorizontalScroll = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth
        );

        assertions.push({
          name: `${viewport.name} (${viewport.width}px)`,
          passed: !hasHorizontalScroll,
          message: hasHorizontalScroll
            ? `FAILED: Horizontal scroll at ${viewport.width}px`
            : `✓ No horizontal scroll`,
        });

        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `responsive-${viewport.name}.png`),
          fullPage: true,
        });
      }
    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * TEST: Visual Regression with 2% threshold
   * @param {string} baseTemplate - Base template name
   * @param {string} compareTemplate - Template to compare
   * @param {BrowserContext} context - Playwright context
   * @param {boolean} expectDifferent - true if visual difference is expected (Partner A), false if should be similar (Partner B)
   */
  async testVisualRegression(baseTemplate, compareTemplate, context, expectDifferent) {
    const assertions = [];
    const page = await context.newPage();
    await page.setViewportSize({ width: 800, height: 600 });

    try {
      // Capture base template screenshot
      const baseHtml = await this.loadTemplate(baseTemplate);
      await page.setContent(baseHtml, { waitUntil: 'networkidle' });
      const baseScreenshotPath = path.join(SCREENSHOTS_DIR, `visual-${baseTemplate}.png`);
      await page.screenshot({ path: baseScreenshotPath, fullPage: true });

      // Capture compare template screenshot
      const compareHtml = await this.loadTemplate(compareTemplate);
      await page.setContent(compareHtml, { waitUntil: 'networkidle' });
      const compareScreenshotPath = path.join(SCREENSHOTS_DIR, `visual-${compareTemplate}.png`);
      await page.screenshot({ path: compareScreenshotPath, fullPage: true });

      // Compare screenshots
      const diffResult = await this.compareScreenshots(baseScreenshotPath, compareScreenshotPath, compareTemplate);

      const diffPercentage = diffResult.diffPercentage;
      const threshold = VISUAL_DIFF_THRESHOLD * 100; // Convert to percentage

      // Extract relative paths for the report
      const diffFileName = path.basename(diffResult.diffPath);
      const comparisonFileName = path.basename(diffResult.sideBySidePath);
      const baseFileName = path.basename(baseScreenshotPath);
      const compareFileName = path.basename(compareScreenshotPath);

      if (expectDifferent) {
        // Partner A should have visual differences (colors different)
        const hasDifference = diffPercentage > threshold;
        assertions.push({
          name: `Visual difference detected (>${threshold}% threshold)`,
          passed: hasDifference,
          message: hasDifference
            ? `✓ Visual difference: ${diffPercentage.toFixed(2)}% - colors are different as expected`
            : `FAILED: Visual difference only ${diffPercentage.toFixed(2)}% - Partner A should have DIFFERENT colors!`,
          screenshots: {
            base: baseFileName,
            compare: compareFileName,
            diff: diffFileName,
            comparison: comparisonFileName,
            diffPercentage: diffPercentage.toFixed(2),
          },
        });
      } else {
        // REGRESSION MODE: Template must be visually identical to base
        const isSimilar = diffPercentage <= threshold;
        assertions.push({
          name: `Visual similarity within ${threshold}% threshold`,
          passed: isSimilar,
          message: isSimilar
            ? `✓ Visual difference: ${diffPercentage.toFixed(2)}% - within ${threshold}% threshold`
            : `REGRESSION FAILURE: Visual difference ${diffPercentage.toFixed(2)}% exceeds ${threshold}% threshold - template must match base!`,
          screenshots: {
            base: baseFileName,
            compare: compareFileName,
            diff: diffFileName,
            comparison: comparisonFileName,
            diffPercentage: diffPercentage.toFixed(2),
          },
        });
      }

      // Add screenshot info assertion
      assertions.push({
        name: 'Screenshots captured',
        passed: true,
        message: `View diff: ${diffFileName}`,
        screenshots: {
          base: baseFileName,
          compare: compareFileName,
          diff: diffFileName,
          comparison: comparisonFileName,
        },
      });

    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * Compare two screenshots and return difference percentage
   * Generates a highlighted diff image showing differences in red/pink overlay
   */
  async compareScreenshots(basePath, comparePath, name) {
    const baseImg = PNG.sync.read(fsSync.readFileSync(basePath));
    const compareImg = PNG.sync.read(fsSync.readFileSync(comparePath));

    // Ensure same dimensions (resize if needed)
    const width = Math.max(baseImg.width, compareImg.width);
    const height = Math.max(baseImg.height, compareImg.height);

    // Create diff image with highlighted differences
    const diff = new PNG({ width, height });

    // Pad images to same size if needed
    const baseData = this.padImage(baseImg, width, height);
    const compareData = this.padImage(compareImg, width, height);

    // Use pixelmatch with options for better visualization
    const numDiffPixels = pixelmatch(
      baseData,
      compareData,
      diff.data,
      width,
      height,
      {
        threshold: 0.1,           // Pixel matching sensitivity
        includeAA: true,          // Include anti-aliased pixels
        diffColor: [255, 0, 128], // Bright pink for differences
        diffColorAlt: [255, 255, 0], // Yellow for anti-aliased diffs
        alpha: 0.1                // Background opacity
      }
    );

    const totalPixels = width * height;
    const diffPercentage = (numDiffPixels / totalPixels) * 100;

    // Save diff image
    const diffPath = path.join(DIFF_DIR, `diff-${name}.png`);
    fsSync.writeFileSync(diffPath, PNG.sync.write(diff));

    // Also create a side-by-side comparison image
    const sideBySidePath = await this.createSideBySideComparison(baseImg, compareImg, diff, name, width, height);

    return {
      numDiffPixels,
      totalPixels,
      diffPercentage,
      diffPath,
      sideBySidePath,
      basePath,
      comparePath,
    };
  }

  /**
   * Create a side-by-side comparison image: Base | Compare | Diff
   */
  async createSideBySideComparison(baseImg, compareImg, diffImg, name, width, height) {
    const padding = 10;
    const labelHeight = 30;
    const totalWidth = (width * 3) + (padding * 4);
    const totalHeight = height + labelHeight + (padding * 2);

    const sideBySide = new PNG({ width: totalWidth, height: totalHeight });

    // Fill with white background
    for (let i = 0; i < sideBySide.data.length; i += 4) {
      sideBySide.data[i] = 255;     // R
      sideBySide.data[i + 1] = 255; // G
      sideBySide.data[i + 2] = 255; // B
      sideBySide.data[i + 3] = 255; // A
    }

    // Copy base image
    this.copyImageToCanvas(sideBySide, baseImg, padding, labelHeight + padding, width, height);

    // Copy compare image
    this.copyImageToCanvas(sideBySide, compareImg, width + (padding * 2), labelHeight + padding, width, height);

    // Copy diff image
    this.copyImageToCanvas(sideBySide, diffImg, (width * 2) + (padding * 3), labelHeight + padding, width, height);

    // Save side-by-side image
    const sideBySidePath = path.join(DIFF_DIR, `comparison-${name}.png`);
    fsSync.writeFileSync(sideBySidePath, PNG.sync.write(sideBySide));

    return sideBySidePath;
  }

  /**
   * Copy source image to destination canvas at specified position
   */
  copyImageToCanvas(dest, src, offsetX, offsetY, maxWidth, maxHeight) {
    const srcWidth = Math.min(src.width, maxWidth);
    const srcHeight = Math.min(src.height, maxHeight);

    for (let y = 0; y < srcHeight; y++) {
      for (let x = 0; x < srcWidth; x++) {
        const srcIdx = (y * src.width + x) * 4;
        const destIdx = ((y + offsetY) * dest.width + (x + offsetX)) * 4;

        if (destIdx >= 0 && destIdx < dest.data.length - 3) {
          dest.data[destIdx] = src.data[srcIdx];
          dest.data[destIdx + 1] = src.data[srcIdx + 1];
          dest.data[destIdx + 2] = src.data[srcIdx + 2];
          dest.data[destIdx + 3] = src.data[srcIdx + 3];
        }
      }
    }
  }

  /**
   * Pad image data to specified dimensions
   */
  padImage(img, targetWidth, targetHeight) {
    if (img.width === targetWidth && img.height === targetHeight) {
      return img.data;
    }

    const paddedData = Buffer.alloc(targetWidth * targetHeight * 4, 255); // White background

    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const srcIdx = (y * img.width + x) * 4;
        const dstIdx = (y * targetWidth + x) * 4;
        paddedData[dstIdx] = img.data[srcIdx];
        paddedData[dstIdx + 1] = img.data[srcIdx + 1];
        paddedData[dstIdx + 2] = img.data[srcIdx + 2];
        paddedData[dstIdx + 3] = img.data[srcIdx + 3];
      }
    }

    return paddedData;
  }

  /**
   * TEST: CSS Style Difference
   * @param {string} baseTemplate - Base template name
   * @param {string} compareTemplate - Template to compare
   * @param {BrowserContext} context - Playwright context
   * @param {string} styleType - 'color' or 'layout'
   * @param {boolean} expectDifferent - true if difference is expected, false if should match
   */
  async testCssStyleDifference(baseTemplate, compareTemplate, context, styleType, expectDifferent) {
    const assertions = [];
    const page = await context.newPage();

    try {
      // Extract styles from base template
      const baseHtml = await this.loadTemplate(baseTemplate);
      await page.setContent(baseHtml, { waitUntil: 'networkidle' });
      const baseStyles = await this.extractStyles(page, styleType);

      // Take screenshot of base for CSS comparison
      const baseScreenshotPath = path.join(SCREENSHOTS_DIR, `css-${styleType}-${baseTemplate}.png`);
      await page.screenshot({ path: baseScreenshotPath, fullPage: true });

      // Extract styles from compare template
      const compareHtml = await this.loadTemplate(compareTemplate);
      await page.setContent(compareHtml, { waitUntil: 'networkidle' });
      const compareStyles = await this.extractStyles(page, styleType);

      // Take screenshot of compare template
      const compareScreenshotPath = path.join(SCREENSHOTS_DIR, `css-${styleType}-${compareTemplate}.png`);
      await page.screenshot({ path: compareScreenshotPath, fullPage: true });

      // Compare styles
      const differences = this.compareStyles(baseStyles, compareStyles, styleType);
      const hasDifferences = differences.length > 0;

      // Generate diff image if there are differences
      let diffResult = null;
      if (hasDifferences) {
        diffResult = await this.compareScreenshots(baseScreenshotPath, compareScreenshotPath, `css-${styleType}-${compareTemplate}`);
      }

      // Prepare screenshot info for the report
      const screenshotInfo = diffResult ? {
        base: path.basename(baseScreenshotPath),
        compare: path.basename(compareScreenshotPath),
        diff: path.basename(diffResult.diffPath),
        comparison: path.basename(diffResult.sideBySidePath),
        diffPercentage: diffResult.diffPercentage.toFixed(2),
      } : {
        base: path.basename(baseScreenshotPath),
        compare: path.basename(compareScreenshotPath),
      };

      if (styleType === 'color') {
        if (expectDifferent) {
          // Partner A: colors SHOULD be different
          assertions.push({
            name: `CSS color styles are different`,
            passed: hasDifferences,
            message: hasDifferences
              ? `✓ Found ${differences.length} color difference(s): ${differences.slice(0, 3).map(d => d.property).join(', ')}`
              : `FAILED: No color differences found - Partner A should have DIFFERENT colors!`,
            screenshots: screenshotInfo,
            differences: differences.slice(0, 5), // Include top 5 differences
          });

          // Check for specific color changes
          const hasGreen = differences.some(d =>
            d.compareValue?.includes(COLORS.PARTNER_A_PRIMARY.toLowerCase()) ||
            d.compareValue?.includes('green') ||
            d.compareValue?.includes('#16a34a')
          );
          assertions.push({
            name: `Partner A uses green color scheme`,
            passed: hasGreen,
            message: hasGreen
              ? `✓ Green color (${COLORS.PARTNER_A_PRIMARY}) detected in CSS`
              : `FAILED: Green color not found in Partner A CSS styles`,
            screenshots: screenshotInfo,
          });
        } else {
          // Partner B: colors SHOULD match base
          assertions.push({
            name: `CSS color styles match base`,
            passed: !hasDifferences,
            message: !hasDifferences
              ? `✓ Color styles match base template`
              : `FAILED: Found ${differences.length} color difference(s) - Partner B should have SAME colors! Differences: ${differences.slice(0, 3).map(d => `${d.property}: base=${d.baseValue}, compare=${d.compareValue}`).join('; ')}`,
            screenshots: screenshotInfo,
            differences: hasDifferences ? differences.slice(0, 5) : [],
          });
        }
      } else if (styleType === 'layout') {
        // Layout should always match for both partners
        assertions.push({
          name: `CSS layout styles match base`,
          passed: !hasDifferences,
          message: !hasDifferences
            ? `✓ Layout styles match base template`
            : `FAILED: Found ${differences.length} layout difference(s): ${differences.slice(0, 3).map(d => `${d.property}`).join(', ')}`,
          screenshots: screenshotInfo,
          differences: hasDifferences ? differences.slice(0, 5) : [],
        });
      }

    } finally {
      await page.close();
    }

    return assertions;
  }

  /**
   * Extract CSS styles from page
   */
  async extractStyles(page, styleType) {
    return await page.evaluate((type) => {
      const styles = {};
      const elements = document.querySelectorAll('*');

      const colorProperties = [
        'color', 'backgroundColor', 'borderColor', 'borderTopColor',
        'borderBottomColor', 'borderLeftColor', 'borderRightColor',
        'outlineColor', 'textDecorationColor'
      ];

      const layoutProperties = [
        'display', 'position', 'width', 'height', 'padding', 'margin',
        'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
        'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
        'flexDirection', 'justifyContent', 'alignItems', 'textAlign'
      ];

      const properties = type === 'color' ? colorProperties : layoutProperties;

      elements.forEach((el, index) => {
        const computed = window.getComputedStyle(el);
        const tagKey = `${el.tagName.toLowerCase()}_${index}`;

        properties.forEach(prop => {
          const value = computed[prop];
          if (value && value !== 'none' && value !== 'auto' && value !== 'normal') {
            const key = `${tagKey}_${prop}`;
            styles[key] = value.toLowerCase();
          }
        });
      });

      return styles;
    }, styleType);
  }

  /**
   * Compare two style objects
   */
  compareStyles(baseStyles, compareStyles, styleType) {
    const differences = [];

    // Get all unique keys
    const allKeys = new Set([...Object.keys(baseStyles), ...Object.keys(compareStyles)]);

    for (const key of allKeys) {
      const baseValue = baseStyles[key];
      const compareValue = compareStyles[key];

      if (baseValue !== compareValue) {
        // For color comparison, normalize values
        if (styleType === 'color') {
          const baseNorm = this.normalizeColor(baseValue);
          const compareNorm = this.normalizeColor(compareValue);

          if (baseNorm !== compareNorm) {
            differences.push({
              property: key,
              baseValue: baseValue || 'none',
              compareValue: compareValue || 'none',
            });
          }
        } else {
          differences.push({
            property: key,
            baseValue: baseValue || 'none',
            compareValue: compareValue || 'none',
          });
        }
      }
    }

    return differences;
  }

  /**
   * Normalize color value for comparison
   */
  normalizeColor(color) {
    if (!color) return 'none';

    // Convert rgb/rgba to lowercase and trim
    color = color.toLowerCase().trim();

    // Normalize rgba with 0 alpha to transparent
    if (color.includes('rgba') && color.includes(', 0)')) {
      return 'transparent';
    }

    return color;
  }

  async run() {
    try {
      await this.initialize();

      // Load test plan for ID
      let testPlan;
      try {
        testPlan = await this.loadTestPlan();
        this.results.testPlanId = testPlan.testPlanId;
      } catch {
        this.results.testPlanId = 'STRICT-VALIDATION';
      }

      this.log(`\n${'═'.repeat(60)}`);
      this.log(`Playwright Test Runner - ${this.isStrictMode ? 'STRICT' : 'WEAK'} VALIDATION MODE`);
      if (this.isStrictMode) {
        this.log('Tests WILL FAIL if requirements are not met!');
      } else {
        this.log('Tests will PASS with warnings if differences are found.');
      }
      this.log(`${'═'.repeat(60)}`);

      // Log which templates are being tested
      if (this.testAllTemplates) {
        this.log(`\nTesting ALL templates: ${this.templatesToTest.join(', ')}`);
      } else {
        this.log(`\nTesting SELECTED templates only: ${this.templatesToTest.join(', ')}`);
        this.log(`(Comparison tests require both templates to be selected)`);
      }

      this.log(`\nRequirements:`);
      this.log(`  Partner A: SAME content, DIFFERENT colors (green ${COLORS.PARTNER_A_PRIMARY})`);
      this.log(`  Partner B: DIFFERENT content, SAME colors (blue ${COLORS.BASE_PRIMARY})`);

      const context = await this.browser.newContext();

      // Run validation tests (strict or weak mode)
      await this.runValidationTests(context);

      await context.close();

      // Summary
      this.log(`\n${'═'.repeat(60)}`);
      this.log(`Test Results Summary (${this.isStrictMode ? 'STRICT' : 'WEAK'} MODE)`);
      this.log(`${'═'.repeat(60)}`);
      this.log(`Total Tests: ${this.results.totalTests}`);
      this.log(`Passed: ${this.results.passed} ✅`);
      this.log(`Failed: ${this.results.failed} ❌`);
      if (this.results.warnings > 0) {
        this.log(`Warnings: ${this.results.warnings} ⚠️`);
      }
      this.log(`Pass Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);

      if (this.results.failed > 0) {
        this.log(`\n⚠️  VALIDATION FAILED: ${this.results.failed} test(s) did not meet requirements!`);
        this.log(`\nFailed tests:`);
        for (const tc of this.results.testCases.filter(t => t.status === 'failed')) {
          this.log(`  ❌ [${tc.id}] ${tc.name}`);
          for (const a of tc.assertions.filter(a => !a.passed && !a.isWarning)) {
            this.log(`      → ${a.message}`);
          }
        }
      } else if (this.results.warnings > 0) {
        this.log(`\n⚠️  ALL TESTS PASSED WITH ${this.results.warnings} WARNING(S)`);
        this.log(`\nTests with warnings (differences found but allowed in weak mode):`);
        for (const tc of this.results.testCases.filter(t => t.hasWarnings)) {
          this.log(`  ⚠️  [${tc.id}] ${tc.name}`);
          for (const a of tc.assertions.filter(a => a.isWarning)) {
            this.log(`      → [DIFFERENCE] ${a.message}`);
          }
        }
      } else {
        this.log(`\n✅ ALL TESTS PASSED - Templates meet all requirements!`);
      }

      // Save results
      const resultsPath = path.join(RESULTS_DIR, `playwright-results-${Date.now()}.json`);
      await fs.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
      this.log(`\nResults saved to: ${resultsPath}`);

      return this.results;
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
const runner = new PlaywrightTestRunner();
runner.run()
  .then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

export { PlaywrightTestRunner };
