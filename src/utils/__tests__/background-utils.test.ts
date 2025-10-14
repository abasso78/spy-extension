import { StorageKey } from '../../consts';

// We'll import background-utils after setting up globals since it throws when window is defined.

// Mock simpleSet/simplePrepend used by background-utils
jest.mock('../shared-utils', () => ({
  simpleSet: jest.fn(async (k: any, v: any) => {
    // store into a local map for assertions
    (global as any).__TEST_STORAGE = (global as any).__TEST_STORAGE || {};
    (global as any).__TEST_STORAGE[k] = v;
  }),
  simplePrepend: jest.fn(async (k: any, v: any) => {
    (global as any).__TEST_STORAGE = (global as any).__TEST_STORAGE || {};
    const cur = (global as any).__TEST_STORAGE[k] || [];
    (global as any).__TEST_STORAGE[k] = [v, ...cur].slice(0, 10);
  }),
  writeLog: jest.fn(async () => {}),
  contextData: jest.requireActual('../shared-utils').contextData,
}));

describe('background-utils', () => {
  beforeEach(() => {
    (global as any).__TEST_STORAGE = {};
  // Ensure module thinks it's running outside a page
  delete (global as any).window;
    (global as any).chrome = {
      runtime: { getURL: (s: string) => `chrome-extension://extid${s}` },
      tabs: {
        query: jest.fn(async (q: any) => [
          { id: 1, url: 'https://example.com', favIconUrl: '', title: 'Example', active: false, pinned: false, audible: false, status: 'complete' },
        ]),
        update: jest.fn(async () => {}),
      },
      cookies: { getAll: jest.fn(async () => [{ domain: '.example.com', path: '/', name: 'a' }]) },
      history: { search: jest.fn(async () => [{ id: '1', url: 'https://example.com/page' }]) },
    };

  // We'll override matchesSiteFilters directly when needed in tests
  });

  test('captureCookies stores filtered cookies via simpleSet', async () => {
    // Replace matchesSiteFilters with a working function and import bg after globals set
    (require('../site-filters') as any).matchesSiteFilters = async () => true;
    const bg = await import('../background-utils');
    await bg.captureCookies();
    const stored = (global as any).__TEST_STORAGE[StorageKey.COOKIES];
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBeGreaterThanOrEqual(0);
  });

  test('captureHistory stores filtered history via simpleSet', async () => {
    (require('../site-filters') as any).matchesSiteFilters = async () => true;
    const bg = await import('../background-utils');
    await bg.captureHistory();
    const stored = (global as any).__TEST_STORAGE[StorageKey.HISTORY];
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBeGreaterThanOrEqual(0);
  });
});
