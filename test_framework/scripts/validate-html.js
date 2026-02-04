#!/usr/bin/env node

/**
 * HTML Validation Script
 *
 * This script validates the rendered HTML files.
 * Designed for autonomous execution by Claude Code.
 *
 * Output: JSON with validation results for each template
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { HtmlValidate } from 'html-validate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPILED_DIR = path.join(__dirname, '../output/compiled');

const TEMPLATE_FOLDERS = [
  'site_visitor_welcome',
  'site_visitor_welcome_partner_a',
  'site_visitor_welcome_partner_b'
];

// Configure HTML validator with relaxed rules for email HTML
// Email HTML legitimately uses many deprecated features for maximum email client compatibility
const htmlValidate = new HtmlValidate({
  extends: ['html-validate:recommended'],
  rules: {
    // Email HTML uses inline styles extensively (required for email clients)
    'no-inline-style': 'off',
    // Email HTML often uses deprecated attributes for compatibility
    'no-deprecated-attr': 'off',
    // DOCTYPE might differ in email HTML
    'doctype-style': 'off',
    // Allow various elements for email compatibility
    'element-permitted-content': 'off',
    'element-permitted-parent': 'off',
    // Email HTML uses tables for layout (standard practice)
    'prefer-tbody': 'off',
    // Email HTML might not have lang attribute
    'require-sri': 'off',
    // Allow empty title in email
    'empty-title': 'off',
    // Allow missing alt text warning
    'wcag/h37': 'warn',
    // Conditional comments are used for Outlook compatibility
    'no-conditional-comment': 'off',
    // Allow deprecated elements used in email
    'deprecated': 'off',
    // Relaxed attribute rules for email
    'attribute-allowed-values': 'off',
    // Allow style element
    'element-required-content': 'off',
    // MJML output has specific structure
    'attr-case': 'off',
    'no-dup-attr': 'error',
    'no-dup-id': 'error',
    // Whitespace issues are not relevant for email
    'no-trailing-whitespace': 'off',
    'tel-non-breaking': 'off',
    'text-content': 'off',
    // Semantic HTML rules don't apply to email
    'prefer-native-element': 'off',
    // Self-closing tags are valid in XHTML-style output
    'void-style': 'off'
  }
});

async function validateTemplate(folderName) {
  const renderedPath = path.join(COMPILED_DIR, `${folderName}-rendered.html`);

  const result = {
    template: folderName,
    valid: false,
    errors: [],
    warnings: [],
    validatedAt: new Date().toISOString()
  };

  try {
    const htmlContent = await fs.readFile(renderedPath, 'utf-8');

    const validationReport = await htmlValidate.validateString(htmlContent);

    for (const message of validationReport.results[0]?.messages || []) {
      const issue = {
        line: message.line,
        column: message.column,
        message: message.message,
        ruleId: message.ruleId,
        selector: message.selector
      };

      if (message.severity === 2) {
        result.errors.push(issue);
      } else {
        result.warnings.push(issue);
      }
    }

    result.valid = result.errors.length === 0;
    result.htmlSize = htmlContent.length;

    // Additional structural checks
    result.structuralChecks = {
      hasDoctype: htmlContent.toLowerCase().includes('<!doctype'),
      hasHtmlTag: /<html[^>]*>/i.test(htmlContent),
      hasHead: /<head[^>]*>/i.test(htmlContent),
      hasBody: /<body[^>]*>/i.test(htmlContent),
      hasTitle: /<title[^>]*>/i.test(htmlContent),
      hasMeta: /<meta[^>]*>/i.test(htmlContent),
      hasLinks: /<a\s+[^>]*href/i.test(htmlContent),
      hasImages: /<img[^>]*>/i.test(htmlContent)
    };

  } catch (error) {
    result.errors.push({
      message: error.message,
      stack: error.stack
    });
  }

  return result;
}

async function main() {
  console.log('Starting HTML validation...\n');

  const results = {
    timestamp: new Date().toISOString(),
    totalTemplates: TEMPLATE_FOLDERS.length,
    valid: 0,
    invalid: 0,
    templates: []
  };

  for (const folder of TEMPLATE_FOLDERS) {
    const result = await validateTemplate(folder);
    results.templates.push(result);

    if (result.valid) {
      results.valid++;
      console.log(`✓ ${folder}: Valid HTML`);
      if (result.warnings.length > 0) {
        console.log(`  Warnings: ${result.warnings.length}`);
      }
    } else {
      results.invalid++;
      console.log(`✗ ${folder}: Invalid HTML`);
      console.log(`  Errors: ${result.errors.length}`);
      result.errors.slice(0, 3).forEach(e =>
        console.log(`  - Line ${e.line}: ${e.message}`)
      );
    }

    // Show structural checks
    const checks = result.structuralChecks || {};
    const failedChecks = Object.entries(checks)
      .filter(([_, passed]) => !passed)
      .map(([name]) => name);

    if (failedChecks.length > 0) {
      console.log(`  Missing: ${failedChecks.join(', ')}`);
    }
  }

  console.log('\n--- Validation Summary ---');
  console.log(`Total: ${results.totalTemplates}`);
  console.log(`Valid: ${results.valid}`);
  console.log(`Invalid: ${results.invalid}`);

  // Output JSON for programmatic consumption
  const jsonOutput = JSON.stringify(results, null, 2);
  const jsonPath = path.join(COMPILED_DIR, 'validation-results.json');
  await fs.writeFile(jsonPath, jsonOutput, 'utf-8');

  console.log(`\nResults saved to: ${jsonPath}`);

  return results;
}

main().catch(console.error);
