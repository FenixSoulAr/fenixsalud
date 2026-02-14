import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if the current user has the 'admin' role.
 * Calls the get-my-role edge function (server-side validated).
 */
export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function checkRole() {
      try {
        const { data, error } = await supabase.functions.invoke("get-my-role");
        if (!cancelled) {
          setIsAdmin(!error && data?.role === "admin");
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkRole();
    return () => { cancelled = true; };
  }, [user?.id]);

  return { isAdmin, loading };
}
