import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  public observe(): void {}

  public unobserve(): void {}

  public disconnect(): void {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => new DOMRect(0, 0, 800, 320),
});

Object.defineProperties(HTMLDialogElement.prototype, {
  showModal: {
    configurable: true,
    value: function showModal(this: HTMLDialogElement): void {
      this.setAttribute("open", "");
    },
  },
  close: {
    configurable: true,
    value: function close(this: HTMLDialogElement): void {
      if (!this.open) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  },
});
