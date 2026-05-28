import {
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PipelineStatusService } from '../application/pipeline-status.service';
import { RunDailyPipelineUseCase } from '../application/run-daily-pipeline.use-case';

@Controller('pipeline')
export class PipelineController {
  constructor(
    private readonly runPipeline: RunDailyPipelineUseCase,
    private readonly status: PipelineStatusService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  getStatus() {
    return this.status.getStatus();
  }

  @Post('run')
  run(@Headers('x-api-key') apiKey?: string) {
    this.assertApiKey(apiKey);
    return this.runPipeline.execute();
  }

  /** Same as run but always logs preview (use with PIPELINE_DRY_RUN=true) */
  @Post('dry-run')
  dryRun(@Headers('x-api-key') apiKey?: string) {
    this.assertApiKey(apiKey);
    return this.runPipeline.execute();
  }

  private assertApiKey(apiKey?: string): void {
    const expected = this.config.get<string>('PIPELINE_API_KEY');
    if (expected && apiKey !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
