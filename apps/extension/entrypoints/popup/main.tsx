import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { fontFaceCss } from '../../src/ui/fonts';

// DS-50: font lokal untuk popup
const fontStyle = document.createElement('style');
fontStyle.textContent = fontFaceCss();
document.head.prepend(fontStyle);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
