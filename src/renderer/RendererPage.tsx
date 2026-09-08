import { useSyncExternalStore } from 'react';
import { FormaRenderer } from './FormaRenderer';
import { rendererStore } from './store';

export function RendererPage() {
  const data = useSyncExternalStore(rendererStore.subscribe, rendererStore.getSnapshot);

  return (
    <main className="renderer-page">
      <div className="forma-card" data-forma-card="true">
        <FormaRenderer data={data} />
      </div>
    </main>
  );
}
