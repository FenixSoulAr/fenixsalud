import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslations } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Shield, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function About() {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.about.title}
        description={t.about.subtitle}
      />

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* App Identity */}
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Heart className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t.appName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">{t.about.version}</span>
                <Badge variant="secondary" className="text-xs">
                  {t.about.betaStatus}
                </Badge>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {t.about.description}
            </p>
          </div>

          {/* Features */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">{t.about.privacyTitle}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.about.privacyDescription}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-medium text-sm">{t.about.easyTitle}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.about.easyDescription}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              {t.about.madeWith}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}