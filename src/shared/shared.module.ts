import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CriteriaLoaderService } from './infrastructure/criteria-loader.service';
import { PrismaService } from './infrastructure/prisma.service';
import { StepLoggerService } from './infrastructure/step-logger.service';
import { HealthController } from './presentation/health.controller';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'secrets/.env'],
    }),
  ],
  controllers: [HealthController],
  providers: [PrismaService, CriteriaLoaderService, StepLoggerService],
  exports: [
    PrismaService,
    CriteriaLoaderService,
    StepLoggerService,
    ConfigModule,
  ],
})
export class SharedModule {}
