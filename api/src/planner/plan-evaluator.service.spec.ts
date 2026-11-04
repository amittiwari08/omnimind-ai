import { beforeEach, describe, expect, it } from 'vitest';

import { PlanEvaluatorService } from './plan-evaluator.service.js';
import type { TaskPlanDraft } from './planner.service.js';

describe('PlanEvaluatorService', () => {
  let evaluator: PlanEvaluatorService;

  function createValidPlan(): TaskPlanDraft {
    return {
      summary: 'Build a website with responsive design.',
      steps: [
        {
          position: 1,
          title: 'Analyze Requirements',
          description: 'Understand the project requirements.',
          stepType: 'analysis',
        },
        {
          position: 2,
          title: 'Implement Website',
          description: 'Develop the required website.',
          stepType: 'implementation',
        },
      ],
    };
  }

  beforeEach(() => {
    evaluator = new PlanEvaluatorService();
  });

  it('should pass a valid plan', () => {
    const result = evaluator.evaluate(createValidPlan());

    expect(result.status).toBe('passed');
    expect(result.findings).toHaveLength(0);
  });

  it('should reject a plan with a missing summary', () => {
    const plan = createValidPlan();
    plan.summary = '';

    const result = evaluator.evaluate(plan);

    expect(result.status).toBe('failed');
    expect(result.findings).toContain(
      'Plan summary is missing or invalid.',
    );
  });

  it('should reject a plan with no steps', () => {
    const plan = createValidPlan();
    plan.steps = [];

    const result = evaluator.evaluate(plan);

    expect(result.status).toBe('failed');
    expect(result.findings).toContain(
      'Plan must contain between 1 and 15 steps.',
    );
  });

  it('should reject a plan with more than 15 steps', () => {
    const plan = createValidPlan();

    plan.steps = Array.from({ length: 16 }, (_, index) => ({
      position: index + 1,
      title: `Step ${index + 1}`,
      description: 'Perform the required operation.',
      stepType: 'implementation',
    }));

    const result = evaluator.evaluate(plan);

    expect(result.status).toBe('failed');
  });

  it('should reject incorrect step numbering', () => {
    const plan = createValidPlan();

    plan.steps[1].position = 5;

    const result = evaluator.evaluate(plan);

    expect(result.status).toBe('failed');
    expect(result.findings).toContain(
      'Plan steps must be numbered sequentially.',
    );
  });
});