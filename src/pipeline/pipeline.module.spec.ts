import { RequestMethod } from '@nestjs/common';
import { PipelineModule } from './pipeline.module';
import { PipelineApiKeyMiddleware } from './presentation/pipeline-api-key.middleware';

describe('PipelineModule', () => {
  it('applies api key middleware to pipeline post routes', () => {
    const forRoutes = jest.fn();
    const apply = jest.fn().mockReturnValue({ forRoutes });
    const module = new PipelineModule();
    module.configure({ apply });

    expect(apply).toHaveBeenCalledWith(PipelineApiKeyMiddleware);
    expect(forRoutes).toHaveBeenCalledWith(
      { path: 'pipeline/run', method: RequestMethod.POST },
      { path: 'pipeline/dry-run', method: RequestMethod.POST },
    );
  });
});
