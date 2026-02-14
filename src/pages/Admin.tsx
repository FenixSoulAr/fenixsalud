import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";
import { UsersSection } from "@/components/admin/UsersSection";
import { PromoCodesSection } from "@/components/admin/PromoCodesSection";
import { DataAuditSection } from "@/components/admin/DataAuditSection";

interface AdminUser {
  user_id: string;
  email: string;
  user_created_at: string;
  subscription_status: string | null;
  plan_code: string | null;
  plan_name: string | null;
  stripe_subscription_id: string | null;
  override_id: string | null;
  override_expires_at: string | null;
  override_granted_by: string | null;
  override_created_at: string | null;
  effective_plan: string;
}

interface PromoCode {
  id: string;
  code: string;
  type: string;
  value: number;
  duration_type: string;
  duration_value: number | null;
  max_redemptions: number | null;
  redeemed_count: number;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  stripe_coupon_id: string | null;
  created_at: string;
  last_used_at: string | null;
}

export default function Admin() {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const lang = getLanguage();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [promoLoading, setPromoLoading] = useState(true);

  // Check admin access and redirect if not
  useEffect(() => {
    if (!isAdmin) {
      navigate("/", { replace: true });
    }
  }, [isAdmin, navigate]);

  // Fetch users
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "list_users" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setUsers(data.users || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      toast.error(lang === "es" ? "Error al cargar usuarios" : "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch promo codes
  const fetchPromoCodes = async () => {
    setPromoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "list_promo_codes" },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setPromoCodes(data.promoCodes || []);
    } catch (err) {
      console.error("Failed to fetch promo codes:", err);
      toast.error(lang === "es" ? "Error al cargar códigos" : "Failed to load codes");
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchPromoCodes();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === "es" ? "Administración" : "Administration"}
        description={lang === "es" ? "Gestión de usuarios y planes" : "User and plan management"}
      />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">{lang === "es" ? "Usuarios" : "Users"}</TabsTrigger>
          <TabsTrigger value="promo">{lang === "es" ? "Códigos Promo" : "Promo Codes"}</TabsTrigger>
          <TabsTrigger value="audit">{lang === "es" ? "Auditoría" : "Audit"}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UsersSection users={users} loading={usersLoading} onRefresh={fetchUsers} />
        </TabsContent>

        <TabsContent value="promo" className="space-y-4">
          <PromoCodesSection promoCodes={promoCodes} loading={promoLoading} onRefresh={fetchPromoCodes} />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <DataAuditSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
