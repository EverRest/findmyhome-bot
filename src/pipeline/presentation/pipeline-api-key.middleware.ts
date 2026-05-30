import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class PipelineApiKeyMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const expected = this.config.get<string>('PIPELINE_API_KEY');
    const apiKey = req.header('x-api-key');
    if (expected && apiKey !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }
    next();
  }
}
