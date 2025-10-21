import { startPolling, stopPolling } from '../memory-optimizer/memory-optimizer';

jest.useFakeTimers();

describe('memory-optimizer polling', () => {
  let memTotal: HTMLElement;
  let memAvailable: HTMLElement;
  let memUsed: HTMLElement;

  beforeEach(() => {
    // set up DOM
    document.body.innerHTML = `
      <div id="message">msg</div>
      <span id="mem-total">—</span>
      <span id="mem-available">—</span>
      <span id="mem-used">—</span>
    `;

    memTotal = document.getElementById('mem-total') as HTMLElement;
    memAvailable = document.getElementById('mem-available') as HTMLElement;
    memUsed = document.getElementById('mem-used') as HTMLElement;

    // mock chrome.system.memory
    (window as any).chrome = {
      system: {
        memory: {
          getInfo: (cb: any) => cb({ capacity: 8 * 1024 * 1024 * 1024, availableCapacity: 3 * 1024 * 1024 * 1024 })
        }
      }
    };

    // ensure document is visible
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });

  afterEach(() => {
    stopPolling();
    jest.clearAllTimers();
    delete (window as any).chrome;
    document.body.innerHTML = '';
  });

  test('startPolling updates memory fields', () => {
    startPolling(10); // rapid polling for test
    // first immediate update scheduled synchronously in startPolling
    // advance timers to let any async callbacks run
    jest.advanceTimersByTime(20);

    expect(memTotal.textContent).not.toBe('—');
    expect(memAvailable.textContent).not.toBe('—');
    expect(memUsed.textContent).toMatch(/%/);

    stopPolling();
  });

  test('visibilitychange stops and starts polling', () => {
    startPolling(10);
    jest.advanceTimersByTime(20);
    const before = memTotal.textContent;

    // make document hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // advance; values should not change
    jest.advanceTimersByTime(50);
    expect(memTotal.textContent).toBe(before);

    // make visible again
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(20);
    expect(memTotal.textContent).not.toBe('—');

    stopPolling();
  });
});
