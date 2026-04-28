import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppConfig {
  sw_kill_switch: boolean;
  sw_kill_message: string;
  app_min_version: string;
}

const DEFAULT_CONFIG: AppConfig = {
  sw_kill_switch: false,
  sw_kill_message: '',
  app_min_version: '1.0.10',
};

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export const useAppConfig = () => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value');

      if (error) {
        console.warn('useAppConfig: error fetching config', error);
        return;
      }

      if (!data) return;

      const parsed: AppConfig = { ...DEFAULT_CONFIG };
      for (const row of data) {
        if (row.key === 'sw_kill_switch') {
          parsed.sw_kill_switch = row.value === 'true';
        } else if (row.key === 'sw_kill_message') {
          parsed.sw_kill_message = row.value || '';
        } else if (row.key === 'app_min_version') {
          parsed.app_min_version = row.value || '1.0.10';
        }
      }

      setConfig(parsed);
      setLoaded(true);
    } catch (err) {
      console.warn('useAppConfig: unexpected error', err);
    }
  };

  useEffect(() => {
    fetchConfig();

    const interval = setInterval(fetchConfig, POLL_INTERVAL_MS);

    const focusHandler = () => fetchConfig();
    window.addEventListener('focus', focusHandler);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', focusHandler);
    };
  }, []);

  return { config, loaded, refetch: fetchConfig };
};
