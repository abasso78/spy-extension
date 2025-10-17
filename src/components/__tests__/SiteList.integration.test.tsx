import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import SiteList from '../SiteList';
import { initSiteFilters, getSiteFilters } from '../../utils/site-filters';
import { clear } from '../../utils/shared-utils';
import { StorageKey } from '../../consts';

function waitForTick() {
  return new Promise((res) => setTimeout(res, 0));
}

describe('SiteList UI + storage integration', () => {
  let storage: Record<string, any> = {};
  let listeners: Array<(changes: any, area: string) => void> = [];
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    storage = {};
    listeners = [];

    (global as any).chrome = {
      storage: {
        local: {
          get: jest.fn(async (keys: any) => {
            if (Array.isArray(keys)) {
              const res: Record<string, any> = {};
              for (const k of keys) res[k] = storage[k];
              return res;
            }
            return { [keys]: storage[keys] };
          }),
          set: jest.fn(async (items: Record<string, any>) => {
            const changes: Record<string, any> = {};
            for (const k of Object.keys(items)) {
              const oldV = storage[k];
              storage[k] = items[k];
              changes[k] = { oldValue: oldV, newValue: storage[k] };
            }
            // notify listeners
            for (const l of listeners) l(changes, 'local');
          }),
          clear: jest.fn(async () => {
            const changes: Record<string, any> = {};
            for (const k of Object.keys(storage)) {
              changes[k] = { oldValue: storage[k], newValue: undefined };
            }
            for (const k of Object.keys(storage)) delete storage[k];
            for (const l of listeners) l(changes, 'local');
          }),
        },
        onChanged: {
          addListener: jest.fn((cb: any) => {
            listeners.push(cb);
          }),
        },
      },
    };

    // Prepopulate SITES
    storage[StorageKey.SITES] = ['https://example.com/*'];

    // create DOM container
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
    jest.clearAllMocks();
  });

  test('UI and cached filters stay consistent after clear', async () => {
    // Initialize the site-filters module so it registers onChanged and caches patterns
    await initSiteFilters();

    // Mount SiteList
    let root: any = null;
    await act(async () => {
      root = createRoot(container!);
      root.render(<SiteList />);
      await waitForTick();
    });

    // UI should show the prepopulated site
    expect(container!.textContent).toContain('https://example.com/*');

    // Trigger clear() which should preserve SITES and emit onChanged notifications.
    await act(async () => {
      await clear();
      // Let any async listeners/processes run
      await waitForTick();
    });

    // Storage should still have SITES restored
    expect((global as any).chrome.storage.local.get([StorageKey.SITES])).resolves.toBeDefined();

    // The cached site filters (from site-filters module) should match storage
    const cached = await getSiteFilters();
    expect(Array.isArray(cached)).toBe(true);
    expect(cached.length).toBe(1);
    expect(cached[0]).toBe('https://example.com/*');

    // UI should still show the site in the list
    expect(container!.textContent).toContain('https://example.com/*');

    // cleanup react root
    await act(async () => {
      root.unmount();
      await waitForTick();
    });
  });
});
