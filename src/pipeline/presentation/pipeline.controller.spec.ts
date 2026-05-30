import { PipelineController } from './pipeline.controller';

describe('PipelineController', () => {
  const runPipeline = { execute: jest.fn().mockResolvedValue({ runId: '1' }) };
  const status = { getStatus: jest.fn().mockResolvedValue({ ok: true }) };
  const controller = new PipelineController(
    runPipeline as never,
    status as never,
  );

  it('getStatus', async () => {
    await expect(controller.getStatus()).resolves.toEqual({ ok: true });
  });

  it('run', async () => {
    await expect(controller.run()).resolves.toEqual({ runId: '1' });
  });

  it('dryRun', async () => {
    await expect(controller.dryRun()).resolves.toEqual({ runId: '1' });
  });
});
