import { lazy, Suspense } from 'react';
import { RendererPage } from './renderer/RendererPage';

const DevPage = lazy(() =>
  import('./dev/DevPage').then(({ DevPage: page }) => ({ default: page })),
);

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function App() {
  if (normalizePathname(window.location.pathname) === '/dev') {
    return (
      <Suspense fallback={null}>
        <DevPage />
      </Suspense>
    );
  }

  return <RendererPage />;
}
