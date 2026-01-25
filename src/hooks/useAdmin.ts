import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminAllowlist";

/**
 * Hook to check if the current user is an admin.
 * Uses the email-based allowlist for client-side UI gating.
 * All admin actions are still validated server-side.
 */
export function useAdmin() {
  const { user } = useAuth();

  const isAdmin = useMemo(() => {
    return isAdminEmail(user?.email);
  }, [user?.email]);

  return { isAdmin };
}
