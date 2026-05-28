import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { StepLoggerService } from './step-logger.service';
import { SearchCriteria } from './criteria.types';

@Injectable()
export class CriteriaLoaderService implements OnModuleInit {
  private readonly log;
  private criteria!: SearchCriteria;

  constructor(
    private readonly config: ConfigService,
    stepLogger: StepLoggerService,
  ) {
    this.log = stepLogger.create(CriteriaLoaderService.name);
  }

  onModuleInit(): void {
    const path =
      this.config.get<string>('CRITERIA_PATH') ?? './config/criteria.yaml';
    const raw = readFileSync(path, 'utf8');
    this.criteria = yaml.load(raw) as SearchCriteria;
    this.log.step('config', 'Criteria loaded', {
      path,
      zones: this.criteria.hard.zones?.map((z) => z.name) ?? [],
      rent: [this.criteria.hard.rentMinEur, this.criteria.hard.rentMaxEur],
      area: [this.criteria.hard.areaMinSqm, this.criteria.hard.areaMaxSqm],
    });
  }

  get(): SearchCriteria {
    return this.criteria;
  }
}
