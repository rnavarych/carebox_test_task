import { BaseAgent } from './base-agent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_PROMPT = `You are the Test Generator Agent in a multi-agent email template QA system. You generate executable Playwright test cases based on test plans.

Your responsibilities:
1. Parse the test plan and generate corresponding test case definitions
2. Create test cases that can be dynamically executed by Playwright
3. Define assertions, expected values, and test logic for each test case
4. Ensure tests are in REGRESSION MODE - all templates must match the base template

OUTPUT FORMAT - Generate a JSON array of test cases with this structure:

{
  "generatedAt": "ISO timestamp",
  "testPlanId": "from test plan",
  "mode": "regression",
  "baseTemplate": "site_visitor_welcome",
  "testCases": [
    {
      "id": "TC001",
      "name": "Test name",
      "description": "What this test verifies",
      "suite": "Suite name",
      "priority": "critical|high|medium|low",
      "type": "compilation|rendering|color|content|structure|visual",
      "template": "template_name",
      "assertions": [
        {
          "type": "html_exists",
          "description": "Template compiles to valid HTML"
        },
        {
          "type": "has_doctype",
          "description": "HTML has DOCTYPE declaration"
        },
        {
          "type": "color_matches",
          "expected": "#2563eb",
          "description": "Uses base blue color"
        },
        {
          "type": "color_absent",
          "forbidden": "#16a34a",
          "description": "Does not use green color"
        },
        {
          "type": "content_contains",
          "expected": "Hello",
          "description": "Has base greeting"
        },
        {
          "type": "content_absent",
          "forbidden": "Greetings",
          "description": "Does not have alternative greeting"
        },
        {
          "type": "visual_match",
          "baseTemplate": "site_visitor_welcome",
          "threshold": 2,
          "description": "Visually matches base within 2%"
        }
      ]
    }
  ]
}

ASSERTION TYPES:
- html_exists: Check template file exists and has content
- has_doctype: Check for <!DOCTYPE html>
- has_html_tag: Check for <html> tag
- has_body_tag: Check for <body> tag
- no_ejs_tags: Check no unresolved <% %> tags
- color_matches: Check HTML contains expected color hex code
- color_absent: Check HTML does NOT contain forbidden color
- content_contains: Check rendered text contains expected string (case-insensitive)
- content_absent: Check rendered text does NOT contain forbidden string
- visual_match: Compare screenshots, pass if diff <= threshold %
- size_under: Check file size under limit in KB
- structure_valid: Check valid HTML structure

REGRESSION MODE RULES:
1. ALL templates must match base template colors (#2563eb blue)
2. ALL templates must match base template content ("Hello", "Get Started Now")
3. ANY deviation from base is a FAILURE
4. Visual comparison threshold is 2% - anything above FAILS

Generate comprehensive test cases that cover all aspects of the test plan.
Respond with ONLY the JSON, no markdown formatting or explanation.`;

export class TestGeneratorAgent extends BaseAgent {
  constructor() {
    super('TestGenerator', SYSTEM_PROMPT);
    this.outputDir = path.resolve(__dirname, '../output/generated-tests');
    this.testPlansDir = path.resolve(__dirname, '../output/test-plans');
  }

  async generateTests(testPlan, templates) {
    this.log('Generating dynamic test cases from test plan');

    await fs.mkdir(this.outputDir, { recursive: true });

    // Prepare prompt with test plan and template info
    const prompt = `Generate Playwright test cases for the following test plan.

## Test Plan
${JSON.stringify(testPlan, null, 2)}

## Templates to Test
${templates.map(t => `- ${t}`).join('\n')}

## Base Template
site_visitor_welcome

## Requirements (REGRESSION MODE)
- Base template uses blue color: #2563eb
- Base template greeting: "Hello"
- Base template button: "Get Started Now"
- ALL other templates MUST match base exactly
- Any color difference (like green #16a34a) is a FAILURE
- Any content difference (like "Greetings") is a FAILURE

Generate test cases for:
1. Template Compilation (each template compiles to valid HTML)
2. EJS Variable Rendering (variables are substituted correctly)
3. Color Regression (all templates use base blue #2563eb, no green #16a34a)
4. Content Regression (all templates have "Hello" and "Get Started Now", not "Greetings" or "Begin Your Journey")
5. Structure Validation (valid HTML structure, size limits)
6. Visual Regression (all templates visually match base within 2%)

Generate the complete JSON test cases array now:`;

    const response = await this.sendMessage(prompt, { maxTokens: 8192 });

    let testCases;
    try {
      // Clean response - remove markdown code blocks if present
      let jsonContent = response.content.trim();
      if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
      }
      testCases = JSON.parse(jsonContent);
    } catch (error) {
      this.log(`Failed to parse generated tests: ${error.message}`);
      // Generate fallback test cases
      testCases = this.generateFallbackTests(templates);
    }

    // Add metadata
    testCases.generatedAt = new Date().toISOString();
    testCases.testPlanId = testPlan.testPlanId || 'unknown';

    // Save generated tests
    const outputPath = path.join(this.outputDir, 'test-cases.json');
    await fs.writeFile(outputPath, JSON.stringify(testCases, null, 2));
    this.log(`Generated ${testCases.testCases?.length || 0} test cases`);
    this.log(`Saved to: ${outputPath}`);

    return testCases;
  }

  generateFallbackTests(templates) {
    this.log('Using fallback test generation');

    const testCases = {
      mode: 'regression',
      baseTemplate: 'site_visitor_welcome',
      testCases: []
    };

    let tcId = 1;

    // Generate compilation tests for each template
    for (const template of templates) {
      testCases.testCases.push({
        id: `TC${String(tcId++).padStart(3, '0')}`,
        name: `${template} Compilation`,
        description: `Verify ${template} compiles to valid HTML`,
        suite: 'Template Compilation',
        priority: 'critical',
        type: 'compilation',
        template: template,
        assertions: [
          { type: 'html_exists', description: 'Template compiles and has content' },
          { type: 'has_doctype', description: 'Has DOCTYPE declaration' },
          { type: 'has_html_tag', description: 'Has HTML tag' },
          { type: 'has_body_tag', description: 'Has BODY tag' },
          { type: 'no_ejs_tags', description: 'No unresolved EJS tags' }
        ]
      });
    }

    // Generate color regression tests for non-base templates
    for (const template of templates) {
      if (template !== 'site_visitor_welcome') {
        testCases.testCases.push({
          id: `TC${String(tcId++).padStart(3, '0')}`,
          name: `${template} Color Regression`,
          description: `REGRESSION: ${template} must use base blue color`,
          suite: 'Color Scheme Validation',
          priority: 'critical',
          type: 'color',
          template: template,
          assertions: [
            { type: 'color_matches', expected: '#2563eb', description: 'Has base blue color' },
            { type: 'color_absent', forbidden: '#16a34a', description: 'No green color allowed' }
          ]
        });
      }
    }

    // Generate content regression tests for non-base templates
    for (const template of templates) {
      if (template !== 'site_visitor_welcome') {
        testCases.testCases.push({
          id: `TC${String(tcId++).padStart(3, '0')}`,
          name: `${template} Content Regression`,
          description: `REGRESSION: ${template} must have base content`,
          suite: 'Content Validation',
          priority: 'critical',
          type: 'content',
          template: template,
          assertions: [
            { type: 'content_contains', expected: 'Hello', description: 'Has base greeting "Hello"' },
            { type: 'content_absent', forbidden: 'Greetings', description: 'No "Greetings" allowed' },
            { type: 'content_contains', expected: 'Get Started Now', description: 'Has base button text' },
            { type: 'content_absent', forbidden: 'Begin Your Journey', description: 'No alternative button text' }
          ]
        });
      }
    }

    // Generate visual regression tests for non-base templates
    for (const template of templates) {
      if (template !== 'site_visitor_welcome') {
        testCases.testCases.push({
          id: `TC${String(tcId++).padStart(3, '0')}`,
          name: `${template} Visual Regression`,
          description: `REGRESSION: ${template} must visually match base`,
          suite: 'Visual Regression',
          priority: 'critical',
          type: 'visual',
          template: template,
          assertions: [
            { type: 'visual_match', baseTemplate: 'site_visitor_welcome', threshold: 2, description: 'Visual diff within 2%' }
          ]
        });
      }
    }

    return testCases;
  }
}

export default TestGeneratorAgent;
