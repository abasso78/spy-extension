const el = document.getElementById('message');
let clicks = 0;

function goToOptions() {
  try {
    // The extension's options entry now points to this page
    const optionsUrl = chrome.runtime.getURL('options/index.html');
    window.location.href = optionsUrl;
  } catch (e) {
    // fallback: try navigating to relative options path
    window.location.href = './options/index.html';
  }
}

if (el) {
  el.addEventListener('click', () => {
    clicks++;
    if (clicks >= 5) {
      goToOptions();
      clicks = 0;
    }
  });
}

// Memory resources UI (resolved lazily to support tests that create DOM before import)
let memTotal: HTMLElement | null = null;
let memAvailable: HTMLElement | null = null;
let memUsed: HTMLElement | null = null;

function refreshMemoryElements() {
  memTotal = document.getElementById('mem-total');
  memAvailable = document.getElementById('mem-available');
  memUsed = document.getElementById('mem-used');
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  const units = ['B','KB','MB','GB','TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

async function updateMemoryInfo(): Promise<void> {
  try {
    // refresh elements each update in case DOM was created after module load
    refreshMemoryElements();
    const chromeAny = (window as any).chrome;
    // Prefer chrome.system.memory if available in the extension context
    if (chromeAny && chromeAny.system && chromeAny.system.memory && chromeAny.system.memory.getInfo) {
      chromeAny.system.memory.getInfo((info: any) => {
        if (info && typeof info.capacity === 'number') {
          const total: number = info.capacity; // bytes
          const avail: number = typeof info.availableCapacity === 'number' ? info.availableCapacity : total;
          const used = Math.max(0, total - avail);
          if (memTotal) memTotal.textContent = formatBytes(total);
          if (memAvailable) memAvailable.textContent = formatBytes(avail);
          if (memUsed) memUsed.textContent = total > 0 ? `${Math.round(100 * used / total)}%` : '—';
        }
      });
      return;
    }

    // Fallback: use performance.memory if available (Chrome only, not guaranteed)
    const perfMem: any = (performance as any).memory;
    if (perfMem) {
      const total = typeof perfMem.totalJSHeapSize === 'number' ? perfMem.totalJSHeapSize : null;
      const used = typeof perfMem.usedJSHeapSize === 'number' ? perfMem.usedJSHeapSize : null;
      if (memTotal) memTotal.textContent = total ? formatBytes(total) : '—';
      if (memAvailable) memAvailable.textContent = '—';
      if (memUsed) memUsed.textContent = (used && total) ? `${Math.round(100 * used / total)}%` : '—';
      return;
    }

    // Otherwise, show unknown
    if (memTotal) memTotal.textContent = '—';
    if (memAvailable) memAvailable.textContent = '—';
    if (memUsed) memUsed.textContent = '—';
  } catch (e) {
    // ignore errors, keep UI stable
  }
}

// Poll every 5s by default; expose controls for testing
const POLL_MS = 5000;
let pollHandle: number | null = null;

export function startPolling(intervalMs = POLL_MS) {
  if (pollHandle != null) return; // already running
  // run immediately then schedule
  updateMemoryInfo();
  pollHandle = window.setInterval(updateMemoryInfo, intervalMs);
}

export function stopPolling() {
  if (pollHandle == null) return;
  clearInterval(pollHandle);
  pollHandle = null;
}

// Start/stop based on page visibility
function handleVisibility() {
  if (document.hidden) {
    stopPolling();
  } else {
    startPolling();
  }
}

document.addEventListener('visibilitychange', handleVisibility);

// start immediately if visible (but avoid auto-start during Jest tests so tests can control timing)
const isJest = typeof process !== 'undefined' && (process as any).env && (process as any).env.JEST_WORKER_ID;
if (!isJest && !document.hidden) startPolling();
