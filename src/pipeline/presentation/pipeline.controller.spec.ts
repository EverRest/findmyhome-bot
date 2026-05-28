import { UnauthorizedException } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { mockConfig } from '../../../test/helpers/test-utils';

describe('PipelineController', () => {
  const runPipeline = { execute: jest.fn().mockResolvedValue({ runId: '1' }) };
  const status = { getStatus: jest.fn().mockResolvedValue({ ok: true }) };
  const controller = new PipelineController(
    runPipeline as never,
    status as never,
    mockConfig({ PIPELINE_API_KEY: 'secret' }),
  );

  it('getStatus', async () => {
    await expect(controller.getStatus()).resolves.toEqual({ ok: true });
  });

  it('run with valid api key', async () => {
    await expect(controller.run('secret')).resolves.toEqual({ runId: '1' });
  });

  it('dryRun with valid api key', async () => {
    await expect(controller.dryRun('secret')).resolves.toEqual({ runId: '1' });
  });

  it('rejects invalid api key', () => {
    expect(() => controller.run('wrong')).toThrow(UnauthorizedException);
    expect(() => controller.dryRun('wrong')).toThrow(UnauthorizedException);
  });

  it('allows run when api key not configured', async () => {
    const open = new PipelineController(
      runPipeline as never,
      status as never,
      mockConfig({ PIPELINE_API_KEY: undefined }),
    );
    await expect(open.run()).resolves.toEqual({ runId: '1' });
  });
});
