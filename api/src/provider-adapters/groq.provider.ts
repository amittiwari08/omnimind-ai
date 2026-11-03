
import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import Groq from 'groq-sdk';

const GROQ_MODEL = 'openai/gpt-oss-20b';

@Injectable()
export class GroqProvider {
  private client: Groq | null = null;

  private getClient(): Groq {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Groq API key is not configured. Check api/.env.',
      );
    }

    this.client = new Groq({
      apiKey,
      timeout: 30_000,
      maxRetries: 0,
    });

    return this.client;
  }

  async generateTaskPlan(
    input: string,
    taskType: string,
  ): Promise<{ content: string; model: string }> {
    const client = this.getClient();

    try {
      const response = await client.chat.completions.create({
        model: GROQ_MODEL,

        messages: [
          {
            role: 'system',
            content: `
You are OmniMind AI's task planning engine.

Your job is to understand the user's goal and create
a practical, detailed and logically ordered execution plan.

Rules:
1. Understand the actual user's request.
2. Divide the goal into meaningful subtasks.
3. Make each step specific and actionable.
4. Respect dependencies between steps through their order.
5. Include verification and final delivery steps.
6. Do not invent user information.
7. Do not claim that any task has been executed.
8. Return only the structured plan requested by the JSON schema.
            `.trim(),
          },
          {
            role: 'user',
            content: `
User request:
${input}

Task category:
${taskType}

Create an appropriate execution plan for this request.
            `.trim(),
          },
        ],

        temperature: 0.2,
        max_completion_tokens: 2500,

        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'omnimind_task_plan',
            strict: true,

            schema: {
              type: 'object',
              additionalProperties: false,

              properties: {
                summary: {
                  type: 'string',
                },

                steps: {
                  type: 'array',

                  items: {
                    type: 'object',
                    additionalProperties: false,

                    properties: {
                      position: {
                        type: 'integer',
                      },
                      title: {
                        type: 'string',
                      },
                      description: {
                        type: 'string',
                      },
                      stepType: {
                        type: 'string',
                      },
                    },

                    required: [
                      'position',
                      'title',
                      'description',
                      'stepType',
                    ],
                  },
                },
              },

              required: ['summary', 'steps'],
            },
          },
        },
      });

      const content = response.choices[0]?.message?.content;

      if (!content || typeof content !== 'string') {
        throw new ServiceUnavailableException(
          'Groq returned an empty planning response.',
        );
      }

      return {
        content,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'Groq planning request failed. Check provider availability, API quota and configuration.',
      );
    }
  }
}
