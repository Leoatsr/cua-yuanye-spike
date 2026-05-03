import './styles/design-system.css';
import './styles/wave7c-overrides.css';
import './styles/wave7d-overrides.css';
import './styles/wave7e-overrides.css';
import './styles/wave7e1-overrides.css';
import './styles/wave7e2-overrides.css';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initSentry } from './lib/sentry';

// Initialize Sentry FIRST so it captures errors during App boot
initSentry();

// Note: We deliberately do NOT use StrictMode here.
// StrictMode double-invokes effects in dev, which would create the
// Phaser game twice. Acceptable trade-off for a Spike — production
// builds aren't affected regardless.
createRoot(document.getElementById('root')!).render(<App />);
