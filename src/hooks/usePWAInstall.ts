import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { pwaTracking } from '@/utils/pwaTracking';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Skip everything in Capacitor native
    if (Capacitor.isNativePlatform()) return;

    // Detect if already running as installed PWA
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) {
      pwaTracking.markInstalled();
    }

    // Detect iOS (Safari doesn't fire beforeinstallprompt)
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // CHECK if the event was already captured early in main.tsx
    if (window.__mhhDeferredInstallPrompt) {
      setDeferredPrompt(window.__mhhDeferredInstallPrompt as BeforeInstallPromptEvent);
    }

    // Listen for late event (in case it fires after mount)
    const handler = (e: Event) => {
      e.preventDefault();
      window.__mhhDeferredInstallPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Listen for the custom ready event from main.tsx
    const readyHandler = () => {
      if (window.__mhhDeferredInstallPrompt) {
        setDeferredPrompt(window.__mhhDeferredInstallPrompt as BeforeInstallPromptEvent);
      }
    };
    window.addEventListener('mhh-pwa-prompt-ready', readyHandler);

    // Listen for app installed event
    const installedHandler = () => {
      pwaTracking.markInstalled();
      window.__mhhDeferredInstallPrompt = null;
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('mhh-pwa-prompt-ready', readyHandler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        pwaTracking.markInstalled();
      }
      setDeferredPrompt(null);
      window.__mhhDeferredInstallPrompt = null;
      return choice.outcome === 'accepted';
    } catch (e) {
      console.error('PWA install prompt error', e);
      return false;
    }
  }, [deferredPrompt]);

  const isNative = Capacitor.isNativePlatform();
  const canShowPrompt =
    !isNative &&
    !isStandalone &&
    !pwaTracking.isInstalled() &&
    !pwaTracking.wasDismissed() &&
    pwaTracking.hasFirstAction() &&
    (deferredPrompt !== null || isIOS);

  return {
    canShowPrompt,
    isIOS,
    isNative,
    isStandalone,
    promptInstall,
    hasNativePrompt: deferredPrompt !== null,
  };
};
