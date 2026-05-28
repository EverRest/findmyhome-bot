import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('connects and disconnects', async () => {
    const service = new PrismaService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);
    await service.onModuleInit();
    await service.onModuleDestroy();
    expect(connect).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
