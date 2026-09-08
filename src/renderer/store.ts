import { DEFAULT_CARD_DATA } from '../generated/registry';
import type { CardData } from '../types/card';

type Listener = () => void;

export { DEFAULT_CARD_DATA };

let currentData: CardData = DEFAULT_CARD_DATA;
const listeners = new Set<Listener>();

export const rendererStore = {
  getSnapshot: () => currentData,
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setData(data: CardData) {
    currentData = data;
    listeners.forEach((listener) => listener());
  },
};
