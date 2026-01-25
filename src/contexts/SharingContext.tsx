import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

interface SharingContextType {
  currentRole: SharingRole | null;
  activeProfileId: string | null;
  activeProfileOwnerId: string | null;
  activeProfileOwnerName: string | null;
  myShares: ProfileShare[];
  sharedWithMe: SharedProfile[];
  myProfiles: OwnedProfile[];
  loading: boolean;
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
  const [loading, setLoading] = useState(false);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
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
      return;
    }

    const profiles: OwnedProfile[] = (data || []).map((p) => {
      // Build display name with fallbacks: full_name > first + last > first > null
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

    console.log("[SharingContext] Fetched myProfiles:", profiles.length, profiles.map(p => ({ id: p.id, name: p.full_name })));
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

    // Fetch shares where I am the owner (exclude revoked)
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

    // Map owner shares and fetch names for linked users
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

    console.log("[SharingContext] Fetched myShares:", mappedOwnerShares.length);
    setMyShares(mappedOwnerShares);

    // Fetch shares where I have been given access (active only)
    const { data: receivedShares, error: receivedError } = await supabase
      .from("profile_shares")
      .select("*, profiles!profile_shares_profile_id_fkey(id, full_name, owner_user_id)")
      .eq("shared_with_user_id", user.id)
      .eq("status", "active");

    if (receivedError) {
      console.error("[SharingContext] Error fetching received shares:", receivedError);
    }

    // For received shares, fetch owner profile names
    const sharedProfiles: SharedProfile[] = [];
    for (const share of receivedShares || []) {
      const profile = share.profiles as { id: string; full_name: string | null; owner_user_id: string } | null;
      
      // Get owner's primary profile name
      let ownerName: string | null = null;
      if (profile?.owner_user_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("full_name, first_name, last_name")
          .eq("user_id", profile.owner_user_id)
          .maybeSingle();
        
        ownerName = ownerProfile?.full_name || 
          (ownerProfile?.first_name && ownerProfile?.last_name 
            ? `${ownerProfile.first_name} ${ownerProfile.last_name}` 
            : ownerProfile?.first_name || null);
      }
      
      sharedProfiles.push({
        profile_id: profile?.id || share.profile_id || "",
        profile_name: profile?.full_name || null,
        owner_id: share.owner_id,
        owner_name: ownerName,
        owner_email: null,
        role: share.role,
      });
    }
    
    console.log("[SharingContext] Fetched sharedWithMe:", sharedProfiles.length);
    setSharedWithMe(sharedProfiles);
    setLoading(false);
  }, [user]);

  // Link pending invites and initialize
  useEffect(() => {
    if (!user) {
      setMyShares([]);
      setSharedWithMe([]);
      setMyProfiles([]);
      setLoading(false);
      setInitialized(false);
      setActiveProfileIdState(null);
      return;
    }

    let mounted = true;

    async function linkAndInitialize() {
      try {
        // STEP 1: Link any pending invitations for this user's email
        if (user.email) {
          const normalizedEmail = user.email.toLowerCase();
          
          const { data: pendingShares, error: pendingError } = await supabase
            .from("profile_shares")
            .select("id")
            .ilike("shared_with_email", normalizedEmail)
            .eq("status", "pending")
            .is("shared_with_user_id", null);
          
          if (!pendingError && pendingShares && pendingShares.length > 0) {
            console.log("[SharingContext] Found pending shares to link:", pendingShares.length);
            
            const { error: updateError } = await supabase
              .from("profile_shares")
              .update({ 
                shared_with_user_id: user.id,
                status: "active"
              })
              .in("id", pendingShares.map(s => s.id));
            
            if (updateError) {
              console.error("[SharingContext] Error linking pending shares:", updateError);
            }
          }
        }

        if (!mounted) return;

        // STEP 2: Fetch all profiles and shares
        await Promise.all([fetchProfiles(), fetchShares()]);
        
        if (!mounted) return;

        // STEP 3: Determine active profile
        const storedProfileId = getStoredActiveProfile(user.id);
        
        // Get primary profile (user_id = owner_user_id)
        const { data: primaryProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("owner_user_id", user.id)
          .eq("user_id", user.id)
          .maybeSingle();

        const primaryProfileId = primaryProfile?.id || null;

        if (storedProfileId) {
          // Validate stored profile is still accessible
          setActiveProfileIdState(storedProfileId);
        } else if (primaryProfileId) {
          // Default to primary profile
          setActiveProfileIdState(primaryProfileId);
          storeActiveProfile(user.id, primaryProfileId);
        }
        
        setInitialized(true);
      } catch (err) {
        console.error("[SharingContext] Error in linkAndInitialize:", err);
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    }

    linkAndInitialize();

    const watchdog = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn("[SharingContext] Watchdog triggered - forcing initialization");
        setLoading(false);
        setInitialized(true);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(watchdog);
    };
  }, [user, fetchProfiles, fetchShares, initialized]);

  async function inviteUser(profileId: string, email: string, role: "viewer" | "contributor"): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Verify the profile belongs to the user
    const profile = myProfiles.find(p => p.id === profileId);
    if (!profile) {
      return { error: "Profile not found" };
    }
    
    // Check max 2 shares limit per profile
    const profileShares = myShares.filter(s => s.profile_id === profileId);
    if (profileShares.length >= 2) {
      return { error: "Maximum 2 shared people per profile" };
    }

    // Check if already shared with this email
    if (profileShares.some(s => s.shared_with_email.toLowerCase() === normalizedEmail)) {
      return { error: "Already shared with this email" };
    }

    // Cannot share with yourself
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
      });

    if (error) {
      console.error("[SharingContext] Error inviting user:", error);
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
      console.error("[SharingContext] Error revoking access:", error);
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
      console.error("[SharingContext] Error updating role:", error);
      return { error: "Failed to update role" };
    }

    await fetchShares();
    return {};
  }

  function switchToProfile(profileId: string) {
    console.log("[SharingContext] Switching to profile:", profileId);
    const ownProfile = myProfiles.find(p => p.id === profileId);
    const sharedProfile = sharedWithMe.find(s => s.profile_id === profileId);
    console.log("[SharingContext] Profile details:", { 
      ownProfile: ownProfile ? { id: ownProfile.id, name: ownProfile.full_name, isPrimary: ownProfile.is_primary } : null,
      sharedProfile: sharedProfile ? { id: sharedProfile.profile_id, name: sharedProfile.profile_name } : null
    });
    setActiveProfileId(profileId);
  }

  function switchToOwnProfile() {
    const primaryProfile = myProfiles.find(p => p.is_primary);
    if (primaryProfile) {
      setActiveProfileId(primaryProfile.id);
    }
  }

  // Get active profile's owner ID for data operations
  const activeProfileOwnerId: string | null = (() => {
    if (isViewingOwnProfile) {
      return user?.id ?? null;
    }
    const share = sharedWithMe.find(s => s.profile_id === activeProfileId);
    return share?.owner_id ?? null;
  })();

  // Get active profile's display name
  const activeProfileOwnerName: string | null = (() => {
    const ownProfile = myProfiles.find(p => p.id === activeProfileId);
    if (ownProfile) {
      return ownProfile.full_name;
    }
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
