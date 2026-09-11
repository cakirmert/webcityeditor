import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { readEmbedConfig } from './package/frame-bridge';
import './index.css';

const embed = readEmbedConfig(window.location);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App embed={embed} />
  </StrictMode>
);
