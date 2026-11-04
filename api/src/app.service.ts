
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from './prisma/prisma.service.js';
import { PlannerService } from './planner/planner.service.js';
import { PlanEvaluatorService } from './planner/plan-evaluator.service.js';

const ALLOWED_TASK_TYPES = [
  'website',
  'research',
  'coding',
  'image',
  'general',
] as const;

type TaskType = (typeof ALLOWED_TASK_TYPES)[number];

export interface TaskRecord {
  id: string;
  input: string;
  taskType: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskStepRecord {
  id: string;
  planId: string;
  position: number;
  title: string;
  description: string;
  stepType: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskPlanRecord {
  id: string;
  taskId: string;
  version: number;
  summary: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  steps: TaskStepRecord[];
}

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planner: PlannerService,
    private readonly planEvaluator: PlanEvaluatorService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  // Create and save a new user task.
  async createTask(payload: unknown): Promise<TaskRecord> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      throw new BadRequestException(
        'Request body must be a JSON object.',
      );
    }

    const body = payload as Record<string, unknown>;

    if (
      typeof body.input !== 'string' ||
      body.input.trim().length === 0
    ) {
      throw new BadRequestException(
        '"input" must be a non-empty string.',
      );
    }

    const requestedType = body.taskType ?? 'general';

    if (
      typeof requestedType !== 'string' ||
      !ALLOWED_TASK_TYPES.includes(requestedType as TaskType)
    ) {
      throw new BadRequestException(
        `taskType must be one of: ${ALLOWED_TASK_TYPES.join(', ')}`,
      );
    }

    return this.prisma.task.create({
      data: {
        input: body.input.trim(),
        taskType: requestedType,
      },
    });
  }

  // Retrieve all saved tasks.
  async listTasks(): Promise<TaskRecord[]> {
    return this.prisma.task.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Retrieve a particular task.
  async getTask(id: string): Promise<TaskRecord> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(
        `Task ${id} was not found.`,
      );
    }

    return task;
  }

  // Save a rule-based plan with its individual steps.
  async createPlan(taskId: string): Promise<TaskPlanRecord> {
    const task = await this.getTask(taskId);

    const draft = this.planner.createDraft(
      task.input,
      task.taskType,
    );

    return this.prisma.$transaction(async (tx) => {
      const latestPlan = await tx.taskPlan.findFirst({
        where: { taskId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = (latestPlan?.version ?? 0) + 1;

      const savedPlan = await tx.taskPlan.create({
        data: {
          taskId,
          version: nextVersion,
          summary: draft.summary,
          status: 'draft',

          steps: {
            create: draft.steps.map((step) => ({
              position: step.position,
              title: step.title,
              description: step.description,
              stepType: step.stepType,
            })),
          },
        },
        include: {
          steps: {
            orderBy: {
              position: 'asc',
            },
          },
        },
      });

      await tx.task.update({
        where: { id: taskId },
        data: { status: 'planned' },
      });

      return savedPlan;
    });
  }

  // Generate, evaluate and save an AI-powered plan.
  async createAiPlan(taskId: string): Promise<TaskPlanRecord> {
    // Step 1: Retrieve the original user task.
    const task = await this.getTask(taskId);

    // Step 2: Generate a structured plan using Groq.
    const draft = await this.planner.createAiDraft(
      task.input,
      task.taskType,
    );

    // Step 3: Evaluate the generated plan before saving.
    const evaluation = this.planEvaluator.evaluate(draft);

    // Reject invalid plans instead of saving them.
    if (evaluation.status === 'failed') {
      throw new BadGatewayException({
        message: 'AI-generated plan failed evaluation.',
        findings: evaluation.findings,
      });
    }

    // Step 4: Save the evaluated plan and all its steps atomically.
    return this.prisma.$transaction(async (tx) => {
      const latestPlan = await tx.taskPlan.findFirst({
        where: { taskId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = (latestPlan?.version ?? 0) + 1;

      const savedPlan = await tx.taskPlan.create({
        data: {
          taskId,
          version: nextVersion,
          summary: draft.summary,
          status: 'draft',

          steps: {
            create: draft.steps.map((step) => ({
              position: step.position,
              title: step.title,
              description: step.description,
              stepType: step.stepType,
            })),
          },
        },
        include: {
          steps: {
            orderBy: {
              position: 'asc',
            },
          },
        },
      });

      // Update the task only after its plan has been saved.
      await tx.task.update({
        where: { id: taskId },
        data: { status: 'planned' },
      });

      return savedPlan;
    });
  }

  // Retrieve the latest saved plan and all its steps.
  async getLatestPlan(taskId: string): Promise<TaskPlanRecord> {
    await this.getTask(taskId);

    const plan = await this.prisma.taskPlan.findFirst({
      where: { taskId },
      orderBy: {
        version: 'desc',
      },
      include: {
        steps: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(
        `No plan found for task ${taskId}`,
      );
    }

    return plan;
  }
}
