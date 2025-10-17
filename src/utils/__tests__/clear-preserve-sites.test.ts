import { clear } from '../shared-utils';
import { StorageKey } from '../../consts';

// Minimal mock of chrome.storage.local used in other tests
const storage: Record<string, any> = {};

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
        Object.assign(storage, items);
      }),
      clear: jest.fn(async () => {
        for (const k of Object.keys(storage)) delete storage[k];
      }),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
};

describe('clear preserves site filters', () => {
  beforeEach(() => {
    for (const k of Object.keys(storage)) delete storage[k];
    jest.clearAllMocks();
  });

  test('clear restores SITES if present', async () => {
    storage[StorageKey.SITES] = ['example.com', '<all_urls>'];
    await clear();
    // After clear, SITES should be restored
    expect(storage[StorageKey.SITES]).toBeDefined();
    expect(Array.isArray(storage[StorageKey.SITES])).toBe(true);
    expect(storage[StorageKey.SITES].length).toBe(2);
    expect(storage[StorageKey.SITES][0]).toBe('example.com');
  });

  test('clear leaves SITES undefined if not present', async () => {
    await clear();
    expect(storage[StorageKey.SITES]).toBeUndefined();
  });
});
