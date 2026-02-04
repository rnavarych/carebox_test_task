#!/usr/bin/env node

/**
 * Template Comparison Script
 *
 * Compares templates to identify differences.
 * Validates expected variations between base and partner templates.
 *
 * Output: JSON with detailed comparison results
 */

import fs from 'fs/promises';
import { diffWords } from 'diff';
import {
  PATHS,
  TEMPLATE_COMPARISONS,
  ANALYSIS,
} from '../config/constants.js';

/**
 * Extract colors from HTML/CSS
 */
function extractColors(html) {
  const colorPatterns = [
    /#[0-9a-fA-F]{6}\b/g,
    /#[0-9a-fA-F]{3}\b/g,
    /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi,
    /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)/gi,
  ];

  const colors = new Set();
  for (const pattern of colorPatterns) {
    const matches = html.match(pattern) || [];
    matches.forEach(c => colors.add(c.toLowerCase()));
  }
  return Array.from(colors);
}

/**
 * Extract text content from HTML
 */
function extractTextContent(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract structural elements from HTML
 */
function extractStructure(html) {
  return {
    totalSections: (html.match(/<(?:mj-section|section)/gi) || []).length,
    totalButtons: (html.match(/<(?:mj-button|button|a[^>]*class[^>]*button)/gi) || []).length,
    totalImages: (html.match(/<(?:mj-image|img)/gi) || []).length,
    totalLinks: (html.match(/<a\s/gi) || []).length,
    totalTables: (html.match(/<table/gi) || []).length,
  };
}

/**
 * Compare two templates
 */
async function compareTemplates(comparison) {
  const basePath = `${PATHS.OUTPUT_COMPILED}/${comparison.base}-rendered.html`;
  const comparePath = `${PATHS.OUTPUT_COMPILED}/${comparison.compare}-rendered.html`;

  const result = {
    id: comparison.id,
    name: comparison.name,
    description: comparison.description,
    expectedDifference: comparison.expectedDifference,
    baseTemplate: comparison.base,
    compareTemplate: comparison.compare,
    success: false,
    differences: {
      colors: { added: [], removed: [], same: [] },
      content: { changes: [], summary: '', totalChanges: 0 },
      structure: { base: null, compare: null, differences: [] },
    },
    analysis: '',
    assessment: ANALYSIS.ASSESSMENT.FAIL,
    comparedAt: new Date().toISOString(),
  };

  try {
    const [baseHtml, compareHtml] = await Promise.all([
      fs.readFile(basePath, 'utf-8'),
      fs.readFile(comparePath, 'utf-8'),
    ]);

    // Compare colors
    const baseColors = extractColors(baseHtml);
    const compareColors = extractColors(compareHtml);

    result.differences.colors.added = compareColors.filter(c => !baseColors.includes(c));
    result.differences.colors.removed = baseColors.filter(c => !compareColors.includes(c));
    result.differences.colors.same = baseColors.filter(c => compareColors.includes(c));

    // Compare text content
    const baseText = extractTextContent(baseHtml);
    const compareText = extractTextContent(compareHtml);

    const textDiff = diffWords(baseText, compareText);
    const contentChanges = [];

    for (const part of textDiff) {
      if (part.added) {
        contentChanges.push({ type: 'added', value: part.value.trim().substring(0, 100) });
      } else if (part.removed) {
        contentChanges.push({ type: 'removed', value: part.value.trim().substring(0, 100) });
      }
    }

    result.differences.content.changes = contentChanges.filter(c => c.value.length > 2).slice(0, 20);
    result.differences.content.totalChanges = contentChanges.length;

    // Compare structure
    const baseStructure = extractStructure(baseHtml);
    const compareStructure = extractStructure(compareHtml);

    result.differences.structure.base = baseStructure;
    result.differences.structure.compare = compareStructure;

    const structureDiffs = [];
    for (const [key, baseValue] of Object.entries(baseStructure)) {
      const compareValue = compareStructure[key];
      if (baseValue !== compareValue) {
        structureDiffs.push({
          element: key,
          base: baseValue,
          compare: compareValue,
          difference: compareValue - baseValue,
        });
      }
    }
    result.differences.structure.differences = structureDiffs;

    // Generate analysis based on expected difference type
    const colorDifferent =
      result.differences.colors.added.length > 0 || result.differences.colors.removed.length > 0;
    const contentDifferent = result.differences.content.changes.length > 0;
    const structureDifferent = structureDiffs.length > 0;

    if (comparison.expectedDifference === ANALYSIS.DIFFERENCE_TYPES.STYLING) {
      if (colorDifferent && !contentDifferent) {
        result.analysis = 'PASS: Template has different colors but same content as expected.';
        result.success = true;
        result.assessment = ANALYSIS.ASSESSMENT.PASS;
      } else if (colorDifferent && contentDifferent) {
        result.analysis =
          'WARNING: Template has different colors AND different content. Expected only styling changes.';
        result.success = true;
        result.assessment = ANALYSIS.ASSESSMENT.WARNING;
      } else if (!colorDifferent) {
        result.analysis = 'FAIL: Template should have different colors but colors appear identical.';
        result.success = false;
        result.assessment = ANALYSIS.ASSESSMENT.FAIL;
      }
    } else if (comparison.expectedDifference === ANALYSIS.DIFFERENCE_TYPES.CONTENT) {
      if (contentDifferent && !colorDifferent) {
        result.analysis = 'PASS: Template has different content but same colors as expected.';
        result.success = true;
        result.assessment = ANALYSIS.ASSESSMENT.PASS;
      } else if (contentDifferent && colorDifferent) {
        result.analysis =
          'WARNING: Template has different content AND different colors. Expected only content changes.';
        result.success = true;
        result.assessment = ANALYSIS.ASSESSMENT.WARNING;
      } else if (!contentDifferent) {
        result.analysis = 'FAIL: Template should have different content but content appears identical.';
        result.success = false;
        result.assessment = ANALYSIS.ASSESSMENT.FAIL;
      }
    }

    // Add structure analysis
    if (structureDifferent && comparison.expectedDifference === ANALYSIS.DIFFERENCE_TYPES.STYLING) {
      result.analysis += ' Note: Structure also differs which may be unintended.';
    }
  } catch (error) {
    result.analysis = `ERROR: ${error.message}`;
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  console.log('Starting template comparison...\n');

  const results = {
    timestamp: new Date().toISOString(),
    totalComparisons: TEMPLATE_COMPARISONS.length,
    passed: 0,
    failed: 0,
    warnings: 0,
    comparisons: [],
  };

  for (const comparison of TEMPLATE_COMPARISONS) {
    console.log(`Comparing: ${comparison.name}`);
    console.log(`  Expected difference: ${comparison.expectedDifference}`);

    const result = await compareTemplates(comparison);
    results.comparisons.push(result);

    if (result.assessment === ANALYSIS.ASSESSMENT.PASS) {
      results.passed++;
      console.log(`  Result: ${result.analysis}`);
    } else if (result.assessment === ANALYSIS.ASSESSMENT.WARNING) {
      results.warnings++;
      console.log(`  Result: ${result.analysis}`);
    } else {
      results.failed++;
      console.log(`  Result: ${result.analysis}`);
    }

    // Show key differences
    if (result.differences.colors.added.length > 0) {
      console.log(`  New colors: ${result.differences.colors.added.slice(0, 5).join(', ')}`);
    }
    if (result.differences.content.changes.length > 0) {
      console.log(`  Content changes: ${result.differences.content.totalChanges}`);
    }
    if (result.differences.structure.differences.length > 0) {
      result.differences.structure.differences.forEach(d =>
        console.log(`  Structure: ${d.element}: ${d.base} → ${d.compare}`)
      );
    }
    console.log('');
  }

  console.log('--- Comparison Summary ---');
  console.log(`Total: ${results.totalComparisons}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Warnings: ${results.warnings}`);
  console.log(`Failed: ${results.failed}`);

  // Output JSON for programmatic consumption
  const jsonOutput = JSON.stringify(results, null, 2);
  const jsonPath = `${PATHS.OUTPUT_COMPILED}/comparison-results.json`;
  await fs.writeFile(jsonPath, jsonOutput, 'utf-8');

  console.log(`\nResults saved to: ${jsonPath}`);

  return results;
}

main().catch(console.error);
