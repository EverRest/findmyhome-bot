import { Controller, Get, Post } from '@nestjs/common';
import { PipelineStatusService } from '../application/pipeline-status.service';
import { RunDailyPipelineUseCase } from '../application/run-daily-pipeline.use-case';

@Controller('pipeline')
export class PipelineController {
  constructor(
    private readonly runPipeline: RunDailyPipelineUseCase,
    private readonly status: PipelineStatusService,
  ) {}

  @Get('status')
  getStatus() {
    return this.status.getStatus();
  }

  @Post('run')
  run() {
    return this.runPipeline.execute();
  }

  /** Same as run but always logs preview (use with PIPELINE_DRY_RUN=true) */
  @Post('dry-run')
  dryRun() {
    return this.runPipeline.execute();
  }
}
