import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { ListingModule } from '../listing/listing.module';
import { FetchAndParseFacebookPostsUseCase } from './application/fetch-and-parse-facebook-posts.use-case';
import { FACEBOOK_GROUPS_PORT } from './domain/facebook-groups.port';
import { FacebookRentalPostParser } from './infrastructure/facebook-rental-post.parser';
import { NoopFacebookGroupsAdapter } from './infrastructure/noop-facebook-groups.adapter';
import { PlaywrightFacebookGroupsAdapter } from './infrastructure/playwright-facebook-groups.adapter';

@Module({
  imports: [ListingModule],
  providers: [
    FacebookRentalPostParser,
    PlaywrightFacebookGroupsAdapter,
    NoopFacebookGroupsAdapter,
    FetchAndParseFacebookPostsUseCase,
    {
      provide: FACEBOOK_GROUPS_PORT,
      useFactory: (
        config: ConfigService,
        playwright: PlaywrightFacebookGroupsAdapter,
        noop: NoopFacebookGroupsAdapter,
      ) => {
        if (config.get<string>('FACEBOOK_INGESTION_ENABLED') !== 'true') {
          return noop;
        }
        const p =
          config.get<string>('FACEBOOK_STORAGE_STATE_PATH') ??
          './secrets/facebook-storage.json';
        if (!existsSync(resolve(process.cwd(), p))) {
          return noop;
        }
        return playwright;
      },
      inject: [
        ConfigService,
        PlaywrightFacebookGroupsAdapter,
        NoopFacebookGroupsAdapter,
      ],
    },
  ],
  exports: [FetchAndParseFacebookPostsUseCase, FACEBOOK_GROUPS_PORT],
})
export class FacebookIngestionModule {}
