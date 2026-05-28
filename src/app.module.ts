import { Module } from '@nestjs/common';
import { EmailIngestionModule } from './email-ingestion/email-ingestion.module';
import { FacebookIngestionModule } from './facebook-ingestion/facebook-ingestion.module';
import { ListingModule } from './listing/listing.module';
import { NotificationModule } from './notification/notification.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ScoringModule } from './scoring/scoring.module';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    SharedModule,
    ListingModule,
    EmailIngestionModule,
    FacebookIngestionModule,
    ScoringModule,
    NotificationModule,
    PipelineModule,
  ],
})
export class AppModule {}
