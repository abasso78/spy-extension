import { StorageKey } from "../consts";

let cachedPatterns: string[] | null = null;
let initialized = false;

async function loadPatterns(): Promise<string[]> {
  const result = await chrome.storage.local.get([StorageKey.SITES]);
  return result[StorageKey.SITES] || [];
}

export async function initSiteFilters() {
  if (initialized) return;
  cachedPatterns = await loadPatterns();
  initialized = true;

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[StorageKey.SITES]) {
      cachedPatterns = changes[StorageKey.SITES].newValue || [];
    }
  });
}

function matchStructured(url: string, raw: string): boolean {
  const rawTrim = (raw || "").trim();
  if (!rawTrim) return false;
  if (rawTrim === "<all_urls>") return true;

  let schemePart: string | null = null;
  let hostPart: string | null = null;
  let pathPart: string = "/*";

  if (rawTrim.includes("://")) {
    const [schemeRaw, restRaw] = rawTrim.split("://", 2);
    schemePart = schemeRaw || "*";
    const slashIdx = restRaw.indexOf("/");
    if (slashIdx >= 0) {
      hostPart = restRaw.slice(0, slashIdx) || "*";
      pathPart = restRaw.slice(slashIdx) || "/*";
    } else {
      hostPart = restRaw || "*";
      pathPart = "/*";
    }
  } else {
    schemePart = "*";
    hostPart = rawTrim;
    pathPart = "/*";
  }

  if (hostPart && !hostPart.startsWith("*.") && !hostPart.includes("*")) {
    hostPart = `*.${hostPart}`;
  }

  try {
    const u = new URL(url);
    if (schemePart && schemePart !== "*") {
      const schemeNormalized = schemePart.replace(/:$/, "");
      if (u.protocol.replace(/:$/, "") !== schemeNormalized) return false;
    }

    if (hostPart && hostPart !== "*") {
      if (hostPart.startsWith("*.")) {
        const base = hostPart.slice(2);
        if (u.hostname === base) {
        } else if (!u.hostname.endsWith(`.${base}`)) {
          return false;
        }
      } else if (hostPart.includes("*")) {
        const cleaned = hostPart.replace(/\*/g, "");
        if (!u.hostname.includes(cleaned)) return false;
      } else {
        if (u.hostname !== hostPart) return false;
      }
    }

    if (pathPart && pathPart !== "/*") {
      const prefix = pathPart.replace(/\*+$/, "");
      if (!u.pathname.startsWith(prefix)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

export async function matchesSiteFilters(url: string): Promise<boolean> {
  if (!url) return false;
  const patterns = cachedPatterns ?? (await loadPatterns());
  if (!patterns || patterns.length === 0) return true; // if none defined, allow
  for (const p of patterns) {
    if (matchStructured(url, p)) return true;
  }
  return false;
}

export async function getSiteFilters(): Promise<string[]> {
  return cachedPatterns ?? (await loadPatterns());
}
