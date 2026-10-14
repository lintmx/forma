import { textStyle } from '../core/card.js';
export { colors, textStyle } from '../core/card.js';

export function Tag({ children }: { children: string }) {
  return <div style={{ display: 'flex', padding: '5px 12px', borderRadius: 8, color: '#397c68', backgroundColor: '#edf6f2', fontSize: 14, ...textStyle }}>{children}</div>;
}
