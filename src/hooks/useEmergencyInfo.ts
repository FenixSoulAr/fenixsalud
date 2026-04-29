import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmergencyInfoData {
  id?: string;
  blood_type: string | null;
  emergency_phone: string | null;
  allergies: string | null;
  insurance_provider: string | null;
  insurance_plan: string | null;
  insurance_member_id: string | null;
}

const EMPTY: EmergencyInfoData = {
  blood_type: null,
  emergency_phone: null,
  allergies: null,
  insurance_provider: null,
  insurance_plan: null,
  insurance_member_id: null,
};

const FIELDS = [
  "blood_type",
  "emergency_phone",
  "allergies",
  "insurance_provider",
  "insurance_plan",
  "insurance_member_id",
] as const;

function computeIsFirstUse(data: EmergencyInfoData | null): boolean {
  if (!data) return true;
  const rec = data as unknown as Record<string, unknown>;
  return FIELDS.every((f) => {
    const v = rec[f];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  });
}

export function useEmergencyInfo() {
  const { user } = useAuth();
  const [data, setData] = useState<EmergencyInfoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Cast to any: generated types may lag behind new columns (blood_type, emergency_phone)
    const { data: row, error } = await (supabase
      .from("profiles") as any)
      .select(
        "id, blood_type, emergency_phone, allergies, insurance_provider, insurance_plan, insurance_member_id"
      )
      .eq("owner_user_id", user.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[useEmergencyInfo] fetch error:", error);
      setData(null);
    } else if (row) {
      setData(row as EmergencyInfoData);
    } else {
      setData(null);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const save = useCallback(
    async (patch: Partial<EmergencyInfoData>): Promise<boolean> => {
      if (!user) return false;
      setIsSaving(true);
      try {
        if (data?.id) {
          const { error } = await (supabase
            .from("profiles") as any)
            .update(patch)
            .eq("id", data.id);
          if (error) throw error;
        } else {
          // Upsert: create owner profile row if missing
          const { error } = await (supabase.from("profiles") as any).insert({
            owner_user_id: user.id,
            user_id: user.id,
            ...patch,
          });
          if (error) throw error;
        }
        await fetchData();
        return true;
      } catch (err) {
        console.error("[useEmergencyInfo] save error:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [user, data, fetchData]
  );

  const effective = data ?? EMPTY;
  const isFirstUse = computeIsFirstUse(data);

  return { data: effective, isLoading, isFirstUse, save, isSaving };
}
