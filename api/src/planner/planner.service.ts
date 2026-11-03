
import {
  BadGatewayException,
  Injectable,
} from '@nestjs/common';

import { GroqProvider } from '../provider-adapters/groq.provider.js';

export interface PlannedStep {
  position: number;
  title: string;
  description: string;
  stepType: string;
}

export interface TaskPlanDraft {
  summary: string;
  steps: PlannedStep[];
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

@Injectable()
export class PlannerService {
  constructor(
    private readonly groqProvider: GroqProvider,
  ) {}

  // Existing rule-based planner.
  // Keep this available for comparison and development tests.
  createDraft(
    input: string,
    taskType: string,
  ): TaskPlanDraft {
    const templates: Record<string, PlannedStep[]> = {
      website: [
        {
          position: 1,
          title: 'Analyze Requirements',
          description:
            'Understand website requirements, audience, content and functionality.',
          stepType: 'analysis',
        },
        {
          position: 2,
          title: 'Define Website Structure',
          description:
            'Identify pages, sections, navigation and acceptance criteria.',
          stepType: 'planning',
        },
        {
          position: 3,
          title: 'Evaluate Reusable Resources',
          description:
            'Assess suitable templates, components and repositories.',
          stepType: 'repository-discovery',
        },
        {
          position: 4,
          title: 'Create UI Design',
          description:
            'Define visual style, layout, typography and responsive behavior.',
          stepType: 'design',
        },
        {
          position: 5,
          title: 'Implement Website',
          description:
            'Build the required pages, components and interactions.',
          stepType: 'implementation',
        },
        {
          position: 6,
          title: 'Test and Verify',
          description:
            'Check functionality, responsiveness and build results.',
          stepType: 'verification',
        },
        {
          position: 7,
          title: 'Prepare Final Deliverables',
          description:
            'Package source code and verification reports.',
          stepType: 'delivery',
        },
      ],

      coding: [
        {
          position: 1,
          title: 'Understand the Problem',
          description:
            'Analyze the requested functionality and constraints.',
          stepType: 'analysis',
        },
        {
          position: 2,
          title: 'Inspect Existing Code',
          description:
            'Understand project structure and dependencies.',
          stepType: 'inspection',
        },
        {
          position: 3,
          title: 'Design the Solution',
          description:
            'Define implementation strategy and affected components.',
          stepType: 'planning',
        },
        {
          position: 4,
          title: 'Implement Changes',
          description:
            'Implement the required code changes.',
          stepType: 'implementation',
        },
        {
          position: 5,
          title: 'Run Tests',
          description:
            'Execute relevant automated tests.',
          stepType: 'verification',
        },
        {
          position: 6,
          title: 'Review and Deliver',
          description:
            'Review changes and prepare final output.',
          stepType: 'delivery',
        },
      ],

      research: [
        {
          position: 1,
          title: 'Understand Research Scope',
          description:
            'Identify research questions and objectives.',
          stepType: 'analysis',
        },
        {
          position: 2,
          title: 'Collect Information',
          description:
            'Find relevant and reliable information.',
          stepType: 'research',
        },
        {
          position: 3,
          title: 'Evaluate Sources',
          description:
            'Assess credibility and relevance.',
          stepType: 'evaluation',
        },
        {
          position: 4,
          title: 'Cross-Check Evidence',
          description:
            'Compare important findings across sources.',
          stepType: 'verification',
        },
        {
          position: 5,
          title: 'Prepare Research Report',
          description:
            'Organize findings, citations and conclusions.',
          stepType: 'delivery',
        },
      ],

      image: [
        {
          position: 1,
          title: 'Understand Visual Requirements',
          description:
            'Identify subject, style and composition.',
          stepType: 'analysis',
        },
        {
          position: 2,
          title: 'Prepare Image Instructions',
          description:
            'Create detailed generation or editing instructions.',
          stepType: 'planning',
        },
        {
          position: 3,
          title: 'Select Image Capability',
          description:
            'Identify an eligible image-generation capability.',
          stepType: 'selection',
        },
        {
          position: 4,
          title: 'Generate or Edit Image',
          description:
            'Execute the approved image operation.',
          stepType: 'execution',
        },
        {
          position: 5,
          title: 'Review Final Image',
          description:
            'Evaluate the output against requested requirements.',
          stepType: 'verification',
        },
        {
          position: 6,
          title: 'Deliver Image',
          description:
            'Prepare the final image and metadata.',
          stepType: 'delivery',
        },
      ],

      general: [
        {
          position: 1,
          title: 'Understand User Request',
          description:
            'Identify the goal, expected output and constraints.',
          stepType: 'analysis',
        },
        {
          position: 2,
          title: 'Identify Required Capabilities',
          description:
            'Determine which models or tools may be needed.',
          stepType: 'selection',
        },
        {
          position: 3,
          title: 'Create Execution Strategy',
          description:
            'Break the goal into logical steps.',
          stepType: 'planning',
        },
        {
          position: 4,
          title: 'Execute Work',
          description:
            'Perform the planned work.',
          stepType: 'execution',
        },
        {
          position: 5,
          title: 'Verify Results',
          description:
            'Check output against requirements.',
          stepType: 'verification',
        },
        {
          position: 6,
          title: 'Deliver Results',
          description:
            'Prepare the final output.',
          stepType: 'delivery',
        },
      ],
    };

    const steps =
      templates[taskType] ?? templates.general;

    return {
      summary: `Execution plan for: ${input}`,
      steps: steps.map((step) => ({ ...step })),
    };
  }

  // New AI-powered planner using Groq.
  async createAiDraft(
    input: string,
    taskType: string,
  ): Promise<TaskPlanDraft> {
    const response =
      await this.groqProvider.generateTaskPlan(
        input,
        taskType,
      );

    let parsed: unknown;

    try {
      parsed = JSON.parse(response.content);
    } catch {
      throw new BadGatewayException(
        'AI planner returned invalid JSON.',
      );
    }

    if (
      !isRecord(parsed) ||
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.steps)
    ) {
      throw new BadGatewayException(
        'AI planner returned an invalid plan structure.',
      );
    }

    if (
      parsed.summary.trim().length === 0 ||
      parsed.summary.length > 500
    ) {
      throw new BadGatewayException(
        'AI planner returned an invalid plan summary.',
      );
    }

    if (
      parsed.steps.length < 1 ||
      parsed.steps.length > 15
    ) {
      throw new BadGatewayException(
        'AI planner must return between 1 and 15 steps.',
      );
    }

    const validatedSteps: PlannedStep[] =
      parsed.steps.map((step, index) => {
        if (
          !isRecord(step) ||
          typeof step.position !== 'number' ||
          !Number.isInteger(step.position) ||
          step.position < 1 ||
          typeof step.title !== 'string' ||
          typeof step.description !== 'string' ||
          typeof step.stepType !== 'string'
        ) {
          throw new BadGatewayException(
            `AI planner returned an invalid step at position ${index + 1}.`,
          );
        }

        const title = step.title.trim();
        const description = step.description.trim();
        const stepType = step.stepType.trim().toLowerCase();

        if (
          title.length === 0 ||
          title.length > 160 ||
          description.length === 0 ||
          description.length > 2000 ||
          !/^[a-z0-9-]{1,60}$/.test(stepType)
        ) {
          throw new BadGatewayException(
            `AI planner returned invalid step content at position ${index + 1}.`,
          );
        }

        return {
          position: step.position,
          title,
          description,
          stepType,
        };
      });

    const positions = new Set(
      validatedSteps.map((step) => step.position),
    );

    if (positions.size !== validatedSteps.length) {
      throw new BadGatewayException(
        'AI planner returned duplicate step positions.',
      );
    }

    // Normalize positions into a continuous sequence.
    validatedSteps.sort(
      (a, b) => a.position - b.position,
    );

    const normalizedSteps = validatedSteps.map(
      (step, index) => ({
        ...step,
        position: index + 1,
      }),
    );

    return {
      summary: parsed.summary.trim(),
      steps: normalizedSteps,
    };
  }
}
