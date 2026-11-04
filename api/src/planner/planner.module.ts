
import { Module } from '@nestjs/common';

import { PlannerService } from './planner.service.js';
import { PlanEvaluatorService } from './plan-evaluator.service.js';
import { ProviderAdaptersModule } from '../provider-adapters/provider-adapters.module.js';

@Module({
  imports: [ProviderAdaptersModule],

  providers: [
    PlannerService,
    PlanEvaluatorService,
  ],

  exports: [
    PlannerService,
    PlanEvaluatorService,
  ],
})
export class PlannerModule {}
