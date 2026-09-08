import { flushSync } from 'react-dom';
import { cloneCardData } from '../fixtures';
import { validateCardData, formatValidationErrors } from '../schema/validation';
import type { FormaApi } from '../types/card';
import { DEFAULT_CARD_DATA, rendererStore } from './store';

export const RENDERER_VERSION = '0.2.0';

const targetSelector = '[data-forma-card]';
const targetTimeoutMs = 10_000;
const imageTimeoutMs = 15_000;

function cardTypeOf(data: unknown): string {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const type = (data as Record<string, unknown>).type;
    if (typeof type === 'string' && type.length > 0) {
      return type;
    }
  }
  return 'unknown';
}

function waitForElement(selector: string): Promise<HTMLElement> {
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) {
        return;
      }
      window.clearTimeout(timeoutId);
      observer.disconnect();
      resolve(element);
    });
    const timeoutId = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Forma target ${selector} was not found.`));
    }, targetTimeoutMs);

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(settle, imageTimeoutMs);

    function settle() {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      image.removeEventListener('load', settle);
      image.removeEventListener('error', settle);
      resolve();
    }

    image.addEventListener('load', settle, { once: true });
    image.addEventListener('error', settle, { once: true });
    if (image.complete) {
      settle();
    }
  });
}

async function waitForImages(target: HTMLElement) {
  const images = Array.from(target.querySelectorAll('img'));
  await Promise.all(images.map(waitForImage));
}

async function waitForFonts() {
  if (document.fonts) {
    await document.fonts.ready;
  }
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function layoutSnapshot(element: HTMLElement): string {
  const rect = element.getBoundingClientRect();
  return [
    rect.x.toFixed(2),
    rect.y.toFixed(2),
    rect.width.toFixed(2),
    rect.height.toFixed(2),
    element.scrollWidth,
    element.scrollHeight,
  ].join(':');
}

async function waitForStableLayout(target: HTMLElement) {
  let previousSnapshot: string | undefined;
  let stableFrames = 0;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await nextAnimationFrame();
    const currentSnapshot = layoutSnapshot(target);
    if (currentSnapshot === previousSnapshot) {
      stableFrames += 1;
      if (stableFrames >= 2) {
        return;
      }
    } else {
      previousSnapshot = currentSnapshot;
      stableFrames = 0;
    }
  }

  throw new Error('Renderer card layout did not stabilize within the expected time.');
}

async function render(data: unknown): Promise<void> {
  const validation = validateCardData(data);
  if (!validation.valid) {
    throw new Error(`Card type ${cardTypeOf(data)}: ${formatValidationErrors(validation.errors)}`);
  }

  const target = await waitForElement(targetSelector);
  flushSync(() => rendererStore.setData(cloneCardData(validation.data)));
  target.dataset.renderStatus = 'rendered';

  await waitForFonts();
  await waitForImages(target);
  await waitForStableLayout(target);
}

async function reset(): Promise<void> {
  await render(DEFAULT_CARD_DATA);
}

export function installForma() {
  const api: FormaApi = {
    render,
    reset,
    version: RENDERER_VERSION,
  };
  window.forma = api;
}
