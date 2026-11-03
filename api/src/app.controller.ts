import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { AppService } from './app.service.js';
import type { TaskPlanRecord } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('api/tasks')
  createTask(@Body() body: unknown) {
    return this.appService.createTask(body);
  }

  @Get('api/tasks')
  listTasks() {
    return this.appService.listTasks();
  }

  @Get('api/tasks/:id')
  getTask(@Param('id') id: string) {
    return this.appService.getTask(id);
  }

  // Rule-based planning
  @Post('api/tasks/:id/plan')
  createPlan(
    @Param('id') id: string,
  ): Promise<TaskPlanRecord> {
    return this.appService.createPlan(id);
  }

  // Retrieve latest plan
  @Get('api/tasks/:id/plan')
  getLatestPlan(
    @Param('id') id: string,
  ): Promise<TaskPlanRecord> {
    return this.appService.getLatestPlan(id);
  }

  // AI-powered planning using Groq
  @Post('api/tasks/:id/ai-plan')
  createAiPlan(
    @Param('id') id: string,
  ): Promise<TaskPlanRecord> {
    return this.appService.createAiPlan(id);
  }
}