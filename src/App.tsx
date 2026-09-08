import { DevPage } from './dev/DevPage';
import { RendererPage } from './renderer/RendererPage';

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function App() {
  return normalizePathname(window.location.pathname) === '/dev' ? <DevPage /> : <RendererPage />;
}
