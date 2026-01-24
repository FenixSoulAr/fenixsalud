import React, { createContext, useContext, ReactNode } from "react";
import { useEntitlements } from "@/hooks/useEntitlements";

interface EntitlementsContextValue {
  loading: boolean;
  planCode: string | null;
  planName: string | null;
  isPlusPlan: boolean;
  maxProfiles: number;
  maxAttachments: number;
  canShare: boolean;
  canUseRoles: boolean;
  canExportPdf: boolean;
  canExportBackup: boolean;
  canUseProcedures: boolean;
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
