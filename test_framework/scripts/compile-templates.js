#!/usr/bin/env node

/**
 * MJML to HTML Compilation Script
 *
 * Compiles all MJML templates to HTML.
 * First processes EJS includes, then compiles MJML.
 * Designed for autonomous execution.
 *
 * Supports filtering templates via TEST_TEMPLATES environment variable.
 * If TEST_TEMPLATES is set, only those templates are compiled.
 * If not set, all .mjml files in the emails directory are compiled.
 *
 * Output: JSON with compilation results for each template
 */

import fs from 'fs/promises';
import mjml2html from 'mjml';
import ejs from 'ejs';
import {
  PATHS,
} from '../config/constants.js';

/**
 * Discover all MJML template files in the emails directory
 */
async function discoverTemplates() {
  try {
    const files = await fs.readdir(PATHS.EMAILS_DIR);
    return files.filter(f => f.endsWith('.mjml'));
  } catch (error) {
    console.error('Error reading templates directory:', error.message);
    return [];
  }
}

/**
 * Get templates to compile based on environment variable or discover all
 */
async function getTemplatesToCompile() {
  const testTemplatesEnv = process.env.TEST_TEMPLATES || '';

  if (testTemplatesEnv) {
    // Filter to only selected templates
    const selected = testTemplatesEnv.split(',').map(t => {
      const trimmed = t.trim();
      return trimmed.endsWith('.mjml') ? trimmed : `${trimmed}.mjml`;
    });
    console.log(`Compiling selected templates: ${selected.join(', ')}`);
    return selected;
  } else {
    // Discover all templates dynamically
    const allTemplates = await discoverTemplates();
    console.log(`Discovered ${allTemplates.length} templates in emails directory`);
    return allTemplates;
  }
}

/**
 * Load test data for EJS variable substitution
 */
async function loadTestData() {
  try {
    const content = await fs.readFile(PATHS.SAMPLE_CONTEXT, 'utf-8');
    const data = JSON.parse(content);
    const ctx = data.context || {};

    // Pre-compute template variables so they're directly available
    // This works around EJS include scope limitations
    return {
      context: ctx,
      // Company Information
      company: {
        name: ctx.companyName || 'Carebox',
        address: ctx.companyAddress || '123 Main Street, San Francisco, CA 94102',
        logoUrl: ctx.logoUrl || '/templates/shared/carebox_logo.png',
        supportEmail: ctx.supportEmail || 'support@example.com'
      },
      // Visitor Information
      visitor: {
        name: ctx.visitorName || 'Valued Visitor'
      },
      // URLs
      urls: {
        cta: ctx.ctaUrl || 'https://example.com/get-started',
        privacy: ctx.privacyUrl || 'https://example.com/privacy',
        terms: ctx.termsUrl || 'https://example.com/terms',
        unsubscribe: ctx.unsubscribeUrl || 'https://example.com/unsubscribe'
      },
      // Dynamic Values
      currentYear: ctx.currentYear || new Date().getFullYear()
    };
  } catch (error) {
    console.warn('Warning: Could not load test data, using empty context');
    return {
      context: {},
      company: { name: 'Carebox', address: '', logoUrl: '', supportEmail: '' },
      visitor: { name: 'Valued Visitor' },
      urls: { cta: '', privacy: '', terms: '', unsubscribe: '' },
      currentYear: new Date().getFullYear()
    };
  }
}

/**
 * Compile a single template
 */
async function compileTemplate(fileName, testData) {
  const templatePath = `${PATHS.EMAILS_DIR}/${fileName}`;
  const baseName = fileName.replace('.mjml', '');
  const outputPath = `${PATHS.OUTPUT_COMPILED}/${baseName}.html`;
  const mjmlOutputPath = `${PATHS.OUTPUT_COMPILED}/${baseName}-processed.mjml`;

  const result = {
    template: baseName,
    file: fileName,
    success: false,
    errors: [],
    warnings: [],
    outputPath: null,
    compiledAt: new Date().toISOString(),
  };

  try {
    let mjmlContent = await fs.readFile(templatePath, 'utf-8');

    // Step 1: Process EJS includes and variables
    const ejsOptions = {
      filename: templatePath,
      root: PATHS.EMAIL_TEMPLATES,
    };

    let processedMjml;
    try {
      processedMjml = ejs.render(mjmlContent, testData, ejsOptions);
    } catch (ejsError) {
      result.errors.push({
        phase: 'ejs',
        message: `EJS processing error: ${ejsError.message}`,
        line: ejsError.line || null,
      });
      return result;
    }

    // Save processed MJML for debugging
    await fs.writeFile(mjmlOutputPath, processedMjml, 'utf-8');

    // Step 2: Compile MJML to HTML
    const compilationResult = mjml2html(processedMjml, {
      validationLevel: 'soft',
      filePath: templatePath,
    });

    if (compilationResult.errors?.length > 0) {
      result.errors = compilationResult.errors.map(e => ({
        phase: 'mjml',
        line: e.line,
        message: e.message,
        tagName: e.tagName,
      }));
    }

    // Write HTML output
    await fs.writeFile(outputPath, compilationResult.html, 'utf-8');

    result.success = result.errors.length === 0;
    result.outputPath = outputPath;
    result.htmlLength = compilationResult.html.length;
  } catch (error) {
    result.errors.push({
      phase: 'general',
      message: error.message,
      stack: error.stack,
    });
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  console.log('Starting MJML template compilation...\n');

  // Load test data for EJS variable substitution
  const testData = await loadTestData();
  console.log('Test data loaded for EJS processing\n');

  // Get templates to compile (dynamic discovery or from TEST_TEMPLATES env var)
  const templateFiles = await getTemplatesToCompile();

  if (templateFiles.length === 0) {
    console.log('No templates found to compile.');
    return { timestamp: new Date().toISOString(), totalTemplates: 0, successful: 0, failed: 0, templates: [] };
  }

  // Ensure output directory exists
  await fs.mkdir(PATHS.OUTPUT_COMPILED, { recursive: true });

  const results = {
    timestamp: new Date().toISOString(),
    totalTemplates: templateFiles.length,
    successful: 0,
    failed: 0,
    templates: [],
  };

  for (const file of templateFiles) {
    const result = await compileTemplate(file, testData);
    results.templates.push(result);

    if (result.success) {
      results.successful++;
      console.log(`✓ ${file}: Compiled successfully`);
    } else {
      results.failed++;
      console.log(`✗ ${file}: Compilation failed`);
      result.errors.forEach(e => console.log(`  - [${e.phase}] ${e.message}`));
    }
  }

  console.log('\n--- Compilation Summary ---');
  console.log(`Total: ${results.totalTemplates}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);

  // Output JSON for programmatic consumption
  const jsonOutput = JSON.stringify(results, null, 2);
  const jsonPath = `${PATHS.OUTPUT_COMPILED}/compilation-results.json`;
  await fs.writeFile(jsonPath, jsonOutput, 'utf-8');

  console.log(`\nResults saved to: ${jsonPath}`);

  return results;
}

main().catch(console.error);
