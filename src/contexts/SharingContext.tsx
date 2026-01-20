import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SharingRole = "owner" | "viewer" | "contributor" | null;

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
  // Current user's role when viewing data
  currentRole: SharingRole;
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
  // Actions
  inviteUser: (email: string, role: "viewer" | "contributor") => Promise<{ error?: string }>;
  revokeAccess: (shareId: string) => Promise<{ error?: string }>;
  updateRole: (shareId: string, role: "viewer" | "contributor") => Promise<{ error?: string }>;
  switchToProfile: (ownerId: string) => void;
  switchToOwnProfile: () => void;
  refreshShares: () => Promise<void>;
  // Helpers
  canEdit: boolean;
  canDelete: boolean;
  canManageSharing: boolean;
  isViewingOwnProfile: boolean;
}

const SharingContext = createContext<SharingContextType | undefined>(undefined);

export function SharingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [myShares, setMyShares] = useState<ProfileShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<SharedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfileOwnerId, setActiveProfileOwnerId] = useState<string | null>(null);

  // Determine current role based on active profile
  const isViewingOwnProfile = !activeProfileOwnerId || activeProfileOwnerId === user?.id;
  
  const currentRole: SharingRole = (() => {
    if (!user) return null;
    if (isViewingOwnProfile) return "owner";
    const share = sharedWithMe.find(s => s.owner_id === activeProfileOwnerId);
    return share?.role ?? null;
  })();

  const canEdit = currentRole === "owner" || currentRole === "contributor";
  const canDelete = currentRole === "owner";
  const canManageSharing = currentRole === "owner";

  async function fetchShares() {
    if (!user) {
      setMyShares([]);
      setSharedWithMe([]);
      setLoading(false);
      return;
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
      
      const ownerName = ownerProfile?.full_name || 
        (ownerProfile?.first_name && ownerProfile?.last_name 
          ? `${ownerProfile.first_name} ${ownerProfile.last_name}` 
          : ownerProfile?.first_name || null);
      
      sharedProfiles.push({
        owner_id: share.owner_id,
        owner_name: ownerName,
        owner_email: share.shared_with_email,
        role: share.role,
      });
    }
    
    setSharedWithMe(sharedProfiles);
    setLoading(false);
  }

  useEffect(() => {
    fetchShares();
  }, [user]);

  // Auto-switch to a shared profile if user has shared access and hasn't manually selected one
  useEffect(() => {
    if (!loading && user && sharedWithMe.length > 0 && !activeProfileOwnerId) {
      // If user has profiles shared with them, auto-select the first one
      // This ensures the banner shows when a collaborator/viewer logs in
      setActiveProfileOwnerId(sharedWithMe[0].owner_id);
    }
  }, [loading, user, sharedWithMe, activeProfileOwnerId]);

  // When user logs in, auto-link pending invitations
  useEffect(() => {
    async function linkPendingInvites() {
      if (!user?.email) return;
      
      // Find any shares that match this email but don't have user_id set
      const { data: pendingShares } = await supabase
        .from("profile_shares")
        .select("id")
        .eq("shared_with_email", user.email.toLowerCase())
        .is("shared_with_user_id", null);

      if (pendingShares && pendingShares.length > 0) {
        // Link them to this user
        await supabase
          .from("profile_shares")
          .update({ shared_with_user_id: user.id })
          .eq("shared_with_email", user.email.toLowerCase())
          .is("shared_with_user_id", null);

        // Refresh shares
        fetchShares();
      }
    }

    linkPendingInvites();
  }, [user]);

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
      console.error("Error inviting user:", error);
      return { error: "Failed to invite user" };
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

  async function updateRole(shareId: string, role: "viewer" | "contributor"): Promise<{ error?: string }> {
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
  const activeProfileOwnerName = (() => {
    if (isViewingOwnProfile) return null;
    const share = sharedWithMe.find(s => s.owner_id === activeProfileOwnerId);
    return share?.owner_name || share?.owner_email || null;
  })();

  return (
    <SharingContext.Provider
      value={{
        currentRole,
        activeProfileOwnerId: isViewingOwnProfile ? user?.id ?? null : activeProfileOwnerId,
        activeProfileOwnerName,
        myShares,
        sharedWithMe,
        loading,
        inviteUser,
        revokeAccess,
        updateRole,
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
