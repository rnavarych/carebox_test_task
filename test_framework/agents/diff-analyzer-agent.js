import { BaseAgent } from './base-agent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mjml2html from 'mjml';
import { diffLines } from 'diff';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  }

  async analyzeTemplates(templateNames) {
    this.log(`Analyzing ${templateNames.length} template(s)`);

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

    // Ask AI to analyze the comparisons
    const prompt = `Analyze the following template comparisons:

## Templates Loaded
${Object.entries(templates).map(([name, t]) => `- ${name}: ${t.success ? 'loaded' : 'failed'}`).join('\n')}

## Comparisons
${JSON.stringify(comparisons, null, 2)}

## Expected Differences
- Partner A (site_visitor_welcome_partner_a): Should have DIFFERENT COLORS but SAME CONTENT as base
- Partner B (site_visitor_welcome_partner_b): Should have SAME COLORS but DIFFERENT CONTENT as base

Analyze each comparison and determine:
1. Are the differences as expected?
2. Are there any unintended differences?
3. What is your overall assessment?

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

    return {
      analysisComplete: true,
      comparisons: comparisons,
      overallAssessment: 'warning',
      recommendations: ['Manual review recommended'],
      rawResponse: response.content
    };
  }

  async loadAndCompileTemplate(name) {
    // Handle both formats: 'name' and 'name.mjml'
    const templateName = name.endsWith('.mjml') ? name : `${name}.mjml`;
    const templatePath = path.join(this.templatesDir, templateName);

    try {
      const mjmlContent = await fs.readFile(templatePath, 'utf-8');

      const compiled = mjml2html(mjmlContent, { validationLevel: 'soft' });

      return {
        success: true,
        name,
        mjml: mjmlContent,
        html: compiled.html,
        errors: compiled.errors,
        colors: this.extractColors(compiled.html),
        textContent: this.extractText(compiled.html),
        structure: this.analyzeStructure(compiled.html)
      };
    } catch (error) {
      return {
        success: false,
        name,
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
        isAsExpected: false
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

    // Determine expected difference type
    let expectedDifferenceType = 'none';
    if (compareName.includes('partner_a')) {
      expectedDifferenceType = 'styling';
    } else if (compareName.includes('partner_b')) {
      expectedDifferenceType = 'content';
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
      expectedDifferenceType,
      actualDifferenceType,
      isAsExpected: expectedDifferenceType === actualDifferenceType ||
                    (expectedDifferenceType === 'content' && actualDifferenceType === 'both')
    };
  }
}

export default DiffAnalyzerAgent;
