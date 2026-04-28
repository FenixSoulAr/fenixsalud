import { Capacitor } from '@capacitor/core';

let updateCallback: (() => void) | null = null;

export const registerSWUpdateListener = (onUpdate: () => void) => {
  updateCallback = onUpdate;
};

export const initSWUpdateDetection = () => {
  if (Capacitor.isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.ready.then((registration) => {
    // Check for updates every minute
    setInterval(() => {
      registration.update().catch(() => { /* silent */ });
    }, 60 * 1000);

    // If a worker is already waiting at mount time, fire immediately
    if (registration.waiting && navigator.serviceWorker.controller) {
      if (updateCallback) updateCallback();
    }

    // Listen for new SW becoming available
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (updateCallback) updateCallback();
        }
      });
    });
  }).catch(() => { /* silent */ });
};

export const applySWUpdate = async (): Promise<void> => {
  if (Capacitor.isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setTimeout(() => window.location.reload(), 100);
  } catch (err) {
    console.error('applySWUpdate error', err);
    window.location.reload();
  }
};

export const killSwitch = async (): Promise<void> => {
  if (Capacitor.isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    window.location.reload();
  } catch (err) {
    console.error('killSwitch error', err);
    window.location.reload();
  }
};
