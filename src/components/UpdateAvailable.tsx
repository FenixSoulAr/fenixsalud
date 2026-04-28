import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/i18n';
import {
  initSWUpdateDetection,
  registerSWUpdateListener,
  applySWUpdate,
} from '@/utils/swRegistration';
import { Capacitor } from '@capacitor/core';

export const UpdateAvailable = () => {
  const t = useTranslations();
  const [updateReady, setUpdateReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    registerSWUpdateListener(() => {
      setUpdateReady(true);
    });
    initSWUpdateDetection();
  }, []);

  if (!updateReady || dismissed) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    await applySWUpdate();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground shadow-md">
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <RefreshCw className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{t.update.message}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleUpdate}
            disabled={updating}
            className="h-7 text-xs"
          >
            {updating ? t.update.updating : t.update.cta}
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-primary-foreground/80 hover:text-primary-foreground p-1"
            aria-label={t.update.dismiss}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
