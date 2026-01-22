import { PageHeader } from "@/components/layout/PageHeader";
import { useTranslations } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle } from "lucide-react";

export default function Contact() {
  const t = useTranslations();

  const handleSendEmail = () => {
    const subject = encodeURIComponent(t.contact.emailSubject);
    const body = encodeURIComponent(t.contact.emailBody);
    window.location.href = `mailto:fenixsoular@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.contact.title}
        description={t.contact.subtitle}
      />

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Encouragement message */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{t.contact.feedbackTitle}</h2>
              <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                {t.contact.feedbackMessage}
              </p>
            </div>
          </div>

          {/* Email action */}
          <div className="pt-4 border-t border-border">
            <Button 
              onClick={handleSendEmail} 
              className="w-full sm:w-auto"
              size="lg"
            >
              <Mail className="h-4 w-4 mr-2" />
              {t.contact.sendEmail}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              {t.contact.emailNote}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}