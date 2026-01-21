import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SharingRole = "owner" | "viewer" | "contributor";

interface ProfileShare {
  id: string;
  owner_id: string;
  shared_with_email: string;
  shared_with_user_id: string | null;
  role: "viewer" | "contributor";
  created_at: string;
  status: "pending" | "active";
}

interface SharedProfile {
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  role: "viewer" | "contributor";
}

interface SharingContextType {
  // Current user's role when viewing data (never null when authenticated)
  currentRole: SharingRole | null;
  // The profile owner ID whose data is being viewed
  activeProfileOwnerId: string | null;
  // The name of the profile owner being viewed (for display)
  activeProfileOwnerName: string | null;
  // Shares where current user is the owner
  myShares: ProfileShare[];
  // Shares where current user has been given access
  sharedWithMe: SharedProfile[];
  // Loading state
  loading: boolean;
  // Whether initial profile selection is needed
  needsProfileSelection: boolean;
  // Actions
  inviteUser: (email: string, role: "viewer" | "contributor") => Promise<{ error?: string }>;
  revokeAccess: (shareId: string) => Promise<{ error?: string }>;
  updateRole: (shareId: string, role: "viewer" | "contributor") => Promise<{ error?: string }>;
  switchToProfile: (ownerId: string) => void;
  switchToOwnProfile: () => void;
  refreshShares: () => Promise<SharedProfile[] | undefined>;
  // Helpers
  canEdit: boolean;
  canDelete: boolean;
  canManageSharing: boolean;
  isViewingOwnProfile: boolean;
}

const SharingContext = createContext<SharingContextType | undefined>(undefined);

const ACTIVE_PROFILE_KEY = "fenix_active_profile";

function getStoredActiveProfile(userId: string): string | null {
  try {
    const stored = localStorage.getItem(ACTIVE_PROFILE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the stored data belongs to current user
      if (parsed.userId === userId) {
        return parsed.activeProfileOwnerId;
      }
    }
  } catch {
    // Invalid stored data
  }
  return null;
}

function storeActiveProfile(userId: string, activeProfileOwnerId: string | null) {
  try {
    localStorage.setItem(
      ACTIVE_PROFILE_KEY,
      JSON.stringify({ userId, activeProfileOwnerId })
    );
  } catch {
    // Storage unavailable
  }
}

export function SharingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [myShares, setMyShares] = useState<ProfileShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfileOwnerId, setActiveProfileOwnerIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [needsProfileSelection, setNeedsProfileSelection] = useState(false);

  // Wrapper to also persist to localStorage
  const setActiveProfileOwnerId = useCallback((ownerId: string | null) => {
    setActiveProfileOwnerIdState(ownerId);
    if (user?.id) {
      storeActiveProfile(user.id, ownerId);
    }
    setNeedsProfileSelection(false);
  }, [user?.id]);

  // Determine current role based on active profile
  const isViewingOwnProfile = !activeProfileOwnerId || activeProfileOwnerId === user?.id;
  
  const currentRole: SharingRole | null = (() => {
    if (!user) return null;
    if (isViewingOwnProfile) return "owner";
    const share = sharedWithMe.find(s => s.owner_id === activeProfileOwnerId);
    return share?.role ?? null;
  })();

  const canEdit = currentRole === "owner" || currentRole === "contributor";
  const canDelete = currentRole === "owner";
  const canManageSharing = currentRole === "owner";

  const fetchShares = useCallback(async (): Promise<SharedProfile[] | undefined> => {
    if (!user) {
      setMyShares([]);
      setSharedWithMe([]);
      setLoading(false);
      return undefined;
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
      throw new Error(ownerError.message);
    }

    // Map owner shares - status comes from DB now
    const mappedOwnerShares: ProfileShare[] = (ownerShares || []).map((share: any) => ({
      id: share.id,
      owner_id: share.owner_id,
      shared_with_email: share.shared_with_email,
      shared_with_user_id: share.shared_with_user_id,
      role: share.role,
      created_at: share.created_at,
      status: share.status as "pending" | "active",
    }));

    console.log("[SharingContext] Fetched myShares for owner", user.id, ":", mappedOwnerShares.length, "shares", mappedOwnerShares);
    setMyShares(mappedOwnerShares);

    // Fetch shares where I have been given access (active only)
    const { data: receivedShares, error: receivedError } = await supabase
      .from("profile_shares")
      .select("*")
      .eq("shared_with_user_id", user.id)
      .eq("status", "active");

    if (receivedError) {
      console.error("[SharingContext] Error fetching received shares:", receivedError);
    }

    // For received shares, fetch owner profile names
    const sharedProfiles: SharedProfile[] = [];
    for (const share of receivedShares || []) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("user_id", share.owner_id)
        .maybeSingle();
      
      const ownerName = ownerProfile?.full_name || 
        (ownerProfile?.first_name && ownerProfile?.last_name 
          ? `${ownerProfile.first_name} ${ownerProfile.last_name}` 
          : ownerProfile?.first_name || null);
      
      sharedProfiles.push({
        owner_id: share.owner_id,
        owner_name: ownerName,
        owner_email: null,
        role: share.role,
      });
    }
    
    console.log("[SharingContext] Fetched sharedWithMe:", sharedProfiles.length, "profiles", sharedProfiles);
    setSharedWithMe(sharedProfiles);
    setLoading(false);
    
    return sharedProfiles;
  }, [user]);

  // Link pending invites and then initialize sharing
  useEffect(() => {
    if (!user) {
      setMyShares([]);
      setSharedWithMe([]);
      setLoading(false);
      setInitialized(false);
      setActiveProfileOwnerIdState(null);
      return;
    }

    async function linkAndInitialize() {
      // STEP 1: Link any pending invitations for this user's email
      if (user.email) {
        const normalizedEmail = user.email.toLowerCase();
        
        // Find any shares matching this email that are pending and not linked
        const { data: pendingShares, error: pendingError } = await supabase
          .from("profile_shares")
          .select("id")
          .ilike("shared_with_email", normalizedEmail)
          .eq("status", "pending")
          .is("shared_with_user_id", null);
        
        if (!pendingError && pendingShares && pendingShares.length > 0) {
          console.log("[SharingContext] Found pending shares to link:", pendingShares.length);
          
          // Link them to this user and set status to active
          const { error: updateError } = await supabase
            .from("profile_shares")
            .update({ 
              shared_with_user_id: user.id,
              status: "active"
            })
            .in("id", pendingShares.map(s => s.id));
          
          if (updateError) {
            console.error("[SharingContext] Error linking pending shares:", updateError);
          } else {
            console.log("[SharingContext] Successfully linked pending shares");
          }
        }
      }

      // STEP 2: Now fetch all shares (including newly linked ones)
      const profiles = await fetchShares();
      
      if (!profiles) return;

      // STEP 3: Check for stored preference
      const storedProfile = getStoredActiveProfile(user.id);
      
      if (storedProfile) {
        // Validate stored profile is still accessible
        const isOwnProfile = storedProfile === user.id;
        const hasAccess = profiles.some(p => p.owner_id === storedProfile);
        
        if (isOwnProfile || hasAccess) {
          setActiveProfileOwnerIdState(isOwnProfile ? null : storedProfile);
          setInitialized(true);
          return;
        }
      }

      // STEP 4: No valid stored preference - ALWAYS default to own profile
      // User must explicitly select a shared profile from the switcher
      setActiveProfileOwnerIdState(null);
      storeActiveProfile(user.id, null);
      
      // Flag for profile selection only if there are shared profiles available
      if (profiles.length > 0) {
        setNeedsProfileSelection(true);
      }
      
      setInitialized(true);
    }

    linkAndInitialize();
  }, [user, fetchShares]);

  async function inviteUser(email: string, role: "viewer" | "contributor"): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Refresh shares first to get current state
    await fetchShares();
    
    // Check max 2 shares limit (re-check after refresh)
    if (myShares.length >= 2) {
      return { error: "Maximum 2 shared people allowed" };
    }

    // Check if already shared with this email (case-insensitive)
    if (myShares.some(s => s.shared_with_email.toLowerCase() === normalizedEmail)) {
      return { error: "Already shared with this email" };
    }

    // Cannot share with yourself
    if (normalizedEmail === user.email?.toLowerCase()) {
      return { error: "Cannot share with yourself" };
    }

    const { error } = await supabase
      .from("profile_shares")
      .insert({
        owner_id: user.id,
        shared_with_email: normalizedEmail,
        role,
        status: "pending",
      });

    if (error) {
      console.error("[SharingContext] Error inviting user:", JSON.stringify(error, null, 2));
      
      // Check for duplicate constraint violation
      if (error.code === "23505" || error.message?.includes("unique") || error.message?.includes("duplicate")) {
        await fetchShares();
        return { error: "Already shared with this email" };
      }
      
      return { error: error.message || error.code || "Failed to invite user" };
    }

    await fetchShares();
    return {};
  }

  async function revokeAccess(shareId: string): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };

    // Set status to 'revoked' instead of deleting
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
      console.error("Error updating role:", error);
      return { error: "Failed to update role" };
    }

    await fetchShares();
    return {};
  }

  function switchToProfile(ownerId: string) {
    setActiveProfileOwnerId(ownerId);
  }

  function switchToOwnProfile() {
    setActiveProfileOwnerId(null);
  }

  // Get the active profile owner's name for display
  const activeProfileOwnerName: string | null = (() => {
    if (isViewingOwnProfile) return null;
    const share = sharedWithMe.find(s => s.owner_id === activeProfileOwnerId);
    if (share?.owner_name) return share.owner_name;
    if (share?.owner_email) return share.owner_email;
    // Fallback: show truncated owner_id
    if (activeProfileOwnerId) return `User ${activeProfileOwnerId.slice(0, 8)}...`;
    return null;
  })();

  // Compute the effective active profile owner ID
  const effectiveActiveProfileOwnerId = isViewingOwnProfile ? user?.id ?? null : activeProfileOwnerId;

  return (
    <SharingContext.Provider
      value={{
        currentRole,
        activeProfileOwnerId: effectiveActiveProfileOwnerId,
        activeProfileOwnerName,
        myShares,
        sharedWithMe,
        loading,
        needsProfileSelection,
        inviteUser,
        revokeAccess,
        updateRole: updateRoleFn,
        switchToProfile,
        switchToOwnProfile,
        refreshShares: fetchShares,
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

// Default fallback for when context is not available (prevents crashes)
const defaultSharingContext: SharingContextType = {
  currentRole: null,
  activeProfileOwnerId: null,
  activeProfileOwnerName: null,
  myShares: [],
  sharedWithMe: [],
  loading: true,
  needsProfileSelection: false,
  inviteUser: async () => ({ error: "Context not available" }),
  revokeAccess: async () => ({ error: "Context not available" }),
  updateRole: async () => ({ error: "Context not available" }),
  switchToProfile: () => {},
  switchToOwnProfile: () => {},
  refreshShares: async () => undefined,
  canEdit: false,
  canDelete: false,
  canManageSharing: false,
  isViewingOwnProfile: true,
};

export function useSharing(): SharingContextType {
  const context = useContext(SharingContext);
  if (context === undefined) {
    // Return safe fallback instead of throwing - prevents blank screen crashes
    console.warn("useSharing called outside SharingProvider, returning fallback state");
    return defaultSharingContext;
  }
  return context;
}
