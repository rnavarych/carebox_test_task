import { BaseAgent } from './base-agent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_PROMPT = `You are the Test Planner Agent in a multi-agent email template QA system.

Your responsibilities:
1. Analyze the email template testing task and requirements
2. Create comprehensive test plans for template validation
3. Define specific test cases for each template
4. Establish acceptance criteria for pass/fail
5. Prioritize tests based on risk and importance

When creating test plans, consider:
- Template compilation validation
- EJS variable rendering
- Styling consistency (colors, fonts, spacing)
- Content accuracy
- Structural integrity
- Mobile responsiveness
- Accessibility considerations
- Cross-template comparison requirements

For each template variation, define:
- What should stay the same vs what should differ
- Specific elements to verify
- Edge cases to test

Always respond with structured JSON in this format:
{
  "testPlanId": "unique-id",
  "createdAt": "timestamp",
  "templateContext": {
    "baseTemplate": "name",
    "variations": ["name1", "name2"],
    "expectedDifferences": {
      "variation1": "styling|content|structure",
      "variation2": "styling|content|structure"
    }
  },
  "testSuites": [
    {
      "name": "Suite Name",
      "description": "What this suite tests",
      "priority": "critical|high|medium|low",
      "testCases": [
        {
          "id": "TC001",
          "name": "Test Case Name",
          "description": "What this test verifies",
          "steps": ["Step 1", "Step 2"],
          "expectedResult": "What should happen",
          "acceptanceCriteria": ["Criteria 1", "Criteria 2"]
        }
      ]
    }
  ],
  "riskAssessment": {
    "highRiskAreas": ["area1", "area2"],
    "mitigations": ["mitigation1", "mitigation2"]
  },
  "summary": "Brief summary of the test plan"
}`;

export class TestPlannerAgent extends BaseAgent {
  constructor() {
    super('TestPlanner', SYSTEM_PROMPT);
    this.templatesDir = path.resolve(__dirname, '../../email_templates/emails');
    this.plansDir = path.resolve(__dirname, '../output/test-plans');
  }

  async createTestPlan(selectedTemplates = null) {
    this.log('Creating comprehensive test plan');

    // Gather template information (only for selected templates if specified)
    const templateDetails = await this.gatherTemplateInfo(selectedTemplates);

    const templateNames = Object.keys(templateDetails);
    this.log(`Planning tests for templates: ${templateNames.join(', ')}`);

    // Build dynamic requirements based on which templates are selected
    let requirementsSection = '';
    if (templateNames.length > 0) {
      requirementsSection = `## Templates Being Tested\n`;
      for (const name of templateNames) {
        const details = templateDetails[name];
        if (details && details.exists) {
          requirementsSection += `\n### ${name}\n`;
          requirementsSection += `- File: ${details.file}\n`;
          requirementsSection += `- Lines: ${details.lines}\n`;
          requirementsSection += `- Has EJS Variables: ${details.hasEjsVariables}\n`;
          if (details.colors && details.colors.length > 0) {
            requirementsSection += `- Colors found: ${details.colors.join(', ')}\n`;
          }
        }
      }
    }

    const prompt = `Create a comprehensive test plan for the following email template QA task:

## Task Overview
Test and validate the specified email templates. Only create test cases for the templates listed below.

## Templates to Test (ONLY these templates)
${JSON.stringify(templateDetails, null, 2)}

${requirementsSection}

## Test Plan Requirements
Create a detailed test plan that ONLY includes tests for the templates listed above:
1. Compilation Tests - verify each selected template's MJML compiles without errors
2. Rendering Tests - verify EJS variables render correctly in selected templates
3. Styling Tests - verify styling is correct for selected templates
4. Content Tests - verify content is correct for selected templates
5. Structure Tests - verify structural integrity of selected templates
6. Validation Tests - verify HTML is valid for email clients

IMPORTANT: Do NOT include any templates that are not in the "Templates to Test" list above.
Only create test cases for: ${templateNames.join(', ')}

Provide specific test cases with clear acceptance criteria.`;

    const response = await this.sendMessage(prompt, { maxTokens: 8192 });

    // Use RUN_TIMESTAMP from environment for consistent naming across artifacts
    const timestamp = process.env.RUN_TIMESTAMP || new Date().toISOString().replace(/[:.]/g, '-');
    // Convert timestamp format (2026-02-04T20-54-17-861Z) back to ISO format for createdAt
    const createdAtTimestamp = timestamp.replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');

    let testPlan;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        testPlan = JSON.parse(jsonMatch[0]);
        // Override AI-generated createdAt with actual timestamp
        testPlan.createdAt = createdAtTimestamp;
      }
    } catch (e) {
      this.log(`Failed to parse JSON response: ${e.message}`);
      testPlan = {
        testPlanId: `plan-${Date.now()}`,
        createdAt: createdAtTimestamp,
        rawResponse: response.content,
        parseError: true
      };
    }

    // Save test plan
    await fs.mkdir(this.plansDir, { recursive: true });
    const planPath = path.join(this.plansDir, `test-plan-${timestamp}.json`);
    await fs.writeFile(planPath, JSON.stringify(testPlan, null, 2), 'utf-8');

    // Also save as latest
    const latestPath = path.join(this.plansDir, 'latest-test-plan.json');
    await fs.writeFile(latestPath, JSON.stringify(testPlan, null, 2), 'utf-8');

    this.log(`Test plan saved to: ${planPath}`);

    return {
      testPlan,
      planPath,
      templateDetails
    };
  }

  async gatherTemplateInfo(selectedTemplates = null) {
    const templates = {};

    // Read .mjml files from the templates directory
    try {
      const files = await fs.readdir(this.templatesDir);
      let mjmlFiles = files.filter(f => f.endsWith('.mjml'));

      // Filter to only selected templates if specified
      if (selectedTemplates && selectedTemplates.length > 0) {
        const selectedSet = new Set(selectedTemplates.map(t => t.replace('.mjml', '')));
        mjmlFiles = mjmlFiles.filter(f => selectedSet.has(f.replace('.mjml', '')));
      }

      for (const file of mjmlFiles) {
        const templatePath = path.join(this.templatesDir, file);
        const name = file.replace('.mjml', '');

        try {
          const content = await fs.readFile(templatePath, 'utf-8');
          const stats = await fs.stat(templatePath);

          templates[name] = {
            exists: true,
            file,
            size: stats.size,
            lines: content.split('\n').length,
            lastModified: stats.mtime,
            hasEjsVariables: content.includes('<%='),
            ejsVariables: this.extractEjsVariables(content),
            colors: this.extractColors(content),
            sections: this.countSections(content),
            preview: content.substring(0, 500) + '...'
          };
        } catch (error) {
          templates[name] = {
            exists: false,
            file,
            error: error.message
          };
        }
      }
    } catch (error) {
      console.error('Error reading templates directory:', error.message);
    }

    return templates;
  }

  extractEjsVariables(content) {
    const matches = content.match(/<%=\s*context\.(\w+)\s*%>/g) || [];
    return [...new Set(matches.map(m => {
      const match = m.match(/context\.(\w+)/);
      return match ? match[1] : null;
    }).filter(Boolean))];
  }

  extractColors(content) {
    const colorPatterns = [
      /#[0-9a-fA-F]{6}\b/g,
      /#[0-9a-fA-F]{3}\b/g
    ];

    const colors = new Set();
    for (const pattern of colorPatterns) {
      const matches = content.match(pattern) || [];
      matches.forEach(c => colors.add(c.toLowerCase()));
    }
    return Array.from(colors);
  }

  countSections(content) {
    return {
      mjSections: (content.match(/<mj-section/gi) || []).length,
      mjColumns: (content.match(/<mj-column/gi) || []).length,
      mjText: (content.match(/<mj-text/gi) || []).length,
      mjButton: (content.match(/<mj-button/gi) || []).length,
      mjImage: (content.match(/<mj-image/gi) || []).length
    };
  }

  async getLatestTestPlan() {
    const latestPath = path.join(this.plansDir, 'latest-test-plan.json');
    try {
      const content = await fs.readFile(latestPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

export default TestPlannerAgent;
