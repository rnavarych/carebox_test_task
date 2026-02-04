#!/usr/bin/env node

/**
 * EJS Template Rendering Script
 *
 * This script renders compiled HTML templates with test data.
 * Designed for autonomous execution by Claude Code.
 *
 * Output: JSON with rendering results and rendered HTML files
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPILED_DIR = path.join(__dirname, '../output/compiled');
const TEST_DATA_PATH = path.join(__dirname, '../test-data/sample-context.json');

const TEMPLATE_FILES = [
  'site_visitor_welcome',
  'site_visitor_welcome_partner_a',
  'site_visitor_welcome_partner_b'
];

async function renderTemplate(folderName, testData) {
  const compiledPath = path.join(COMPILED_DIR, `${folderName}.html`);
  const renderedPath = path.join(COMPILED_DIR, `${folderName}-rendered.html`);

  const result = {
    template: folderName,
    success: false,
    errors: [],
    missingVariables: [],
    outputPath: null,
    renderedAt: new Date().toISOString()
  };

  try {
    const htmlContent = await fs.readFile(compiledPath, 'utf-8');

    // Find all EJS variables used in template
    const ejsVarPattern = /<%[=\-_]?\s*([^%]+?)\s*%>/g;
    const usedVariables = new Set();
    let match;
    while ((match = ejsVarPattern.exec(htmlContent)) !== null) {
      const varPath = match[1].trim();
      if (!varPath.startsWith('/*') && !varPath.startsWith('//')) {
        usedVariables.add(varPath);
      }
    }

    // Check for missing variables
    for (const varPath of usedVariables) {
      const parts = varPath.split('.');
      let current = testData;
      let missing = false;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = current[part];
        } else {
          missing = true;
          break;
        }
      }
      if (missing) {
        result.missingVariables.push(varPath);
      }
    }

    // Render template with EJS
    const renderedHtml = ejs.render(htmlContent, testData);

    // Write rendered output to test framework output folder only
    await fs.writeFile(renderedPath, renderedHtml, 'utf-8');

    result.success = result.errors.length === 0 && result.missingVariables.length === 0;
    result.outputPath = renderedPath;
    result.htmlLength = renderedHtml.length;
    result.variablesUsed = Array.from(usedVariables);

  } catch (error) {
    result.errors.push({
      message: error.message,
      stack: error.stack
    });
  }

  return result;
}

async function main() {
  console.log('Starting EJS template rendering...\n');

  // Load test data
  let testData;
  try {
    const testDataContent = await fs.readFile(TEST_DATA_PATH, 'utf-8');
    testData = JSON.parse(testDataContent);
    console.log('Test data loaded successfully');
    console.log(`Variables available: ${Object.keys(testData.context || testData).join(', ')}\n`);
  } catch (error) {
    console.error('Failed to load test data:', error.message);
    process.exit(1);
  }

  const results = {
    timestamp: new Date().toISOString(),
    totalTemplates: TEMPLATE_FILES.length,
    successful: 0,
    failed: 0,
    templates: []
  };

  for (const template of TEMPLATE_FILES) {
    const result = await renderTemplate(template, testData);
    results.templates.push(result);

    if (result.success) {
      results.successful++;
      console.log(`✓ ${template}: Rendered successfully`);
    } else {
      results.failed++;
      console.log(`✗ ${template}: Rendering failed`);
      result.errors.forEach(e => console.log(`  Error: ${e.message}`));
      result.missingVariables.forEach(v => console.log(`  Missing variable: ${v}`));
    }
  }

  console.log('\n--- Rendering Summary ---');
  console.log(`Total: ${results.totalTemplates}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);

  // Output JSON for programmatic consumption
  const jsonOutput = JSON.stringify(results, null, 2);
  const jsonPath = path.join(COMPILED_DIR, 'rendering-results.json');
  await fs.writeFile(jsonPath, jsonOutput, 'utf-8');

  console.log(`\nResults saved to: ${jsonPath}`);

  return results;
}

main().catch(console.error);
