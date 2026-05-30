import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailIngestionModule } from '../email-ingestion/email-ingestion.module';
import { FacebookIngestionModule } from '../facebook-ingestion/facebook-ingestion.module';
import { NotificationModule } from '../notification/notification.module';
import { ScoringModule } from '../scoring/scoring.module';
import { ListingModule } from '../listing/listing.module';
import { RunDailyPipelineUseCase } from './application/run-daily-pipeline.use-case';
import { PipelineStatusService } from './application/pipeline-status.service';
import { PipelineController } from './presentation/pipeline.controller';
import { PipelineApiKeyMiddleware } from './presentation/pipeline-api-key.middleware';
import { PipelineCron } from './presentation/pipeline.cron';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ListingModule,
    EmailIngestionModule,
    FacebookIngestionModule,
    ScoringModule,
    NotificationModule,
  ],
  controllers: [PipelineController],
  providers: [
    RunDailyPipelineUseCase,
    PipelineStatusService,
    PipelineCron,
    PipelineApiKeyMiddleware,
  ],
  exports: [RunDailyPipelineUseCase],
})
export class PipelineModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(PipelineApiKeyMiddleware)
      .forRoutes(
        { path: 'pipeline/run', method: RequestMethod.POST },
        { path: 'pipeline/dry-run', method: RequestMethod.POST },
      );
  }
}
