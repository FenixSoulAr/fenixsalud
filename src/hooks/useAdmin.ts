import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if the current user has the 'admin' role.
 * Calls the get-my-role edge function (server-side validated).
 */
export function useAdmin() {
  const { user } = useAuth();
  const [role, setRole] = useState<"superadmin" | "admin" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function checkRole() {
      try {
        const { data, error } = await supabase.functions.invoke("get-my-role");
        if (!cancelled) {
          const r = !error && data?.role ? data.role : null;
          setRole(r === "superadmin" || r === "admin" ? r : null);
        }
      } catch {
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkRole();
    return () => { cancelled = true; };
  }, [user?.id]);

  const isAdmin = role === "admin" || role === "superadmin";
  const isSuperadmin = role === "superadmin";

  return { isAdmin, isSuperadmin, role, loading };
}
