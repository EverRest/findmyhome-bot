import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const logLevels =
    process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'verbose'
      ? (['log', 'error', 'warn', 'debug', 'verbose'] as const)
      : (['log', 'error', 'warn'] as const);

  const app = await NestFactory.create(AppModule, {
    logger: [...logLevels],
  });
  app.enableShutdownHooks();
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`FindMyHome listening on :${port}`, 'Bootstrap');
}
void bootstrap();
