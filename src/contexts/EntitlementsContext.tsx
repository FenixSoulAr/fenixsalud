import React, { createContext, useContext, ReactNode } from "react";
import { useEntitlements } from "@/hooks/useEntitlements";

interface EntitlementsContextValue {
  loading: boolean;
  error: string | null;
  planCode: string | null;
  planName: string | null;
  isPlus: boolean;
  hasPromoOverride: boolean;
  promoExpiresAt: string | null;
  maxProfiles: number;
  maxAttachments: number;
  canExportPdf: boolean;
  canShareProfiles: boolean;
  canUseRoles: boolean;
  canUseProcedures: boolean;
  canExportBackup: boolean;
  refetch: () => Promise<void>;
}

const EntitlementsContext = createContext<EntitlementsContextValue | undefined>(undefined);

export function EntitlementsProvider({ children }: { children: ReactNode }) {
  const entitlements = useEntitlements();

  return (
    <EntitlementsContext.Provider value={entitlements}>
      {children}
    </EntitlementsContext.Provider>
  );
}

export function useEntitlementsContext(): EntitlementsContextValue {
  const context = useContext(EntitlementsContext);
  if (context === undefined) {
    throw new Error("useEntitlementsContext must be used within an EntitlementsProvider");
  }
  return context;
}
