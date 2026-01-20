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

    // Fetch shares where I am the owner
    const { data: ownerShares } = await supabase
      .from("profile_shares")
      .select("*")
      .eq("owner_id", user.id);

    // Fetch shares where I have been given access
    const { data: receivedShares } = await supabase
      .from("profile_shares")
      .select("*")
      .eq("shared_with_user_id", user.id);

    setMyShares((ownerShares as ProfileShare[]) || []);
    
    // For received shares, fetch owner profile names
    const sharedProfiles: SharedProfile[] = [];
    for (const share of receivedShares || []) {
      // Fetch owner's profile to get their name
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("user_id", share.owner_id)
        .maybeSingle();
      
      // Also try to get owner's email from the share record
      // The shared_with_email is the recipient's email, not owner's
      // We need to get owner info differently - use a fallback
      const ownerName = ownerProfile?.full_name || 
        (ownerProfile?.first_name && ownerProfile?.last_name 
          ? `${ownerProfile.first_name} ${ownerProfile.last_name}` 
          : ownerProfile?.first_name || null);
      
      sharedProfiles.push({
        owner_id: share.owner_id,
        owner_name: ownerName,
        owner_email: null, // We'll use owner_id as fallback display
        role: share.role,
      });
    }
    
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
        
        // Find any shares matching this email that don't have a user_id linked yet
        const { data: pendingShares, error: pendingError } = await supabase
          .from("profile_shares")
          .select("id")
          .ilike("shared_with_email", normalizedEmail)
          .is("shared_with_user_id", null);
        
        if (!pendingError && pendingShares && pendingShares.length > 0) {
          // Link them to this user
          const { error: updateError } = await supabase
            .from("profile_shares")
            .update({ shared_with_user_id: user.id })
            .in("id", pendingShares.map(s => s.id));
          
          if (updateError) {
            console.error("Error linking pending shares:", updateError);
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

      // STEP 4: No valid stored preference - apply auto-selection logic
      if (profiles.length === 0) {
        // No shared profiles, default to own profile
        setActiveProfileOwnerIdState(null);
        storeActiveProfile(user.id, null);
      } else if (profiles.length === 1) {
        // Exactly 1 shared profile - auto-select it
        setActiveProfileOwnerIdState(profiles[0].owner_id);
        storeActiveProfile(user.id, profiles[0].owner_id);
      } else {
        // Multiple shared profiles - require selection
        // Default to own profile but flag that selection is needed
        setActiveProfileOwnerIdState(null);
        setNeedsProfileSelection(true);
      }
      
      setInitialized(true);
    }

    linkAndInitialize();
  }, [user, fetchShares]);

  async function inviteUser(email: string, role: "viewer" | "contributor"): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check max 2 shares limit
    if (myShares.length >= 2) {
      return { error: "Maximum 2 shared people allowed" };
    }

    // Check if already shared with this email
    if (myShares.some(s => s.shared_with_email === normalizedEmail)) {
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
      });

    if (error) {
      // Log full error for debugging in dev/preview
      console.error("Error inviting user:", JSON.stringify(error, null, 2));
      
      // Return the actual error message from the backend
      const errorMessage = error.message || error.code || "Failed to invite user";
      return { error: errorMessage };
    }

    await fetchShares();
    return {};
  }

  async function revokeAccess(shareId: string): Promise<{ error?: string }> {
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase
      .from("profile_shares")
      .delete()
      .eq("id", shareId)
      .eq("owner_id", user.id);

    if (error) {
      console.error("Error revoking access:", error);
      return { error: "Failed to revoke access" };
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

export function useSharing(): SharingContextType {
  const context = useContext(SharingContext);
  if (context === undefined) {
    throw new Error("useSharing must be used within a SharingProvider");
  }
  return context;
}
