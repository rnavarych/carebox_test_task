#!/usr/bin/env node

/**
 * Screenshot Capture Script using Playwright
 *
 * This script captures screenshots of rendered email templates.
 * Designed for autonomous execution by Claude Code.
 *
 * Output: PNG screenshots and JSON metadata
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPILED_DIR = path.join(__dirname, '../output/compiled');
const SCREENSHOTS_DIR = path.join(__dirname, '../output/screenshots');

const TEMPLATE_FOLDERS = [
  'site_visitor_welcome',
  'site_visitor_welcome_partner_a',
  'site_visitor_welcome_partner_b'
];

const VIEWPORTS = [
  { name: 'desktop', width: 1200, height: 800 },
  { name: 'mobile', width: 375, height: 667 }
];

async function captureScreenshot(browser, folderName, viewport) {
  const renderedPath = path.join(COMPILED_DIR, `${folderName}-rendered.html`);
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${folderName}-${viewport.name}.png`);

  const result = {
    template: folderName,
    viewport: viewport.name,
    success: false,
    screenshotPath: null,
    dimensions: viewport,
    capturedAt: new Date().toISOString()
  };

  try {
    const htmlContent = await fs.readFile(renderedPath, 'utf-8');

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height }
    });

    const page = await context.newPage();

    // Load the HTML content
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });

    // Wait a bit for any images to load
    await page.waitForTimeout(1000);

    // Capture full page screenshot
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    result.success = true;
    result.screenshotPath = screenshotPath;

    // Get page dimensions
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight
    }));
    result.actualDimensions = dimensions;

    await context.close();

  } catch (error) {
    result.error = error.message;
  }

  return result;
}

async function main() {
  console.log('Starting screenshot capture with Playwright...\n');

  // Ensure screenshots directory exists
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const results = {
    timestamp: new Date().toISOString(),
    totalScreenshots: TEMPLATE_FOLDERS.length * VIEWPORTS.length,
    successful: 0,
    failed: 0,
    screenshots: []
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    for (const folder of TEMPLATE_FOLDERS) {
      console.log(`Capturing: ${folder}`);

      for (const viewport of VIEWPORTS) {
        const result = await captureScreenshot(browser, folder, viewport);
        results.screenshots.push(result);

        if (result.success) {
          results.successful++;
          console.log(`  ✓ ${viewport.name} (${viewport.width}x${viewport.height})`);
        } else {
          results.failed++;
          console.log(`  ✗ ${viewport.name}: ${result.error}`);
        }
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log('\n--- Screenshot Summary ---');
  console.log(`Total: ${results.totalScreenshots}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);

  // Output JSON for programmatic consumption
  const jsonOutput = JSON.stringify(results, null, 2);
  const jsonPath = path.join(SCREENSHOTS_DIR, 'screenshot-results.json');
  await fs.writeFile(jsonPath, jsonOutput, 'utf-8');

  console.log(`\nResults saved to: ${jsonPath}`);
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);

  return results;
}

main().catch(console.error);
