import type { CardData } from '../types/card';

type Listener = () => void;

export const DEFAULT_CARD_DATA: CardData = {
  schemaVersion: '1',
  type: 'article',
  title: 'Forma：统一的前端卡片渲染器',
  contentType: 'markdown',
  content:
    'Forma 是一个纯前端、Schema 驱动的卡片渲染器。它根据统一的 CardData 渲染卡片，并提供 `/dev` Playground 用于开发预览。',
};

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
