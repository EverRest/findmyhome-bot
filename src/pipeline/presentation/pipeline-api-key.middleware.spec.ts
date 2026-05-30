import { UnauthorizedException } from '@nestjs/common';
import { PipelineApiKeyMiddleware } from './pipeline-api-key.middleware';
import { mockConfig } from '../../../test/helpers/test-utils';

describe('PipelineApiKeyMiddleware', () => {
  const next = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  function run(apiKey: string | undefined, configuredKey?: string) {
    const middleware = new PipelineApiKeyMiddleware(
      mockConfig({ PIPELINE_API_KEY: configuredKey }),
    );
    middleware.use(
      { header: (name: string) => (name === 'x-api-key' ? apiKey : undefined) },
      {} as never,
      next,
    );
  }

  it('calls next when api key matches', () => {
    run('secret', 'secret');
    expect(next).toHaveBeenCalled();
  });

  it('throws when api key is invalid', () => {
    expect(() => run('wrong', 'secret')).toThrow(UnauthorizedException);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows request when api key is not configured', () => {
    run(undefined, undefined);
    expect(next).toHaveBeenCalled();
  });
});
