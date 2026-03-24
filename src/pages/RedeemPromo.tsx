import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Gift, CheckCircle2, Sparkles, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useTranslations, getLanguage } from "@/i18n";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";

const promoCodeSchema = z.object({
  code: z.string()
    .min(1, "Please enter a promo code")
    .max(50, "Code is too long")
    .transform(val => val.trim().toUpperCase()),
});

type PromoCodeFormData = z.infer<typeof promoCodeSchema>;

export default function RedeemPromo() {
  const t = useTranslations();
  const language = getLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isPlus, isPro, hasPromoOverride, isAdmin: entIsAdmin, refetch } = useEntitlementsContext();
  const { isAdmin: roleIsAdmin } = useAdmin();
  
  // Admins don't need promos - they have full access
  const userIsAdmin = entIsAdmin || roleIsAdmin;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<{
    expiresAt: string | null;
    isForever: boolean;
  } | null>(null);

  const form = useForm<PromoCodeFormData>({
    resolver: zodResolver(promoCodeSchema),
    defaultValues: { code: "" },
  });

  const onSubmit = async (data: PromoCodeFormData) => {
    setIsSubmitting(true);
    
    try {
      const { data: result, error } = await supabase.functions.invoke("redeem-promo", {
        body: { code: data.code },
      });

      if (error) {
        throw new Error(error.message || "Failed to redeem code");
      }

      if (result?.error) {
        toast({
          variant: "destructive",
          title: t.redeemPromo.error,
          description: result.error,
        });
        return;
      }

      // Success!
      setRedeemSuccess({
        expiresAt: result.expiresAt,
        isForever: result.isForever,
      });

      // Refresh entitlements to show Plus status
      await refetch();

      toast({
        title: t.redeemPromo.success,
        description: t.redeemPromo.successMessage,
      });

    } catch (err) {
      console.error("Error redeeming promo code:", err);
      toast({
        variant: "destructive",
        title: t.redeemPromo.error,
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "PPP", { locale: language === "es" ? esLocale : undefined });
  };

  // Admins have full access - no promos needed
  if (userIsAdmin) {
    return (
      <div className="container max-w-lg py-8">
        <PageHeader
          title={t.redeemPromo.title}
          description={t.redeemPromo.description}
        />
        
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <div>
                <h3 className="text-lg font-semibold">{t.redeemPromo.adminAccess}</h3>
                <p className="text-muted-foreground mt-1">
                  {t.redeemPromo.adminAccessMessage}
                </p>
              </div>
              <Button onClick={() => navigate("/")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t.redeemPromo.goToDashboard}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If already Plus, show a message
  if (isPlus || isPro || hasPromoOverride) {
    return (
      <div className="container max-w-lg py-8">
        <PageHeader
          title={t.redeemPromo.title}
          description={t.redeemPromo.description}
        />
        
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <div>
                <h3 className="text-lg font-semibold">{t.redeemPromo.alreadyPlus}</h3>
                <p className="text-muted-foreground mt-1">
                  {t.redeemPromo.alreadyPlusMessage}
                </p>
              </div>
              <Button onClick={() => navigate("/settings")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t.redeemPromo.goToSettings}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (redeemSuccess) {
    return (
      <div className="container max-w-lg py-8">
        <PageHeader
          title={t.redeemPromo.title}
          description={t.redeemPromo.description}
        />
        
        <Card className="mt-6 border-primary/50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-primary">
                  {t.redeemPromo.successTitle}
                </h3>
                <p className="text-muted-foreground mt-2">
                  {redeemSuccess.isForever 
                    ? t.redeemPromo.unlimitedAccess
                    : `${t.redeemPromo.accessUntil} ${formatExpiryDate(redeemSuccess.expiresAt!)}`
                  }
                </p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button onClick={() => navigate("/")} variant="default">
                  {t.redeemPromo.goToDashboard}
                </Button>
                <Button onClick={() => navigate("/settings")} variant="outline">
                  {t.redeemPromo.goToSettings}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redemption form
  return (
    <div className="container max-w-lg py-8">
      <PageHeader
        title={t.redeemPromo.title}
        description={t.redeemPromo.description}
      />
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            {t.redeemPromo.enterCode}
          </CardTitle>
          <CardDescription>
            {t.redeemPromo.enterCodeDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.redeemPromo.codeLabel}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t.redeemPromo.codePlaceholder}
                        {...field}
                        disabled={isSubmitting}
                        className="uppercase"
                        autoComplete="off"
                        autoCapitalize="characters"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    {t.redeemPromo.redeeming}
                  </>
                ) : (
                  t.redeemPromo.redeemButton
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <p className="text-center text-sm text-muted-foreground mt-6">
        {t.redeemPromo.noCode}{" "}
        <Button 
          variant="link" 
          className="p-0 h-auto" 
          onClick={() => navigate("/pricing")}
        >
          {t.redeemPromo.viewPlans}
        </Button>
      </p>
    </div>
  );
}
