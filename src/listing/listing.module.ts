import { Module } from '@nestjs/common';
import { LISTING_REPOSITORY } from './domain/listing.repository.port';
import { PrismaListingRepository } from './infrastructure/prisma-listing.repository';

@Module({
  providers: [
    {
      provide: LISTING_REPOSITORY,
      useClass: PrismaListingRepository,
    },
  ],
  exports: [LISTING_REPOSITORY],
})
export class ListingModule {}
