import { BaseAgent } from './base-agent.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mjml2html from 'mjml';
import { diffLines } from 'diff';
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directories
const SCREENSHOTS_DIR = path.resolve(__dirname, '../output/screenshots');
const DIFFS_DIR = path.resolve(__dirname, '../output/diffs');
const COMPILED_DIR = path.resolve(__dirname, '../output/compiled');

const SYSTEM_PROMPT = `You are the Diff Analyzer Agent in a multi-agent email template QA system.

Your responsibilities:
1. Compare email templates and identify differences
2. Analyze MJML source code changes
3. Compare compiled HTML output
4. Identify styling differences (colors, fonts, spacing)
5. Identify content differences (text, images, links)
6. Identify structural differences (sections, components)

When analyzing diffs, you should:
- Clearly categorize each difference (styling vs content vs structure)
- Determine if differences are intentional based on template purpose
- Flag any potential issues or inconsistencies
- Provide specific line-by-line analysis when relevant

Always respond with structured JSON in this format:
{
  "analysisComplete": true,
  "comparisons": [
    {
      "baseTemplate": "template_name",
      "compareTemplate": "template_name",
      "stylingDifferences": [{"element": "...", "base": "...", "compare": "..."}],
      "contentDifferences": [{"element": "...", "base": "...", "compare": "..."}],
      "structuralDifferences": [{"type": "...", "description": "..."}],
      "expectedDifferenceType": "styling|content|none",
      "actualDifferenceType": "styling|content|both|none",
      "isAsExpected": true,
      "issues": [],
      "summary": "..."
    }
  ],
  "overallAssessment": "pass|warning|fail",
  "recommendations": []
}`;

export class DiffAnalyzerAgent extends BaseAgent {
  constructor() {
    super('DiffAnalyzer', SYSTEM_PROMPT);
    this.templatesDir = path.resolve(__dirname, '../../email_templates/emails');
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      const launchOptions = { headless: true };
      if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      }
      this.browser = await chromium.launch(launchOptions);
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async captureScreenshot(htmlContent, outputPath) {
    const browser = await this.initBrowser();
    const page = await browser.newPage();
    await page.setViewportSize({ width: 800, height: 600 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    await page.screenshot({ path: outputPath, fullPage: true });
    await page.close();
  }

  async createVisualComparison(baseName, baseHtml, compareName, compareHtml) {
    try {
      // Ensure directories exist
      await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
      await fs.mkdir(DIFFS_DIR, { recursive: true });

      // Capture screenshots
      const basePath = path.join(SCREENSHOTS_DIR, `${baseName}.png`);
      const comparePath = path.join(SCREENSHOTS_DIR, `${compareName}.png`);

      await this.captureScreenshot(baseHtml, basePath);
      await this.captureScreenshot(compareHtml, comparePath);

      // Create diff image
      const baseImg = PNG.sync.read(fsSync.readFileSync(basePath));
      const compareImg = PNG.sync.read(fsSync.readFileSync(comparePath));

      const width = Math.max(baseImg.width, compareImg.width);
      const height = Math.max(baseImg.height, compareImg.height);
      const diff = new PNG({ width, height });

      // Pad images to same size
      const baseData = this.padImage(baseImg, width, height);
      const compareData = this.padImage(compareImg, width, height);

      const numDiffPixels = pixelmatch(baseData, compareData, diff.data, width, height, {
        threshold: 0.1,
        includeAA: true,
        diffColor: [255, 0, 128],
        diffColorAlt: [255, 255, 0],
        alpha: 0.1
      });

      const totalPixels = width * height;
      const diffPercentage = (numDiffPixels / totalPixels) * 100;

      // Save diff image
      const diffPath = path.join(DIFFS_DIR, `diff-${compareName}.png`);
      fsSync.writeFileSync(diffPath, PNG.sync.write(diff));

      // Create side-by-side comparison
      const sideBySidePath = await this.createSideBySide(baseImg, compareImg, diff, compareName, width, height);

      return {
        basePath: path.basename(basePath),
        comparePath: path.basename(comparePath),
        diffPath: path.basename(diffPath),
        sideBySidePath: path.basename(sideBySidePath),
        diffPercentage: diffPercentage.toFixed(2)
      };
    } catch (error) {
      this.log(`Screenshot comparison failed: ${error.message}`);
      return null;
    }
  }

  padImage(img, targetWidth, targetHeight) {
    if (img.width === targetWidth && img.height === targetHeight) {
      return img.data;
    }
    const paddedData = Buffer.alloc(targetWidth * targetHeight * 4, 255);
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

  async createSideBySide(baseImg, compareImg, diffImg, name, width, height) {
    const padding = 10;
    const totalWidth = (width * 3) + (padding * 4);
    const totalHeight = height + (padding * 2);
    const sideBySide = new PNG({ width: totalWidth, height: totalHeight });

    // Fill white background
    for (let i = 0; i < sideBySide.data.length; i += 4) {
      sideBySide.data[i] = sideBySide.data[i + 1] = sideBySide.data[i + 2] = sideBySide.data[i + 3] = 255;
    }

    // Copy images
    this.copyImage(sideBySide, baseImg, padding, padding);
    this.copyImage(sideBySide, compareImg, width + padding * 2, padding);
    this.copyImage(sideBySide, diffImg, width * 2 + padding * 3, padding);

    const sideBySidePath = path.join(DIFFS_DIR, `comparison-${name}.png`);
    fsSync.writeFileSync(sideBySidePath, PNG.sync.write(sideBySide));
    return sideBySidePath;
  }

  copyImage(dest, src, offsetX, offsetY) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
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

  async analyzeTemplates(templateNames) {
    this.log(`Analyzing ${templateNames.length} template(s)`);

    try {
      // Load and compile all templates
      const templates = {};
      for (const name of templateNames) {
        templates[name] = await this.loadAndCompileTemplate(name);
      }

      // Perform comparisons
      const baseTemplateName = 'site_visitor_welcome';
      const comparisons = [];

      // Ensure base template is loaded
      if (!templates[baseTemplateName]) {
        templates[baseTemplateName] = await this.loadAndCompileTemplate(baseTemplateName);
      }

      for (const name of templateNames) {
        if (name !== baseTemplateName && templates[baseTemplateName] && templates[name]) {
          const comparison = await this.compareTemplates(
            baseTemplateName,
            templates[baseTemplateName],
            name,
            templates[name]
          );
          comparisons.push(comparison);
        }
      }

    // Ask AI to analyze the comparisons - REGRESSION MODE
    const prompt = `Analyze the following template comparisons in REGRESSION MODE.

## REGRESSION MODE RULES
In regression mode, ALL templates must be IDENTICAL to the base template.
- ANY color difference = FAILURE
- ANY content difference = FAILURE
- ANY structural difference = FAILURE
The goal is to catch regressions where templates have diverged from the base.

## Templates Loaded
${Object.entries(templates).map(([name, t]) => `- ${name}: ${t.success ? 'loaded' : 'failed'}`).join('\n')}

## Comparisons
${JSON.stringify(comparisons, null, 2)}

## Known Template Characteristics (for context, NOT for passing)
- Partner A (site_visitor_welcome_partner_a): Has styling differences (green vs blue) - this is a REGRESSION FAILURE
- Partner B (site_visitor_welcome_partner_b): Has content differences - this is a REGRESSION FAILURE

Analyze each comparison and determine:
1. Does the template have ANY differences from base? If yes, it FAILS regression.
2. What specific differences exist?
3. Overall assessment should be 'fail' if ANY template has differences.

Respond with your analysis in JSON format.`;

    const response = await this.sendMessage(prompt);

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        analysis.rawComparisons = comparisons;
        return analysis;
      }
    } catch (e) {
      this.log(`Failed to parse JSON response: ${e.message}`);
    }

      // REGRESSION MODE: Determine overall assessment based on comparison results
      // If ANY comparison has differences, overall assessment is 'fail'
      const hasFailures = comparisons.some(c => c.regressionStatus === 'FAIL' || !c.isAsExpected);
      const overallAssessment = hasFailures ? 'fail' : 'pass';

      return {
        analysisComplete: true,
        comparisons: comparisons,
        overallAssessment: overallAssessment,
        mode: 'regression',
        recommendations: hasFailures
          ? ['Templates have diverged from base - investigate differences', 'All templates must match base in regression mode']
          : ['All templates match base template'],
        rawResponse: response.content
      };
    } finally {
      // Close browser after comparisons
      await this.closeBrowser();
    }
  }

  async loadAndCompileTemplate(name) {
    // Handle both formats: 'name' and 'name.mjml'
    const baseName = name.endsWith('.mjml') ? name.replace('.mjml', '') : name;
    const templateName = `${baseName}.mjml`;
    const templatePath = path.join(this.templatesDir, templateName);

    // First try to load pre-compiled HTML (with EJS substituted)
    const compiledHtmlPath = path.join(COMPILED_DIR, `${baseName}.html`);
    let html = null;

    try {
      html = await fs.readFile(compiledHtmlPath, 'utf-8');
      this.log(`Loaded compiled HTML for ${baseName}`);
    } catch (e) {
      // Fall back to compiling MJML
      this.log(`No compiled HTML for ${baseName}, compiling MJML...`);
    }

    try {
      const mjmlContent = await fs.readFile(templatePath, 'utf-8');

      // If we didn't load compiled HTML, compile MJML
      if (!html) {
        const compiled = mjml2html(mjmlContent, { validationLevel: 'soft' });
        html = compiled.html;
      }

      return {
        success: true,
        name: baseName,
        mjml: mjmlContent,
        html: html,
        colors: this.extractColors(html),
        textContent: this.extractText(html),
        structure: this.analyzeStructure(html)
      };
    } catch (error) {
      return {
        success: false,
        name: baseName,
        error: error.message
      };
    }
  }

  extractColors(html) {
    const colorPatterns = [
      /#[0-9a-fA-F]{6}\b/g,
      /#[0-9a-fA-F]{3}\b/g,
      /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi
    ];

    const colors = new Set();
    for (const pattern of colorPatterns) {
      const matches = html.match(pattern) || [];
      matches.forEach(c => colors.add(c.toLowerCase()));
    }
    return Array.from(colors);
  }

  extractText(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  analyzeStructure(html) {
    return {
      sections: (html.match(/<table/gi) || []).length,
      images: (html.match(/<img/gi) || []).length,
      links: (html.match(/<a\s/gi) || []).length,
      buttons: (html.match(/class="[^"]*button[^"]*"/gi) || []).length
    };
  }

  async compareTemplates(baseName, baseTemplate, compareName, compareTemplate) {
    // Ensure templates loaded successfully
    if (!baseTemplate.success || !compareTemplate.success) {
      return {
        baseTemplate: baseName,
        compareTemplate: compareName,
        error: `Template load failed: ${!baseTemplate.success ? baseName : compareName}`,
        stylingDifferences: { hasChanges: false },
        contentDifferences: { hasChanges: false },
        structuralDifferences: [],
        expectedDifferenceType: 'unknown',
        actualDifferenceType: 'unknown',
        isAsExpected: false,
        screenshots: null
      };
    }

    // Color comparison
    const baseColors = new Set(baseTemplate.colors || []);
    const compareColors = new Set(compareTemplate.colors || []);

    const addedColors = (compareTemplate.colors || []).filter(c => !baseColors.has(c));
    const removedColors = (baseTemplate.colors || []).filter(c => !compareColors.has(c));

    // Text diff
    const textDiff = diffLines(baseTemplate.textContent || '', compareTemplate.textContent || '');
    const textChanges = textDiff.filter(d => d.added || d.removed).length;

    // Structure comparison
    const structureDiffs = [];
    const baseStructure = baseTemplate.structure || {};
    const compareStructure = compareTemplate.structure || {};
    for (const [key, baseValue] of Object.entries(baseStructure)) {
      const compareValue = compareStructure[key];
      if (baseValue !== compareValue) {
        structureDiffs.push({
          element: key,
          base: baseValue,
          compare: compareValue
        });
      }
    }

    // Determine actual difference type
    const hasColorDiff = addedColors.length > 0 || removedColors.length > 0;
    const hasContentDiff = textChanges > 0;

    let actualDifferenceType = 'none';
    if (hasColorDiff && hasContentDiff) {
      actualDifferenceType = 'both';
    } else if (hasColorDiff) {
      actualDifferenceType = 'styling';
    } else if (hasContentDiff) {
      actualDifferenceType = 'content';
    }

    // REGRESSION MODE: What type of difference exists (for informational purposes)
    // Partner A has styling differences (green vs blue)
    // Partner B has content differences (different text)
    let differenceDescription = 'none';
    if (compareName.includes('partner_a')) {
      differenceDescription = 'styling (green vs blue color scheme)';
    } else if (compareName.includes('partner_b')) {
      differenceDescription = 'content (different text)';
    }

    // Generate visual comparison screenshots
    let screenshots = null;
    try {
      this.log(`Generating visual comparison for ${compareName}...`);
      screenshots = await this.createVisualComparison(
        baseName,
        baseTemplate.html,
        compareName,
        compareTemplate.html
      );
      if (screenshots) {
        this.log(`  Screenshots: diff-${compareName}.png, comparison-${compareName}.png (${screenshots.diffPercentage}% diff)`);
      }
    } catch (error) {
      this.log(`  Screenshot generation failed: ${error.message}`);
    }

    // REGRESSION MODE: ANY difference from base = FAIL
    // Templates should be identical to base template
    const hasDifferences = actualDifferenceType !== 'none';

    return {
      baseTemplate: baseName,
      compareTemplate: compareName,
      stylingDifferences: {
        addedColors,
        removedColors,
        hasChanges: hasColorDiff
      },
      contentDifferences: {
        textChanges,
        hasChanges: hasContentDiff
      },
      structuralDifferences: structureDiffs,
      differenceDescription,
      actualDifferenceType,
      // REGRESSION MODE: Pass only if NO differences exist
      isAsExpected: !hasDifferences,
      regressionStatus: hasDifferences ? 'FAIL' : 'PASS',
      screenshots
    };
  }

  async analyzeTemplatesCleanup() {
    await this.closeBrowser();
  }
}

export default DiffAnalyzerAgent;
