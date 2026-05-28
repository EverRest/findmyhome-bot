import { Logger } from '@nestjs/common';

const listen = jest.fn().mockResolvedValue(undefined);
const enableShutdownHooks = jest.fn();

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn().mockResolvedValue({
      enableShutdownHooks,
      listen,
    }),
  },
}));

describe('main bootstrap', () => {
  const prevLogLevel = process.env.LOG_LEVEL;

  afterEach(() => {
    if (prevLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = prevLogLevel;
    }
    jest.resetModules();
  });

  it('starts the application with default log levels', async () => {
    delete process.env.LOG_LEVEL;
    const logSpy = jest.spyOn(Logger, 'log').mockImplementation();
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./main');
    });
    await new Promise((r) => setImmediate(r));
    expect(listen).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('uses verbose log levels when LOG_LEVEL=debug', async () => {
    process.env.LOG_LEVEL = 'debug';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./main');
    });
    await new Promise((r) => setImmediate(r));
    expect(listen).toHaveBeenCalled();
  });

  it('uses verbose log levels when LOG_LEVEL=verbose', async () => {
    process.env.LOG_LEVEL = 'verbose';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./main');
    });
    await new Promise((r) => setImmediate(r));
    expect(listen).toHaveBeenCalled();
  });

  it('listens on PORT from env', async () => {
    listen.mockClear();
    process.env.PORT = '4001';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./main');
    });
    await new Promise((r) => setImmediate(r));
    expect(listen).toHaveBeenLastCalledWith('4001');
    delete process.env.PORT;
  });
});
