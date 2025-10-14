import { matchesSiteFilters, getSiteFilters, initSiteFilters } from '../site-filters';
import { StorageKey } from '../../consts';

describe('site-filters', () => {
  beforeEach(() => {
    // Setup a minimal chrome.storage.local mock per test, including onChanged
    (global as any).chrome = {
      storage: {
        local: {
          get: jest.fn(async (keys: any) => {
            // Simulate stored SITES list
            return { [StorageKey.SITES]: ['https://example.com/*', 'sub.example.org'] };
          }),
        },
        onChanged: {
          addListener: jest.fn(),
        },
      },
    };
  });

  test('matchesSiteFilters matches explicit https pattern', async () => {
    const ok = await matchesSiteFilters('https://example.com/path');
    expect(ok).toBe(true);
  });

  test('does not match different scheme when pattern has https', async () => {
    const ok = await matchesSiteFilters('http://example.com/path');
    expect(ok).toBe(false);
  });

  test('matches host-only pattern', async () => {
    const ok = await matchesSiteFilters('https://sub.example.org/abc');
    expect(ok).toBe(true);
  });

  test('getSiteFilters returns patterns after init', async () => {
    await initSiteFilters();
    const list = await getSiteFilters();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});
