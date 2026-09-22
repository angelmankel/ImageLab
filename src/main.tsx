import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Dev-only side-effect: attaches window.__exerciseCanvasStorage (gated inside the module).
import './lib/idbCanvasStorage';
// Dev-only side-effect: attaches window.__exerciseCanvasLayers (gated inside the module).
import './lib/canvasLayersExercise';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
