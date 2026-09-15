// jsdom has no ResizeObserver, which SerialConsole uses to keep the terminal
// fitted to its container.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
