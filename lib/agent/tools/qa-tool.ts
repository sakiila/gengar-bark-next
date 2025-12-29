/**
 * Q&A Tool for the AI Agent system.
 * Wraps existing GPT Q&A functionality for general knowledge queries.
 * Requirements: 3.5
 */

import { Tool, ToolResult, AgentContext, ToolParameterSchema } from '../types';
import { getGPT } from '@/lib/ai/openai';
import { ChatCompletionMessageParam } from 'openai/resources';

/**
 * Parameter schema for the Q&A tool.
 * Defines the question parameter for general queries.
 */
const qaParameterSchema: ToolParameterSchema = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      description: 'The question or query to ask the AI assistant',
    },
    context: {
      type: 'string',
      description: 'Optional additional context to help answer the question',
    },
  },
  required: ['question'],
};

/**
 * System prompt for the Q&A assistant.
 */
const SYSTEM_PROMPT = `You are a highly knowledgeable and helpful assistant with expertise in various domains, including technology, science, and general knowledge. You are always ready to assist users with their queries in a friendly and professional manner. You were developed by Bob, a talented backend engineer at MoeGo Inc. Your responses must be concise, relevant, and no longer than 2,000 characters.`;

/**
 * QATool provides general Q&A capabilities through the AI agent.
 * Wraps the existing GPT functionality for answering user questions.
 */
export class QATool implements Tool {
  name = 'ask_question';
  description = 'Ask a general question and get an AI-powered answer. Use this for general knowledge queries, technical questions, explanations, or any topic that does not require specific tool actions like creating Jira issues or looking up appointments.';
  parameters = qaParameterSchema;
  cacheable = true;
  cacheTtlSeconds = 300; // Cache for 5 minutes

  /**
   * Execute the Q&A tool to answer a user question.
   * 
   * @param params - Tool parameters including the question and optional context
   * @param context - Agent context with user and channel information
   * @returns ToolResult with the AI response
   */
  async execute(
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<ToolResult> {
    const { question, context: additionalContext } = params as {
      question: string;
      context?: string;
    };

    // Validate required parameters
    if (!question || question.trim().length === 0) {
      return {
        success: false,
        error: 'Question is required',
        displayText: 'Please provide a question to ask.',
      };
    }

    try {
      // Build the messages array for GPT
      const messages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
      ];

      // Add conversation history for context if available
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        // Add recent conversation history (last 5 messages for context)
        const recentHistory = context.conversationHistory.slice(-5);
        for (const msg of recentHistory) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              role: msg.role,
              content: msg.content,
            });
          }
        }
      }

      // Build the user message
      let userMessage = question;
      if (additionalContext) {
        userMessage = `Context: ${additionalContext}\n\nQuestion: ${question}`;
      }

      messages.push({
        role: 'user',
        content: userMessage,
      });

      // Call GPT
      const gptResponse = await getGPT(messages);
      const answer = gptResponse.choices[0]?.message?.content;

      if (!answer) {
        return {
          success: false,
          error: 'No response received from AI',
          displayText: 'Sorry, I could not generate a response. Please try again.',
        };
      }

      // Truncate if necessary (2000 char limit for Slack)
      const truncatedAnswer = answer.length > 2000 
        ? answer.substring(0, 1997) + '...'
        : answer;

      return {
        success: true,
        data: {
          question,
          answer: truncatedAnswer,
          model: 'gpt-5-chat-latest',
        },
        displayText: truncatedAnswer,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Check for rate limit errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          displayText: '⏳ AI service is busy. Please try again in a moment.',
        };
      }

      return {
        success: false,
        error: errorMessage,
        displayText: `❌ Failed to get AI response: ${errorMessage}`,
      };
    }
  }
}

/**
 * Factory function to create a QATool instance.
 */
export function createQATool(): QATool {
  return new QATool();
}
