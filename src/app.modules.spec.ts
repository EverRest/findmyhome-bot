import { AppModule } from './app.module';
import { EmailIngestionModule } from './email-ingestion/email-ingestion.module';
import { ListingModule } from './listing/listing.module';
import { NotificationModule } from './notification/notification.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { ScoringModule } from './scoring/scoring.module';
import { SharedModule } from './shared/shared.module';
import { GMAIL_PORT } from './email-ingestion/domain/gmail.port';
import { LISTING_PARSER_REGISTRY } from './email-ingestion/domain/listing-parser.port';
import { LISTING_REPOSITORY } from './listing/domain/listing.repository.port';
import { TELEGRAM_PORT } from './notification/domain/telegram.port';

describe('Nest modules', () => {
  it.each([
    AppModule,
    SharedModule,
    ListingModule,
    EmailIngestionModule,
    ScoringModule,
    NotificationModule,
    PipelineModule,
  ])('loads module class', (Mod) => {
    expect(Mod).toBeDefined();
  });

  it('exports DI tokens', () => {
    expect(GMAIL_PORT).toBeDefined();
    expect(LISTING_PARSER_REGISTRY).toBeDefined();
    expect(LISTING_REPOSITORY).toBeDefined();
    expect(TELEGRAM_PORT).toBeDefined();
  });
});
