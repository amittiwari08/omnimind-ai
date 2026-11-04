
import { Injectable } from '@nestjs/common';
import type { TaskPlanDraft } from './planner.service.js';

export interface PlanEvaluationResult {
  status: 'passed' | 'failed';
  findings: string[];
}

@Injectable()
export class PlanEvaluatorService {
  evaluate(plan: TaskPlanDraft): PlanEvaluationResult {
    const findings: string[] = [];

    // Check 1: Validate the plan summary.
    if (
      !plan.summary ||
      plan.summary.trim().length === 0 ||
      plan.summary.length > 500
    ) {
      findings.push('Plan summary is missing or invalid.');
    }

    // Check 2: Validate the number of steps.
    if (
      !Array.isArray(plan.steps) ||
      plan.steps.length < 1 ||
      plan.steps.length > 15
    ) {
      findings.push(
        'Plan must contain between 1 and 15 steps.',
      );
    }

    // Check 3: Validate sequential step positions.
    if (
      Array.isArray(plan.steps) &&
      !plan.steps.every(
        (step, index) => step.position === index + 1,
      )
    ) {
      findings.push(
        'Plan steps must be numbered sequentially.',
      );
    }

    return {
      status: findings.length === 0 ? 'passed' : 'failed',
      findings,
    };
  }
}
