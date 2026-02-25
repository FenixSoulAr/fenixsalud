import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getLanguage } from "@/i18n";

export type SharingRole = "owner" | "viewer" | "contributor";

interface ProfileShare {
  id: string;
  profile_id: string;
  owner_id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  shared_with_name: string | null;
  role: "viewer" | "contributor";
  created_at: string;
  status: "pending" | "active";
}

interface SharedProfile {
  profile_id: string;
  profile_name: string | null;
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  role: "viewer" | "contributor";
}

interface OwnedProfile {
  id: string;
  full_name: string | null;
  user_id: string | null;
  is_primary: boolean;
}

export type { OwnedProfile, SharedProfile };

interface SharingContextType {
  currentRole: SharingRole | null;
  activeProfileId: string | null;
  activeProfileOwnerId: string | null;
  activeProfileOwnerName: string | null;
  myShares: ProfileShare[];
  sharedWithMe: SharedProfile[];
  myProfiles: OwnedProfile[];
  loading: boolean;
  initialized: boolean;
  dataError: string | null;
  retryDataLoad: () => void;
  needsProfileSelection: boolean;
  inviteUser: (profileId: string, email: string, role: "viewer" | "contributor") => Promise<{ error?: string }>;
  revokeAccess: (shareId: string) => Promise<{ error?: string }>;
  updateRole: (shareId: string, role: "viewer" | "contributor") => Promise<{ error?: string }>;
  switchToProfile: (profileId: string) => void;
  switchToOwnProfile: () => void;
  refreshShares: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
  canManageSharing: boolean;
  isViewingOwnProfile: boolean;
}

const SharingContext = createContext<SharingContextType | undefined>(undefined);

const ACTIVE_PROFILE_KEY = "fenix_active_profile_v2";

function getStoredActiveProfile(userId: string): string | null {
  try {
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.userId === userId) {
        return parsed.activeProfileId;
      }
    }
  } catch {
    // Invalid stored data
  }
  return null;
}

function storeActiveProfile(userId: string, activeProfileId: string | null) {
  try {
    localStorage.setItem(
      ACTIVE_PROFILE_KEY,
      JSON.stringify({ userId, activeProfileId })
    );
  } catch {
    // Storage unavailable
  }
}

export function SharingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [myShares, setMyShares] = useState<ProfileShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedProfile[]>([]);
  const [myProfiles, setMyProfiles] = useState<OwnedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [needsProfileSelection, setNeedsProfileSelection] = useState(false);

  const setActiveProfileId = useCallback((profileId: string | null) => {
    setActiveProfileIdState(profileId);
    if (user?.id) {
      storeActiveProfile(user.id, profileId);
    }
    setNeedsProfileSelection(false);
  }, [user?.id]);

  // Determine if viewing own profile
  const isViewingOwnProfile = myProfiles.some(p => p.id === activeProfileId);
  
  // Determine current role
  const currentRole: SharingRole | null = (() => {
    if (!user) return null;
    if (isViewingOwnProfile) return "owner";
    const share = sharedWithMe.find(s => s.profile_id === activeProfileId);
    return share?.role ?? null;
  })();

  const canEdit = currentRole === "owner" || currentRole === "contributor";
  const canDelete = currentRole === "owner";
  const canManageSharing = currentRole === "owner";

  // Fetch all profiles owned by current user
  const fetchProfiles = useCallback(async () => {
    if (!user) {
      setMyProfiles([]);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, first_name, last_name, user_id")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[SharingContext] Error fetching profiles:", error);
      throw error;
    }

    const profiles: OwnedProfile[] = (data || []).map((p) => {
      const displayName = p.full_name 
        || (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : null)
        || p.first_name 
        || null;
      
      return {
        id: p.id,
        full_name: displayName,
        user_id: p.user_id,
        is_primary: p.user_id === user.id,
      };
    });

    console.log("[SharingContext] Fetched myProfiles:", profiles.length);
    setMyProfiles(profiles);
  }, [user]);

  const fetchShares = useCallback(async () => {
    if (!user) {
      setMyShares([]);
      setSharedWithMe([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: ownerShares, error: ownerError } = await supabase
      .from("profile_shares")
      .select("*")
      .eq("owner_id", user.id)
      .neq("status", "revoked");

    if (ownerError) {
      console.error("[SharingContext] Error fetching owner shares:", ownerError);
      setLoading(false);
      return;
    }

    const mappedOwnerShares: ProfileShare[] = [];
    for (const share of ownerShares || []) {
      let sharedWithName: string | null = null;
      
      if (share.shared_with_user_id && share.status === "active") {
        const { data: sharedProfile } = await supabase
          .from("profiles")
          .select("full_name, first_name, last_name")
          .eq("user_id", share.shared_with_user_id)
          .maybeSingle();
        
        sharedWithName = sharedProfile?.full_name || 
          (sharedProfile?.first_name && sharedProfile?.last_name 
            ? `${sharedProfile.first_name} ${sharedProfile.last_name}` 
            : sharedProfile?.first_name || null);
      }
      
      mappedOwnerShares.push({
        id: share.id,
        profile_id: share.profile_id || "",
        owner_id: share.owner_id,
        shared_with_email: share.shared_with_email,
        shared_with_user_id: share.shared_with_user_id,
        shared_with_name: sharedWithName,
        role: share.role,
        created_at: share.created_at,
        status: share.status as "pending" | "active",
      });
    }

    setMyShares(mappedOwnerShares);

    const { data: receivedShares, error: receivedError } = await supabase
      .from("profile_shares")
      .select("*")
      .eq("shared_with_user_id", user.id)
      .eq("status", "active");

    if (receivedError) {
      console.error("[SharingContext] Error fetching received shares:", receivedError);
    }

    const sharedProfiles: SharedProfile[] = [];
    for (const share of receivedShares || []) {
      const profileId = share.profile_id || "";
      
      let profileName: string | null = null;
      if (profileId) {
        const { data: profileData } = await supabase
          .rpc("get_profile_for_role", { _profile_id: profileId });
        
        if (profileData) {
          const p = profileData as Record<string, unknown>;
          profileName = (p.full_name as string) || 
            ((p.first_name as string) && (p.last_name as string) 
              ? `${p.first_name} ${p.last_name}` 
              : (p.first_name as string) || null);
        }
      }
      
      sharedProfiles.push({
        profile_id: profileId,
        profile_name: profileName,
        owner_id: share.owner_id,
        owner_name: null,
        owner_email: null,
        role: share.role,
      });
    }
    
    setSharedWithMe(sharedProfiles);
    setLoading(false);
  }, [user]);

  // ── Data loading function (Phase 2 of boot) ──
  // This is separated from auth so failures here never block auth.
  const loadDataRef = useRef<(isRetry?: boolean) => Promise<void>>();
  const initRef = useRef<string | null>(null);

  const loadData = useCallback(async (isRetry = false) => {
    if (!user) return;

    if (!isRetry) {
      // Prevent double initialization for the same user
      if (initRef.current === user.id) return;
      initRef.current = user.id;
    }

    setDataError(null);
    setLoading(true);
    if (!isRetry) {
      setInitialized(false);
    }

    try {
      console.log("[SharingContext] Data phase starting for user:", user.id, isRetry ? "(retry)" : "");
      
      // STEP 1: Link pending invitations
      if (user.email) {
        const normalizedEmail = user.email.toLowerCase();
        const { data: pendingShares, error: pendingError } = await supabase
          .from("profile_shares")
          .select("id")
          .ilike("shared_with_email", normalizedEmail)
          .eq("status", "pending")
          .is("shared_with_user_id", null);
        
        if (!pendingError && pendingShares && pendingShares.length > 0) {
          await supabase
            .from("profile_shares")
            .update({ shared_with_user_id: user.id, status: "active" })
            .in("id", pendingShares.map(s => s.id));
        }
      }

      // STEP 2: Fetch profiles and shares
      await Promise.all([fetchProfiles(), fetchShares()]);

      // STEP 3: Resolve activeProfileId
      const storedProfileId = getStoredActiveProfile(user.id);
      
      const { data: allUserProfiles } = await supabase
        .from("profiles")
        .select("id, user_id")
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true });

      const profileIds = (allUserProfiles || []).map(p => p.id);
      const primaryProfileId = allUserProfiles?.find(p => p.user_id === user.id)?.id || profileIds[0] || null;

      const { data: sharedAccess } = await supabase
        .from("profile_shares")
        .select("profile_id")
        .eq("shared_with_user_id", user.id)
        .eq("status", "active");
      const sharedProfileIds = (sharedAccess || []).map(s => s.profile_id);
      const allValidIds = [...profileIds, ...sharedProfileIds];

      let resolvedProfileId: string | null = null;

      if (storedProfileId && allValidIds.includes(storedProfileId)) {
        resolvedProfileId = storedProfileId;
      } else if (primaryProfileId) {
        resolvedProfileId = primaryProfileId;
        storeActiveProfile(user.id, primaryProfileId);
      }

      console.log("[SharingContext] Data phase resolved:", {
        userId: user.id,
        profileCount: profileIds.length,
        storedProfileId,
        resolvedProfileId,
      });

      setActiveProfileIdState(resolvedProfileId);
      setDataError(null);
      setInitialized(true);
      setLoading(false);
    } catch (err) {
      console.error("[SharingContext] Data phase failed:", err);
      setLoading(false);
      // Do NOT set initialized=true on error — let UI show data error state
      setDataError(
        err instanceof Error ? err.message : "Error loading profile data"
      );
    }
  }, [user, fetchProfiles, fetchShares]);

  // Store ref so retryDataLoad always calls the latest version
  loadDataRef.current = loadData;

  const retryDataLoad = useCallback(() => {
    // Reset initRef so loadData runs again
    initRef.current = null;
    loadDataRef.current?.(true);
  }, []);

  // Boot: when user changes, start data phase
  useEffect(() => {
    if (!user) {
      setMyShares([]);
      setSharedWithMe([]);
      setMyProfiles([]);
      setLoading(false);
      setInitialized(false);
      setActiveProfileIdState(null);
      setDataError(null);
      initRef.current = null;
      return;
    }

    // Auto-retry once on failure after 500ms backoff
    let retryTimer: ReturnType<typeof setTimeout>;
    let mounted = true;

    async function bootData() {
      try {
        await loadData();
      } catch {
        // loadData handles its own errors, but if something slips through:
        if (mounted && !initialized) {
          console.warn("[SharingContext] Auto-retrying data load in 500ms...");
          retryTimer = setTimeout(() => {
            if (mounted) {
              initRef.current = null; // allow retry
              loadData(true);
            }
          }, 500);
        }
      }
    }

    bootData();

    // Watchdog: after 10s force initialized so app doesn't hang forever
    const watchdog = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn("[SharingContext] Watchdog triggered after 10s - forcing initialized");
        setLoading(false);
        setInitialized(true);
      }
    }, 10000);

    return () => {
      mounted = false;
      clearTimeout(retryTimer);
      clearTimeout(watchdog);
    };
  }, [user]);

  async function inviteUser(profileId: string, email: string, role: "viewer" | "contributor"): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };
    
    const normalizedEmail = email.toLowerCase().trim();
    
    const profile = myProfiles.find(p => p.id === profileId);
    if (!profile) {
      const { data: dbProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", profileId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      
      if (!dbProfile) {
        return { error: "Profile not found" };
      }
    }
    
    const { data: existingShares, error: countError } = await supabase
      .from("profile_shares")
      .select("id, shared_with_email")
      .eq("profile_id", profileId)
      .eq("owner_id", user.id)
      .neq("status", "revoked");
    
    if (countError) {
      return { error: countError.message || "Failed to check existing shares" };
    }
    
    const activeShares = existingShares || [];
    
    if (activeShares.length >= 2) {
      return { error: "Maximum 2 shared people per profile" };
    }

    if (activeShares.some(s => s.shared_with_email.toLowerCase() === normalizedEmail)) {
      return { error: "Already shared with this email" };
    }

    if (normalizedEmail === user.email?.toLowerCase()) {
      return { error: "Cannot share with yourself" };
    }

    const { error } = await supabase
      .from("profile_shares")
      .insert({
        profile_id: profileId,
        owner_id: user.id,
        shared_with_email: normalizedEmail,
        role,
        status: "pending",
      })
      .select("id");

    if (error) {
      if (error.code === "23505") {
        return { error: "Already shared with this email" };
      }
      return { error: error.message || "Failed to invite user" };
    }

    await fetchShares();
    return {};
  }

  async function revokeAccess(shareId: string): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
      .from("profile_shares")
      .update({ status: "revoked" })
      .eq("id", shareId)
      .eq("owner_id", user.id);

    if (error) {
      return { error: error.message || "Failed to revoke access" };
    }

    await fetchShares();
    return {};
  }

  async function updateRoleFn(shareId: string, role: "viewer" | "contributor"): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
      .from("profile_shares")
      .update({ role })
      .eq("id", shareId)
      .eq("owner_id", user.id);

    if (error) {
      return { error: "Failed to update role" };
    }

    await fetchShares();
    return {};
  }

  function switchToProfile(profileId: string) {
    if (profileId === activeProfileId) return;
    
    const ownProfile = myProfiles.find(p => p.id === profileId);
    const sharedProfile = sharedWithMe.find(s => s.profile_id === profileId);
    
    const profileName = ownProfile?.full_name || sharedProfile?.profile_name || "Unknown";
    const lang = getLanguage();
    const message = lang === "es" 
      ? `Ahora estás viendo el perfil de ${profileName}.`
      : `You are now viewing ${profileName}'s profile.`;
    
    setActiveProfileId(profileId);
    toast.info(message);
  }

  function switchToOwnProfile() {
    const primaryProfile = myProfiles.find(p => p.is_primary);
    if (primaryProfile) {
      setActiveProfileId(primaryProfile.id);
    }
  }

  const activeProfileOwnerId: string | null = (() => {
    if (isViewingOwnProfile) return user?.id ?? null;
    const share = sharedWithMe.find(s => s.profile_id === activeProfileId);
    return share?.owner_id ?? null;
  })();

  const activeProfileOwnerName: string | null = (() => {
    const ownProfile = myProfiles.find(p => p.id === activeProfileId);
    if (ownProfile) return ownProfile.full_name;
    const share = sharedWithMe.find(s => s.profile_id === activeProfileId);
    return share?.profile_name || share?.owner_name || null;
  })();

  return (
    <SharingContext.Provider
      value={{
        currentRole,
        activeProfileId,
        activeProfileOwnerId,
        activeProfileOwnerName,
        myShares,
        sharedWithMe,
        myProfiles,
        loading,
        initialized,
        dataError,
        retryDataLoad,
        needsProfileSelection,
        inviteUser,
        revokeAccess,
        updateRole: updateRoleFn,
        switchToProfile,
        switchToOwnProfile,
        refreshShares: fetchShares,
        refreshProfiles: fetchProfiles,
        canEdit,
        canDelete,
        canManageSharing,
        isViewingOwnProfile,
      }}
    >
      {children}
    </SharingContext.Provider>
  );
}

const defaultSharingContext: SharingContextType = {
  currentRole: null,
  activeProfileId: null,
  activeProfileOwnerId: null,
  activeProfileOwnerName: null,
  myShares: [],
  sharedWithMe: [],
  myProfiles: [],
  loading: true,
  initialized: false,
  dataError: null,
  retryDataLoad: () => {},
  needsProfileSelection: false,
  inviteUser: async () => ({ error: "Context not available" }),
  revokeAccess: async () => ({ error: "Context not available" }),
  updateRole: async () => ({ error: "Context not available" }),
  switchToProfile: () => {},
  switchToOwnProfile: () => {},
  refreshShares: async () => {},
  refreshProfiles: async () => {},
  canEdit: false,
  canDelete: false,
  canManageSharing: false,
  isViewingOwnProfile: true,
};

export function useSharing(): SharingContextType {
  const context = useContext(SharingContext);
  if (context === undefined) {
    console.warn("useSharing called outside SharingProvider, returning fallback state");
    return defaultSharingContext;
  }
  return context;
}
