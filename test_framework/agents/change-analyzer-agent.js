import { BaseAgent } from './base-agent.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SYSTEM_PROMPT = `You are the Change Analyzer Agent in a multi-agent email template QA system.

Your responsibilities:
1. Analyze file system changes (created, modified, deleted files)
2. Determine which templates need to be tested based on changes
3. Categorize the type of change (content change, styling change, new template, deleted template)
4. Prioritize testing order based on change impact

When analyzing changes, you should:
- Identify affected templates
- Determine if the change is significant enough to warrant full testing
- Suggest which comparison tests need to run
- Flag any potential issues (missing files, invalid structure)

Always respond with structured JSON in this format:
{
  "analysisComplete": true,
  "affectedTemplates": ["template_name"],
  "changeType": "content|styling|structure|new|deleted",
  "testingRequired": true,
  "priority": "high|medium|low",
  "recommendations": ["recommendation1", "recommendation2"],
  "warnings": ["warning1"],
  "summary": "Brief summary of changes"
}`;

export class ChangeAnalyzerAgent extends BaseAgent {
  constructor() {
    super('ChangeAnalyzer', SYSTEM_PROMPT);
    this.templatesDir = path.resolve(__dirname, '../../email_templates/emails');
  }

  async analyzeChanges(changeEvents, selectedTemplates = null) {
    this.log(`Analyzing ${changeEvents.length} change event(s)`);
    if (selectedTemplates && selectedTemplates.length > 0) {
      this.log(`Filtering to selected templates: ${selectedTemplates.join(', ')}`);
    }

    // Get current state of templates (filtered if specified)
    const templateState = await this.getTemplateState(selectedTemplates);

    const prompt = `Analyze the following file system changes and template state:

## Change Events
${JSON.stringify(changeEvents, null, 2)}

## Current Template State
${JSON.stringify(templateState, null, 2)}

Based on this information:
1. Identify which templates are affected
2. Determine the type of changes
3. Recommend what testing should be performed
4. Flag any potential issues

Respond with your analysis in JSON format.`;

    const response = await this.sendMessage(prompt);

    try {
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      this.log(`Failed to parse JSON response: ${e.message}`);
    }

    return {
      analysisComplete: true,
      affectedTemplates: changeEvents.map(e => e.template).filter(Boolean),
      changeType: 'unknown',
      testingRequired: true,
      priority: 'medium',
      recommendations: ['Run full test suite due to parsing error'],
      warnings: ['Could not parse AI response'],
      summary: 'Change detected, running default analysis',
      rawResponse: response.content
    };
  }

  async getTemplateState(selectedTemplates = null) {
    const state = {
      templates: [],
      totalFiles: 0
    };

    // Create set of selected templates for filtering
    const selectedSet = selectedTemplates && selectedTemplates.length > 0
      ? new Set(selectedTemplates.map(t => t.replace('.mjml', '')))
      : null;

    try {
      const files = await fs.readdir(this.templatesDir);

      for (const file of files) {
        if (!file.endsWith('.mjml')) continue;

        // Skip if not in selected templates
        const templateName = file.replace('.mjml', '');
        if (selectedSet && !selectedSet.has(templateName)) continue;

        const templatePath = path.join(this.templatesDir, file);
        const stat = await fs.stat(templatePath);

        if (stat.isFile()) {
          try {
            const content = await fs.readFile(templatePath, 'utf-8');
            const name = file.replace('.mjml', '');

            state.templates.push({
              name,
              file,
              exists: true,
              size: stat.size,
              modified: stat.mtime,
              lineCount: content.split('\n').length,
              hasEjsVars: content.includes('<%='),
              preview: content.substring(0, 200) + '...'
            });
            state.totalFiles++;
          } catch {
            state.templates.push({
              name: file.replace('.mjml', ''),
              file,
              exists: false
            });
          }
        }
      }
    } catch (error) {
      this.log(`Error reading templates: ${error.message}`);
    }

    return state;
  }
}

export default ChangeAnalyzerAgent;
