import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import './styles/global.css';
import './styles/renderer.css';
import './styles/dev.css';
import { App } from './App';
import { installForma } from './renderer/api';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('The application root element was not found.');
}

installForma();
createRoot(rootElement).render(<App />);
