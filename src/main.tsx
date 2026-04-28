// Capture beforeinstallprompt as early as possible — before React mounts.
// This event is one-shot and would otherwise be lost if listeners are
// registered too late in the React lifecycle.
declare global {
  interface Window {
    __mhhDeferredInstallPrompt: Event | null;
    __mhhPWAListenerAttached: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__mhhPWAListenerAttached) {
  window.__mhhDeferredInstallPrompt = null;
  window.__mhhPWAListenerAttached = true;
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    window.__mhhDeferredInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('mhh-pwa-prompt-ready'));
  });
  window.addEventListener('appinstalled', () => {
    window.__mhhDeferredInstallPrompt = null;
  });
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global visualViewport listener — keeps CSS variable in sync with
// the actual visible area so modals/drawers recover full height
// after the virtual keyboard closes on Android.
if (window.visualViewport) {
  const updateViewportHeight = () => {
    document.documentElement.style.setProperty(
      "--visual-viewport-height",
      `${window.visualViewport!.height}px`
    );
  };
  updateViewportHeight();
  window.visualViewport.addEventListener("resize", updateViewportHeight);
}

createRoot(document.getElementById("root")!).render(<App />);
