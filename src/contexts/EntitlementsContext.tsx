import React, { createContext, useContext, ReactNode } from "react";
import { useEntitlements, UseEntitlementsReturn } from "@/hooks/useEntitlements";

/**
 * EntitlementsContext — provides server-resolved entitlements to the entire app.
 * All premium feature gating MUST read from this context (via useEntitlementsContext).
 */
type EntitlementsContextValue = UseEntitlementsReturn;

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
