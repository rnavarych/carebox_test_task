import Anthropic from '@anthropic-ai/sdk';
import { AI_CONFIG } from '../config/constants.js';

/**
 * Base Agent Class
 *
 * Parent class for all AI agents in the test framework.
 * Handles Claude API communication and conversation management.
 */
export class BaseAgent {
  constructor(name, systemPrompt) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.conversationHistory = [];

    // Initialize Anthropic client with API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(userMessage, options = {}) {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const response = await this.client.messages.create({
        model: options.model || AI_CONFIG.defaultModel,
        max_tokens: options.maxTokens || AI_CONFIG.maxTokens,
        system: this.systemPrompt,
        messages: this.conversationHistory,
      });

      const assistantMessage = response.content[0].text;

      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage,
      });

      return {
        content: assistantMessage,
        usage: response.usage,
        stopReason: response.stop_reason,
      };
    } catch (error) {
      this.log(`Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Log a message with timestamp and agent name
   */
  log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] ${message}`);
  }
}

export default BaseAgent;
