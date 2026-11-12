
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Register Aether Kernel (Service Worker) - Safely
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
        // Only attempt registration if the origin allows it (simple check to avoid preview errors)
        if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
            navigator.serviceWorker.register('/sw.js').then(
                (registration) => {
                    console.log('[Aether Kernel] ServiceWorker registration successful');
                },
                (err) => {
                    // Suppress harmless errors in sandboxed environments
                    console.debug('[Aether Kernel] ServiceWorker info: ', err);
                }
            );
        }
    } catch (e) {
        // Ignore iframe security errors
    }
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
