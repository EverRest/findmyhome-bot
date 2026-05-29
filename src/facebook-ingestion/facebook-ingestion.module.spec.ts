import { existsSync } from 'fs';
import { FACEBOOK_GROUPS_PORT } from './domain/facebook-groups.port';
import { FacebookIngestionModule } from './facebook-ingestion.module';
import { NoopFacebookGroupsAdapter } from './infrastructure/noop-facebook-groups.adapter';
import { PlaywrightFacebookGroupsAdapter } from './infrastructure/playwright-facebook-groups.adapter';
import { mockConfig } from '../../test/helpers/test-utils';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

const existsSyncMock = existsSync as jest.MockedFunction<typeof existsSync>;

type ProviderFactory = (
  config: ReturnType<typeof mockConfig>,
  playwright: PlaywrightFacebookGroupsAdapter,
  noop: NoopFacebookGroupsAdapter,
) => unknown;

function getFacebookGroupsFactory(): ProviderFactory {
  const providers: Array<{ provide: unknown; useFactory?: ProviderFactory }> =
    Reflect.getMetadata('providers', FacebookIngestionModule) ?? [];
  const factory = providers.find(
    (p) => p.provide === FACEBOOK_GROUPS_PORT,
  )?.useFactory;
  if (!factory) {
    throw new Error('FACEBOOK_GROUPS_PORT factory not found');
  }
  return factory;
}

describe('FacebookIngestionModule', () => {
  const playwright = {} as PlaywrightFacebookGroupsAdapter;
  const noop = new NoopFacebookGroupsAdapter();

  beforeEach(() => {
    jest.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  it('loads module class', () => {
    expect(FacebookIngestionModule).toBeDefined();
  });

  it('uses noop adapter when ingestion is disabled', () => {
    const port = getFacebookGroupsFactory()(
      mockConfig({ FACEBOOK_INGESTION_ENABLED: 'false' }),
      playwright,
      noop,
    );
    expect(port).toBe(noop);
  });

  it('uses noop adapter when storage state is missing', () => {
    existsSyncMock.mockReturnValue(false);
    const port = getFacebookGroupsFactory()(
      mockConfig({
        FACEBOOK_INGESTION_ENABLED: 'true',
        FACEBOOK_STORAGE_STATE_PATH: './secrets/facebook-storage.json',
      }),
      playwright,
      noop,
    );
    expect(port).toBe(noop);
  });

  it('uses playwright adapter when configured', () => {
    const port = getFacebookGroupsFactory()(
      mockConfig({
        FACEBOOK_INGESTION_ENABLED: 'true',
        FACEBOOK_STORAGE_STATE_PATH: './secrets/facebook-storage.json',
      }),
      playwright,
      noop,
    );
    expect(port).toBe(playwright);
  });
});
