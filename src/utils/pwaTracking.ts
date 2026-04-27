const STORAGE_KEYS = {
  FIRST_ACTION: 'mhh_pwa_first_action_done',
  PROMPT_DISMISSED: 'mhh_pwa_prompt_dismissed',
  INSTALLED: 'mhh_pwa_installed',
} as const;

export const pwaTracking = {
  markFirstAction: () => {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.FIRST_ACTION)) {
        localStorage.setItem(STORAGE_KEYS.FIRST_ACTION, new Date().toISOString());
      }
    } catch (e) {
      console.warn('PWA tracking: could not write to localStorage', e);
    }
  },
  hasFirstAction: (): boolean => {
    try {
      return !!localStorage.getItem(STORAGE_KEYS.FIRST_ACTION);
    } catch {
      return false;
    }
  },
  markDismissed: () => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROMPT_DISMISSED, new Date().toISOString());
    } catch (e) {
      console.warn('PWA tracking: could not write to localStorage', e);
    }
  },
  wasDismissed: (): boolean => {
    try {
      return !!localStorage.getItem(STORAGE_KEYS.PROMPT_DISMISSED);
    } catch {
      return false;
    }
  },
  markInstalled: () => {
    try {
      localStorage.setItem(STORAGE_KEYS.INSTALLED, new Date().toISOString());
    } catch (e) {
      console.warn('PWA tracking: could not write to localStorage', e);
    }
  },
  isInstalled: (): boolean => {
    try {
      return !!localStorage.getItem(STORAGE_KEYS.INSTALLED);
    } catch {
      return false;
    }
  },
};
