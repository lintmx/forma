import type { ReactNode } from 'react';
import type { RenderOptions } from '../../types/card';

interface RendererFrameProps {
  options?: RenderOptions;
  children: ReactNode;
}

export function RendererFrame({ options, children }: RendererFrameProps) {
  const theme = options?.theme ?? 'light';
  const hasWatermark =
    typeof options?.watermark === 'string' && options.watermark.trim().length > 0;

  return (
    <div className="renderer-frame" data-theme={theme}>
      {children}
      {hasWatermark && <div className="card-watermark">{options.watermark}</div>}
    </div>
  );
}
