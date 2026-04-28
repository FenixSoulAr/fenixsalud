import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/i18n';
import { useAppConfig } from '@/hooks/useAppConfig';
import { killSwitch } from '@/utils/swRegistration';
import { Capacitor } from '@capacitor/core';

export const MaintenanceBanner = () => {
  const t = useTranslations();
  const { config, loaded } = useAppConfig();
  const [executing, setExecuting] = useState(false);

  if (Capacitor.isNativePlatform()) return null;
  if (!loaded) return null;
  if (!config.sw_kill_switch) return null;

  const message = config.sw_kill_message || t.maintenance.defaultMessage;

  const handleApply = async () => {
    setExecuting(true);
    await killSwitch();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[101] bg-destructive text-destructive-foreground shadow-md">
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{message}</span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleApply}
          disabled={executing}
          className="h-7 text-xs flex-shrink-0"
        >
          {executing ? t.maintenance.applying : t.maintenance.cta}
        </Button>
      </div>
    </div>
  );
};
