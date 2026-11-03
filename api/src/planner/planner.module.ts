import { Module } from '@nestjs/common';

import { PlannerService } from './planner.service.js';
import { ProviderAdaptersModule } from '../provider-adapters/provider-adapters.module.js';

@Module({
  imports: [ProviderAdaptersModule],

  providers: [PlannerService],

  exports: [PlannerService],
})
export class PlannerModule {}