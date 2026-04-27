import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, X, Share } from 'lucide-react';
import { useTranslations } from '@/i18n';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { pwaTracking } from '@/utils/pwaTracking';

export const PWAInstallPrompt = () => {
  const t = useTranslations();
  const { canShowPrompt, isIOS, hasNativePrompt, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  if (!canShowPrompt || dismissed) return null;

  const handleDismiss = () => {
    pwaTracking.markDismissed();
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (hasNativePrompt) {
      const accepted = await promptInstall();
      if (accepted) setDismissed(true);
    } else if (isIOS) {
      setShowIOSInstructions((prev) => !prev);
    }
  };

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-primary/15 p-2 mt-0.5">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{t.pwa.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{t.pwa.description}</p>

            {showIOSInstructions ? (
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{t.pwa.ios.howTo}</p>
                <p className="flex items-center gap-1.5">
                  1. {t.pwa.ios.step1} <Share className="h-3.5 w-3.5 inline" />
                </p>
                <p>2. {t.pwa.ios.step2}</p>
                <p>3. {t.pwa.ios.step3}</p>
              </div>
            ) : (
              <Button size="sm" className="mt-3" onClick={handleInstall}>
                {isIOS ? t.pwa.iosCta : t.pwa.cta}
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 -mt-1 -mr-1"
            onClick={handleDismiss}
            aria-label={t.pwa.dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
