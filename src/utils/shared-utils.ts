// Lightweight, dependency-free UUID v4 generator.
// Prefer the built-in crypto.randomUUID when available, then crypto.getRandomValues,
// then Node's crypto.randomBytes, finally fall back to Math.random.
declare const require: any;
function uuidv4(): string {
  try {
    if (typeof globalThis !== "undefined" && (globalThis as any).crypto) {
      const c = (globalThis as any).crypto;
      if (typeof c.randomUUID === "function") return c.randomUUID();
      if (typeof c.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        c.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes as unknown as number[])
          .map((b) => (b + 256).toString(16).slice(1))
          .join("");
        return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
      }
    }
    // Node.js fallback
    if (typeof require !== "undefined") {
      try {
        const nodeCrypto = require("crypto");
        if (nodeCrypto && typeof nodeCrypto.randomBytes === "function") {
          const buf = nodeCrypto.randomBytes(16);
          buf[6] = (buf[6] & 0x0f) | 0x40;
          buf[8] = (buf[8] & 0x3f) | 0x80;
          const hex = Array.from(buf as unknown as number[])
            .map((b: number) => (b + 256).toString(16).slice(1))
            .join("");
          return hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
  // Last resort (not cryptographically strong) — fine for client-side identifiers in this app
  const rnd = () => Math.floor((1 + Math.random()) * 0x100).toString(16).substring(1);
  return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}
import { StorageKey } from "../consts";
import { IActivityLogEntry } from "../interfaces";

// Exported so tests can assert configured caps
export const DEFAULT_MAX_LENGTH = 500;

export const KEY_MAX_LENGTHS: Record<string, number | null> = {
  [StorageKey.SCREENSHOT_LOG]: 250,
  [StorageKey.COOKIES]: 250,
  [StorageKey.HISTORY]: 500,
  [StorageKey.LOG]: 500,
  [StorageKey.KEY_LOG]: 500,
  [StorageKey.NAVIGATION_LOG]: 500,
  [StorageKey.REQUEST_BODY_LOG]: 500,
  [StorageKey.INPUTS]: 500,
  [StorageKey.CLIPBOARD_LOG]: 500,
  [StorageKey.GEOLOCATION_HISTORY]: 500,
  [StorageKey.SITES]: 250,
  [StorageKey.NOTES]: 500,
};

// Per-key byte caps (when present, eviction is performed by bytes rather than item count)
// Values are maximum approximate bytes to retain for array-valued keys.
export const KEY_MAX_BYTES: Record<string, number | null> = {
  // Screenshots are stored with large base64 strings — use a byte cap to avoid blowing quota
  [StorageKey.SCREENSHOT_LOG]: 2 * 1024 * 1024, // Max image size: 2 MB
  // Other keys may rely on count-based caps; leave as null
  [StorageKey.COOKIES]: null,
  [StorageKey.HISTORY]: null,
  [StorageKey.LOG]: null,
  [StorageKey.KEY_LOG]: null,
  [StorageKey.NAVIGATION_LOG]: null,
  [StorageKey.REQUEST_BODY_LOG]: null,
  [StorageKey.INPUTS]: null,
  [StorageKey.CLIPBOARD_LOG]: null,
  [StorageKey.GEOLOCATION_HISTORY]: null,
  [StorageKey.SITES]: null,
  [StorageKey.NOTES]: null,
};

export async function simpleHas(key: StorageKey) {
  return (await simpleGet<any>(key)) !== undefined;
}

export async function simpleGet<T>(
  key: StorageKey,
  defaultValue?: T
): Promise<T> {
  const result = await chrome.storage.local.get([key]);
  return result[key] || defaultValue;
}

export async function simpleSet<T>(key: StorageKey, value: T) {
  // If the value is an array, trim it to a sane maximum length or size before storing.
  let finalValue: any = value;
  if (Array.isArray(value)) {
    // Prefer byte-counted eviction if configured for this key
    const byteCap = KEY_MAX_BYTES[key];
    if (byteCap !== null && byteCap !== undefined && typeof byteCap === "number") {
      // Compute approximate byte sizes for entries (JSON-serialized UTF-8)
      // Compute approximate byte sizes for entries (JSON-serialized UTF-8).
      // Prefer TextEncoder in browser-like environments. As a fallback we
      // use a small UTF-8 byte length function (works in Node and browser)
      // that does not reference the Node `Buffer` global so bundlers won't
      // auto-inject Node polyfills.
      const approxByteLength = (s: string) => {
        if (typeof (globalThis as any).TextEncoder !== "undefined") {
          return new (globalThis as any).TextEncoder().encode(s).length;
        }
        // Fallback: compute UTF-8 byte length by iterating code points.
        let bytes = 0;
        for (let i = 0; i < s.length; i++) {
          let code = s.charCodeAt(i);
          // If this is a high surrogate, and there's a following low surrogate,
          // combine them to a single code point.
          if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
            const next = s.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
              code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
              i++; // consumed low surrogate
            }
          }
          if (code <= 0x7f) {
            bytes += 1;
          } else if (code <= 0x7ff) {
            bytes += 2;
          } else if (code <= 0xffff) {
            bytes += 3;
          } else {
            bytes += 4;
          }
        }
        return bytes;
      };
      // Export small helper for tests (keeps parity with previous Buffer-based tests)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (exports as any).approxByteLength = approxByteLength;
      const computeBytes = (str: string) => approxByteLength(str);
      const items = value as unknown as any[];
      // Start from the end (most recent) and include items until we exceed byteCap
      const kept: any[] = [];
      let total = 0;
      for (let i = items.length - 1; i >= 0; --i) {
        try {
          const str = typeof items[i] === "string" ? items[i] : JSON.stringify(items[i]);
          const size = computeBytes(str);
          if (total + size > byteCap) break;
          kept.unshift(items[i]);
          total += size;
        } catch (e) {
          // If serialization fails, skip the item
        }
      }
      finalValue = kept;
    } else {
      const cap = KEY_MAX_LENGTHS[key] ?? DEFAULT_MAX_LENGTH;
      if (cap !== null && cap !== undefined && typeof cap === "number") {
        finalValue = (value as unknown as any[]).slice(-cap);
      }
    }
  }

  await chrome.storage.local.set({
    [key]: finalValue,
  });
}

export async function simplePrepend<T>(
  key: StorageKey,
  value: T,
  maxLength: number = 500
) {
  const current: T[] = await simpleGet<T[]>(key, []);
  await simpleSet<T[]>(key, [value, ...current].slice(0, maxLength));
}

export async function simpleAppend<T>(
  key: StorageKey,
  value: T,
  maxLength: number = 500
) {
  const current: T[] = await simpleGet<T[]>(key, []);
  await simpleSet<T[]>(key, [...current, value].slice(-maxLength));
}

export async function writeLog(message: string) {
  const newLog: IActivityLogEntry = {
    message,
    ...contextData(),
  };

  await simplePrepend<IActivityLogEntry>(StorageKey.LOG, newLog);
}

export async function clear() {
  chrome.storage.local.clear();
}

export async function watch<T>(
  key: StorageKey,
  callback: (storageChange: chrome.storage.StorageChange) => void
) {
  chrome.storage.onChanged.addListener((changes) => {
    for (let [k, v] of Object.entries(changes)) {
      if (k === key) {
        callback(v);
      }
    }
  });

  callback({ newValue: await simpleGet<T>(key) });
}

export function contextData() {
  return {
    uuid: uuidv4(),
    timestamp: new Date().toISOString(),
  };
}

export async function exportAllData(): Promise<Blob> {
  // Read all known storage keys and return a Blob containing JSON.
  // Filter array-valued keys so exported entries respect the current
  // site filters (if configured).
  const keys = Object.values(StorageKey) as string[];
  const items = await chrome.storage.local.get(keys);

  // Lazy-import matchesSiteFilters to avoid circular-init ordering issues
  let matches: ((url: string) => Promise<boolean>) | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    matches = require("./site-filters").matchesSiteFilters;
  } catch (e) {
    matches = null;
  }

  for (const k of keys) {
    const val = items[k];
    if (!Array.isArray(val)) continue;

    const arr = val as any[];
    const out: any[] = [];

    for (const entry of arr) {
      try {
        // Primitive entries: include as-is (no URL to filter on)
        if (
          entry === null ||
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean"
        ) {
          out.push(entry);
          continue;
        }

        // If there is a clear url field, use it
        if (entry && typeof entry === "object" && typeof entry.url === "string") {
          if (!matches) {
            out.push(entry);
          } else if (await matches(entry.url)) {
            out.push(entry);
          }
          continue;
        }

        // If this looks like a webRequest stored item: check request.url/documentUrl/initiator
        if (entry && typeof entry === "object" && entry.request && typeof entry.request === "object") {
          const r = entry.request as any;
          const candidate = r.url || r.documentUrl || r.initiator || r.originUrl || null;
          if (!candidate) {
            // No URL information available — include conservatively
            out.push(entry);
          } else if (!matches) {
            out.push(entry);
          } else if (await matches(candidate)) {
            out.push(entry);
          }
          continue;
        }

        // Cookies: reconstruct URL from domain/path when present
        if (entry && typeof entry === "object" && typeof entry.domain === "string") {
          try {
            const domain = entry.domain.replace(/^\./, "");
            const path = entry.path || "/";
            const candidate = `https://${domain}${path}`;
            if (!matches) {
              out.push(entry);
            } else if (await matches(candidate)) {
              out.push(entry);
            }
            continue;
          } catch (e) {
            out.push(entry);
            continue;
          }
        }

        // Fallback: include entries we can't classify
        out.push(entry);
      } catch (e) {
        // On any failure while filtering, include the entry so export remains useful
        out.push(entry);
      }
    }

    items[k] = out;
  }

  const json = JSON.stringify(items, null, 2);
  return new Blob([json], { type: "application/json" });
}
