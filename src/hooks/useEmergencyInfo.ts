import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type OwnerName = { full_name: string | null; first_name: string | null } | null;

const EMERGENCY_FIELDS = [
  "blood_type",
  "emergency_phone",
  "allergies",
  "insurance_provider",
  "insurance_plan",
  "insurance_member_id",
] as const;

type EmergencyField = (typeof EMERGENCY_FIELDS)[number];

export type EmergencyInfoData = Pick<ProfileRow, "id" | EmergencyField>;
export type EmergencyInfoPatch = Partial<Pick<ProfileRow, EmergencyField>>;

const EMPTY: EmergencyInfoData = {
  id: "",
  blood_type: null,
  emergency_phone: null,
  allergies: null,
  insurance_provider: null,
  insurance_plan: null,
  insurance_member_id: null,
};

function computeIsFirstUse(data: EmergencyInfoData | null): boolean {
  if (!data) return true;
  return EMERGENCY_FIELDS.every((f) => {
    const v = data[f];
    return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
  });
}

export function useEmergencyInfo() {
  const { user } = useAuth();
  const [data, setData] = useState<EmergencyInfoData | null>(null);
  const [ownerName, setOwnerName] = useState<OwnerName>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setData(null);
      setOwnerName(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data: row, error } = await supabase
      .from("profiles")
      .select(
        "id, blood_type, emergency_phone, allergies, insurance_provider, insurance_plan, insurance_member_id, full_name, first_name"
      )
      .eq("owner_user_id", user.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[useEmergencyInfo] fetch error:", error);
      setData(null);
      setOwnerName(null);
    } else if (row) {
      const { full_name, first_name, ...emergency } = row as any;
      setData(emergency);
      setOwnerName({ full_name: full_name ?? null, first_name: first_name ?? null });
    } else {
      setData(null);
      setOwnerName(null);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const save = useCallback(
    async (patch: EmergencyInfoPatch): Promise<boolean> => {
      if (!user) return false;
      setIsSaving(true);
      try {
        if (data?.id) {
          const { error } = await supabase
            .from("profiles")
            .update(patch)
            .eq("id", data.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("profiles").insert({
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

  // Guarantee a non-null display name whenever a user is logged in.
  // Priority: profile.full_name > profile.first_name > user.email > user.id > null
  const ownerDisplayName: string | null = user
    ? (ownerName?.full_name && ownerName.full_name.trim()) ||
      (ownerName?.first_name && ownerName.first_name.trim()) ||
      (user.email && user.email.trim()) ||
      user.id ||
      null
    : null;

  return { data: effective, isLoading, isFirstUse, save, isSaving, ownerDisplayName };
}
