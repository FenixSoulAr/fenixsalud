import { useState, useEffect, useMemo } from "react";
import { Trash2, User, Shield, Bell, CreditCard, Crown, Users, Plus, Lock, Download, FileDown, Loader2, Pencil, Clock, AlertTriangle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { SharingSection } from "@/components/sharing/SharingSection";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSharing } from "@/contexts/SharingContext";
import { useEntitlementsContext } from "@/contexts/EntitlementsContext";
import { useEntitlementGate } from "@/hooks/useEntitlementGate";

import { useAccountActions } from "@/hooks/useAccountActions";
import { toast } from "sonner";
import { useTranslations, getLanguage } from "@/i18n";
import { useNavigate } from "react-router-dom";

const timezones = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"];

interface ProfileData {
  first_name: string;
  last_name: string;
  national_id: string;
  phone: string;
  insurance_provider: string;
  insurance_plan: string;
  insurance_member_id: string;
  allergies: string;
  notes: string;
}

interface SettingsData {
  timezone: string;
  notification_in_app: boolean;
  notification_email: boolean;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { canManageSharing, refreshProfiles } = useSharing();
  const { isPlus, isPro, isAdmin, hasPromoOverride, promoExpiresAt, maxProfiles, maxAttachments, canExportPdf, canExportBackup, planName, loading: entitlementsLoading } = useEntitlementsContext();
  const { checkProfileLimit, gatedMessages } = useEntitlementGate();
  
  const { exporting, exportResult, deleting, exportUserData, deleteAccount, hasRecentExport, getTotalRecords, getAttachmentCount } = useAccountActions();
  const navigate = useNavigate();
  const lang = getLanguage();
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({ timezone: "UTC", notification_in_app: true, notification_email: false });
  const [passwordForm, setPasswordForm] = useState({ current: "", newPassword: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [familyProfiles, setFamilyProfiles] = useState<{ id: string; full_name: string | null }[]>([]);
  const [creatingFamilyProfile, setCreatingFamilyProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [showAddProfileForm, setShowAddProfileForm] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editProfileName, setEditProfileName] = useState("");
  const [savingFamilyProfile, setSavingFamilyProfile] = useState(false);
  const [deletingFamilyProfileId, setDeletingFamilyProfileId] = useState<string | null>(null);
  const [closeAccountConfirmed, setCloseAccountConfirmed] = useState(false);
  const [showExportFirstDialog, setShowExportFirstDialog] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    first_name: "",
    last_name: "",
    national_id: "",
    phone: "",
    insurance_provider: "",
    insurance_plan: "",
    insurance_member_id: "",
    allergies: "",
    notes: "",
  });

  useEffect(() => { if (user) fetchData(); }, [user]);

  async function fetchData() {
    setLoading(true);
    
    // Fetch user's primary profile (where user_id = owner_user_id)
    const { data } = await supabase
      .from("profiles")
      .select("timezone, notification_in_app, notification_email, first_name, last_name, national_id, phone, insurance_provider, insurance_plan, insurance_member_id, allergies, notes")
      .eq("owner_user_id", user!.id)
      .eq("user_id", user!.id)
      .maybeSingle();
    
    if (data) {
      setSettings({
        timezone: data.timezone || "UTC",
        notification_in_app: data.notification_in_app ?? true,
        notification_email: data.notification_email ?? false,
      });
      setProfile({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        national_id: data.national_id || "",
        phone: data.phone || "",
        insurance_provider: data.insurance_provider || "",
        insurance_plan: data.insurance_plan || "",
        insurance_member_id: data.insurance_member_id || "",
        allergies: data.allergies || "",
        notes: data.notes || "",
      });
    }
    
    // Fetch all profiles owned by this user (using owner_user_id)
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, user_id")
      .eq("owner_user_id", user!.id)
      .order("created_at", { ascending: true });
    
    // Family profiles are those where user_id is NULL (not the primary profile)
    setFamilyProfiles(
      (allProfiles || [])
        .filter(p => p.user_id !== user!.id)
        .map(p => ({ id: p.id, full_name: p.full_name }))
    );
    
    setLoading(false);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    const { error } = await supabase.from("profiles").update(settings)
      .eq("owner_user_id", user!.id)
      .eq("user_id", user!.id);
    setSavingSettings(false);
    if (error) { toast.error(t.toast.couldNotSaveSettings); return; }
    toast.success(t.toast.settingsSaved);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    
    if (!profile.first_name.trim()) { toast.error(t.toast.firstNameRequired); return; }
    if (!profile.last_name.trim()) { toast.error(t.toast.lastNameRequired); return; }
    
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update(profile)
      .eq("owner_user_id", user!.id)
      .eq("user_id", user!.id);
    setSavingProfile(false);
    if (error) { toast.error(t.toast.couldNotSaveProfile); return; }
    toast.success(t.toast.profileSaved);
    // Sync updated name back to SharingContext so sidebar/banner stay current
    refreshProfiles();
  }

  async function handleDeleteProfileData() {
    setDeletingProfile(true);
    const { error } = await supabase.from("profiles").update({
      first_name: null,
      last_name: null,
      national_id: null,
      phone: null,
      insurance_provider: null,
      insurance_plan: null,
      insurance_member_id: null,
      allergies: null,
      notes: null,
    }).eq("owner_user_id", user!.id).eq("user_id", user!.id);
    
    setDeletingProfile(false);
    if (error) { toast.error(t.toast.couldNotDeleteProfile); return; }
    
    setProfile({
      first_name: "",
      last_name: "",
      national_id: "",
      phone: "",
      insurance_provider: "",
      insurance_plan: "",
      insurance_member_id: "",
      allergies: "",
      notes: "",
    });
    toast.success(t.toast.profileDeleted);
  }

  async function handleCloseAccount() {
    if (!hasRecentExport()) {
      setShowExportFirstDialog(true);
      return;
    }
    await performAccountDeletion();
  }

  async function performAccountDeletion() {
    const result = await deleteAccount();
    if (result.success) {
      await signOut();
      toast.success(t.toast.accountDeleted);
      navigate("/auth/sign-in");
    } else {
      toast.error(t.toast.error);
    }
  }

  async function handleExportData() {
    const result = await exportUserData();
    if (result.success) {
      toast.success(t.settings.exportReady);
    } else {
      toast.error(t.toast.error);
    }
  }

  async function handleAddFamilyProfile(e: React.FormEvent) {
    e.preventDefault();
    
    if (!newProfileName.trim()) {
      toast.error(t.settings.profileName + " " + t.settings.required);
      return;
    }
    
    // Server-side profile limit validation (backend-enforced)
    try {
      const { data: serverCheck, error: checkError } = await supabase.functions.invoke("validate-profile-creation");
      if (checkError) {
        console.error("Server-side profile validation error:", checkError);
        // Fallback to client-side check
        const canCreate = await checkProfileLimit();
        if (!canCreate) return;
      } else if (serverCheck && !serverCheck.allowed) {
        toast.error("Límite de perfiles alcanzado. Actualizá tu plan para crear más perfiles.");
        return;
      }
    } catch (e) {
      console.error("Error calling validate-profile-creation, falling back to client check:", e);
      const canCreate = await checkProfileLimit();
      if (!canCreate) return;
    }
    
    setCreatingFamilyProfile(true);
    
    // Insert new family profile with owner_user_id set to current user
    // user_id is NULL for family profiles (only primary profile has user_id = owner_user_id)
    const { error } = await supabase.from("profiles").insert({
      owner_user_id: user!.id,
      user_id: null, // Family profiles don't have a linked auth user
      full_name: newProfileName.trim(),
    });
    
    setCreatingFamilyProfile(false);
    
    if (error) {
      console.error("Error creating family profile:", error);
      toast.error(t.toast.error);
      return;
    }
    
    toast.success(t.toast.familyProfileCreated);
    setNewProfileName("");
    setShowAddProfileForm(false);
    fetchData();
    refreshProfiles(); // Sync to SharingContext
  }

  async function handleEditFamilyProfile(e: React.FormEvent) {
    e.preventDefault();
    
    if (!editingProfileId || !editProfileName.trim()) {
      toast.error(t.settings.profileName + " " + t.settings.required);
      return;
    }
    
    setSavingFamilyProfile(true);
    
    const { error } = await supabase.from("profiles").update({
      full_name: editProfileName.trim(),
    }).eq("id", editingProfileId).eq("owner_user_id", user!.id);
    
    setSavingFamilyProfile(false);
    
    if (error) {
      console.error("Error updating family profile:", error);
      toast.error(t.toast.error);
      return;
    }
    
    toast.success(t.toast.profileSaved);
    setEditingProfileId(null);
    setEditProfileName("");
    fetchData();
    refreshProfiles(); // Sync to SharingContext
  }

  async function handleDeleteFamilyProfile(profileId: string) {
    setDeletingFamilyProfileId(profileId);
    
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", profileId)
      .eq("owner_user_id", user!.id)
      .is("user_id", null); // Only delete family profiles (not primary)
    
    setDeletingFamilyProfileId(null);
    
    if (error) {
      console.error("Error deleting family profile:", error);
      toast.error(t.toast.error);
      return;
    }
    
    toast.success(t.toast.profileDeleted);
    fetchData();
    refreshProfiles(); // Sync to SharingContext
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    
    if (!passwordForm.current.trim()) {
      toast.error(t.settings.currentPassword + " " + t.form.required);
      return;
    }
    
    const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(passwordForm.newPassword);
    if (passwordForm.newPassword.length < 10 || !hasNumberOrSymbol) {
      toast.error(t.toast.passwordRequirements);
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.error(t.toast.passwordsNoMatch);
      return;
    }
    
    setSavingPassword(true);
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: passwordForm.current,
    });
    
    if (signInError) {
      setSavingPassword(false);
      toast.error(t.toast.signInAgain);
      return;
    }
    
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });
    
    setSavingPassword(false);
    
    if (error) {
      toast.error(t.toast.couldNotUpdatePassword);
      return;
    }
    
    setPasswordForm({ current: "", newPassword: "", confirm: "" });
    toast.success(t.toast.passwordUpdated);
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader 
        variant="gradient"
        title={t.settings.title}
        description={t.settings.description}
      />

      <div className="max-w-2xl space-y-8">
        {/* Profile Section */}
        <section className="health-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            {t.settings.patientProfile}
          </h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-field">
                <Label>{t.settings.firstName} *</Label>
                <Input 
                  value={profile.first_name} 
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} 
                  placeholder={t.settings.firstName}
                />
              </div>
              <div className="form-field">
                <Label>{t.settings.lastName} *</Label>
                <Input 
                  value={profile.last_name} 
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} 
                  placeholder={t.settings.lastName}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="form-field">
                <Label>{t.settings.nationalId}</Label>
                <Input 
                  value={profile.national_id} 
                  onChange={(e) => setProfile({ ...profile, national_id: e.target.value })} 
                  placeholder={t.settings.optional}
                />
              </div>
              <div className="form-field">
                <Label>{t.settings.phone}</Label>
                <Input 
                  value={profile.phone} 
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })} 
                  placeholder={t.settings.optional}
                />
              </div>
            </div>
            
            <div className="form-field">
              <Label>{t.settings.email}</Label>
              <Input 
                value={user?.email || ""} 
                disabled 
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">{t.settings.emailCannotChange}</p>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium mb-3">{t.settings.insuranceInfo}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="form-field">
                  <Label>{t.settings.provider}</Label>
                  <Input 
                    value={profile.insurance_provider} 
                    onChange={(e) => setProfile({ ...profile, insurance_provider: e.target.value })} 
                    placeholder={t.settings.optional}
                  />
                </div>
                <div className="form-field">
                  <Label>{t.settings.plan}</Label>
                  <Input 
                    value={profile.insurance_plan} 
                    onChange={(e) => setProfile({ ...profile, insurance_plan: e.target.value })} 
                    placeholder={t.settings.optional}
                  />
                </div>
                <div className="form-field">
                  <Label>{t.settings.memberId}</Label>
                  <Input 
                    value={profile.insurance_member_id} 
                    onChange={(e) => setProfile({ ...profile, insurance_member_id: e.target.value })} 
                    placeholder={t.settings.optional}
                  />
                </div>
              </div>
            </div>
            
            <div className="form-field">
              <Label>{t.settings.allergies}</Label>
              <Textarea 
                value={profile.allergies} 
                onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} 
                placeholder={t.settings.allergiesPlaceholder}
                rows={2}
              />
            </div>
            
            <div className="form-field">
              <Label>{t.settings.notes}</Label>
              <Textarea 
                value={profile.notes} 
                onChange={(e) => setProfile({ ...profile, notes: e.target.value })} 
                placeholder={t.settings.notesPlaceholder}
                rows={2}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? t.settings.saving : t.settings.saveProfile}
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" type="button" disabled={deletingProfile} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />{deletingProfile ? t.settings.deleting : t.settings.deleteProfileData}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.settings.deleteProfileTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{t.settings.deleteProfileDescription}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProfileData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.actions.delete}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </section>

        {/* Plan & Subscription Section - Only show for non-admins */}
        {!isAdmin && (
          <PlanSubscriptionSection 
            t={t}
            isPlus={isPlus}
            isPro={isPro}
            hasPromoOverride={hasPromoOverride}
            promoExpiresAt={promoExpiresAt}
            maxProfiles={maxProfiles}
            maxAttachments={maxAttachments}
            planName={planName}
          />
        )}

        {/* Family Profiles Section */}
        <section className="health-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t.settings.familyProfiles}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {t.settings.familyProfilesDesc}
          </p>
          
          <div className="space-y-4">
            {/* Current profile count */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span className="text-sm">
                {t.settings.profiles}: {familyProfiles.length + 1} / {maxProfiles === 1 ? 1 : maxProfiles}
              </span>
            </div>
            
            {/* Family profiles list */}
            {familyProfiles.length > 0 && (
              <div className="space-y-2">
                {familyProfiles.map((fp) => (
                  <div key={fp.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    {editingProfileId === fp.id ? (
                      <form onSubmit={handleEditFamilyProfile} className="flex-1 flex items-center gap-2">
                        <Input
                          value={editProfileName}
                          onChange={(e) => setEditProfileName(e.target.value)}
                          placeholder={t.settings.profileName}
                          className="flex-1"
                          autoFocus
                          disabled={savingFamilyProfile}
                        />
                        <Button type="submit" size="sm" disabled={savingFamilyProfile}>
                          {savingFamilyProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : t.actions.save}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setEditingProfileId(null);
                            setEditProfileName("");
                          }}
                        >
                          {t.actions.cancel}
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="font-medium">{fp.full_name || "Unnamed"}</span>
                        {isPlus && (
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingProfileId(fp.id);
                                setEditProfileName(fp.full_name || "");
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  disabled={deletingFamilyProfileId === fp.id}
                                >
                                  {deletingFamilyProfileId === fp.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t.settings.deleteFamilyProfile || "Delete Family Profile"}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t.settings.deleteFamilyProfileDesc || "This will permanently delete this family profile and all associated health data. This action cannot be undone."}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteFamilyProfile(fp.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    {t.actions.delete}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            
        {/* Add profile form (Pro only for multi-profiles) */}
            {isPlus ? (
              <>
                {showAddProfileForm ? (
                  <form onSubmit={handleAddFamilyProfile} className="space-y-3 p-3 border border-border rounded-lg">
                    <div className="form-field">
                      <Label>{t.settings.profileName} *</Label>
                      <Input
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="e.g., Mom, Dad, Child"
                        disabled={creatingFamilyProfile}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" disabled={creatingFamilyProfile}>
                        {creatingFamilyProfile ? t.settings.creatingProfile : t.actions.create}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setShowAddProfileForm(false);
                          setNewProfileName("");
                        }}
                      >
                        {t.actions.cancel}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddProfileForm(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t.settings.addFamilyProfile}
                  </Button>
                )}
                
                {familyProfiles.length === 0 && !showAddProfileForm && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {t.settings.noFamilyProfilesDescPlus}
                  </p>
                )}
              </>
            ) : (
              /* Free plan - show upgrade prompt for multi-profiles */
              <div className="text-center py-4 space-y-3">
                <Crown className="h-10 w-10 mx-auto text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">{t.settings.multipleProfPlusOnly}</p>
                  <p className="text-sm text-muted-foreground">{t.settings.noFamilyProfilesDescFree}</p>
                </div>
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => navigate("/pricing?highlight=pro")}
                >
                  {lang === "es" ? "Ver planes" : "See plans"}
                </Button>
              </div>
            )}
          </div>
        </section>


        {/* Sharing Section */}
        <SharingSection />

        {/* Notifications Section */}
        <section className="health-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t.settings.notifications}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t.settings.inAppReminders}</Label>
                <p className="text-sm text-muted-foreground">{t.settings.inAppRemindersDesc}</p>
              </div>
              <Switch checked={settings.notification_in_app} onCheckedChange={(v) => setSettings({ ...settings, notification_in_app: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t.settings.emailReminders}</Label>
                <p className="text-sm text-muted-foreground">{t.settings.emailRemindersDesc}</p>
              </div>
              <Switch checked={settings.notification_email} onCheckedChange={(v) => setSettings({ ...settings, notification_email: v })} />
            </div>
            
            <div className="border-t pt-4 mt-4">
              <div className="form-field">
                <Label>{t.settings.timezone}</Label>
                <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
                  <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{timezones.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? t.settings.saving : t.settings.saveSettings}
            </Button>
          </div>
        </section>

        {/* Security Section */}
        <section className="health-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t.settings.security}
          </h2>
          
          <div className="space-y-6">
            {/* Change Password */}
            <div>
              <h3 className="text-sm font-medium mb-3">{t.settings.updatePassword}</h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="form-field">
                  <Label>{t.settings.currentPassword}</Label>
                  <Input 
                    type="password" 
                    value={passwordForm.current} 
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} 
                    placeholder={t.settings.currentPassword}
                  />
                </div>
                <div className="form-field">
                  <Label>{t.settings.newPassword}</Label>
                  <Input 
                    type="password" 
                    value={passwordForm.newPassword} 
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} 
                    placeholder={t.settings.newPassword}
                  />
                </div>
                <div className="form-field">
                  <Label>{t.settings.confirmPassword}</Label>
                  <Input 
                    type="password" 
                    value={passwordForm.confirm} 
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} 
                    placeholder={t.settings.confirmPassword}
                  />
                </div>
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? t.settings.updating : t.settings.updatePassword}
                </Button>
              </form>
            </div>
            
            {/* Danger Zone - replaced with Data & Account section below */}
          </div>
        </section>

        {/* Data & Account Section */}
        <section className="health-card border-destructive/20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Database className="h-5 w-5" />
            {t.settings.dataAndAccount}
          </h2>
          
          <div className="space-y-6">
            {/* Export Data */}
            <div>
              <h3 className="text-sm font-medium mb-2">{t.settings.exportMyData}</h3>
              <p className="text-sm text-muted-foreground mb-3">{t.settings.exportMyDataDesc}</p>
              
              {(isPro || isAdmin) ? (
                <>
                  {exportResult ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <p className="text-sm font-medium text-primary">{t.settings.exportReady}</p>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p>{getTotalRecords()} {t.settings.recordsExported}</p>
                          {getAttachmentCount() > 0 && (
                            <p>{getAttachmentCount()} {t.settings.attachmentsIncluded}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (exportResult.signedUrl && exportResult.signedUrl.startsWith("https://")) {
                              window.location.assign(exportResult.signedUrl);
                            }
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          {t.settings.downloadExport}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.settings.expiresIn24Hours}</p>
                    </div>
                  ) : (
                    <Button onClick={handleExportData} disabled={exporting} variant="outline">
                      {exporting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t.settings.exportingData}
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          {t.settings.exportMyData}
                        </>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-lg border border-border bg-muted/30 text-center space-y-3">
                  <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium">{lang === "es" ? "Función exclusiva del plan Pro" : "Pro plan exclusive feature"}</p>
                    <p className="text-sm text-muted-foreground">
                      {lang === "es" 
                        ? "Exportar tus datos y hacer backup completo está disponible en el plan Pro. Actualizá tu plan para acceder a esta función."
                        : "Exporting your data and full backup is available on the Pro plan. Upgrade your plan to access this feature."}
                    </p>
                  </div>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => navigate("/pricing?highlight=pro")}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    {lang === "es" ? "Ver planes" : "See plans"}
                  </Button>
                </div>
              )}
            </div>
            
            {/* Close Account */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-destructive mb-2">{t.settings.closeAccount}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t.settings.closeAccountDesc}</p>
              
              <div className="flex items-start gap-2 mb-4">
                <Checkbox 
                  id="confirm-close"
                  checked={closeAccountConfirmed}
                  onCheckedChange={(checked) => setCloseAccountConfirmed(checked === true)}
                />
                <Label htmlFor="confirm-close" className="text-sm cursor-pointer">
                  {t.settings.closeAccountConfirm}
                </Label>
              </div>
              
              <Button 
                variant="destructive" 
                disabled={!closeAccountConfirmed || deleting}
                onClick={handleCloseAccount}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.settings.closingAccount}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t.settings.closeAccount}
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* Export First Dialog */}
        <Dialog open={showExportFirstDialog} onOpenChange={setShowExportFirstDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.settings.downloadDataFirst}</DialogTitle>
              <DialogDescription>{t.settings.downloadDataFirstDesc}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => {
                setShowExportFirstDialog(false);
                handleExportData();
              }}>
                <Download className="h-4 w-4 mr-2" />
                {t.settings.exportNow}
              </Button>
              <Button variant="destructive" onClick={() => {
                setShowExportFirstDialog(false);
                performAccountDeletion();
              }}>
                {t.settings.deleteAnyway}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Plan & Subscription Section Component
interface PlanSubscriptionSectionProps {
  t: ReturnType<typeof useTranslations>;
  isPlus: boolean;
  isPro: boolean;
  hasPromoOverride: boolean;
  promoExpiresAt: string | null;
  maxProfiles: number;
  maxAttachments: number;
  planName: string;
}

function PlanSubscriptionSection({
  t,
  isPlus,
  isPro,
  hasPromoOverride,
  promoExpiresAt,
  maxProfiles,
  maxAttachments,
  planName,
}: PlanSubscriptionSectionProps) {
  const navigate = useNavigate();
  const lang = getLanguage();
  // Calculate days until expiration
  const expirationInfo = useMemo(() => {
    if (!hasPromoOverride || !promoExpiresAt) {
      return null;
    }
    
    const expiresDate = new Date(promoExpiresAt);
    const now = new Date();
    const diffTime = expiresDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      date: expiresDate,
      daysLeft: diffDays,
      isExpiringSoon: diffDays <= 7 && diffDays > 0,
      isExpired: diffDays <= 0,
    };
  }, [hasPromoOverride, promoExpiresAt]);

  const formatExpiryDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
  };

  return (
    <section className="health-card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        {t.settings.planSubscription || "Plan & Subscription"}
      </h2>
      
      <div className="space-y-4">
        {/* Current Plan */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            {(isPlus || isPro) ? (
              <Crown className="h-5 w-5 text-primary" />
            ) : (
              <div className="h-5 w-5 rounded-full bg-muted-foreground/20" />
            )}
            <div>
              <p className="font-medium">
                {isPro
                  ? (planName || "Pro")
                  : isPlus
                    ? (hasPromoOverride
                        ? (t.settings.plusPromo || "Plus (Promo)")
                        : planName || (t.settings.plusPlan || "Plus"))
                    : (t.settings.freePlan || "Free")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.settings.currentPlan || "Current plan"}
              </p>
            </div>
          </div>
        </div>

        {/* Promo Expiration Info */}
        {hasPromoOverride && (
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${
            expirationInfo?.isExpiringSoon 
              ? "border-warning bg-warning/10" 
              : "border-border bg-muted/30"
          }`}>
            {expirationInfo?.isExpiringSoon ? (
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              {promoExpiresAt && expirationInfo ? (
                <>
                  <p className="text-sm font-medium">
                    {expirationInfo.isExpiringSoon 
                      ? (t.settings.promoExpiringSoon || "Promo expiring soon!")
                      : `Tu acceso Plus promocional vence el ${formatExpiryDate(expirationInfo.date)}.`}
                  </p>
                  {expirationInfo.daysLeft > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {expirationInfo.daysLeft} {expirationInfo.daysLeft === 1 
                        ? (t.settings.dayLeft || "day left") 
                        : (t.settings.daysLeft || "days left")}
                    </p>
                  )}
                  {expirationInfo.isExpiringSoon && (
                    <div className="mt-3">
                      <Button 
                        onClick={() => navigate("/pricing?highlight=plus")} 
                        size="sm"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        {lang === "es" ? "Ver planes" : "See plans"}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm font-medium">
                  Tenés acceso Plus promocional activo.
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Limits Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">{maxProfiles}</p>
            <p className="text-xs text-muted-foreground">
              {maxProfiles === 1 
                ? (t.settings.profile || "Profile") 
                : (t.settings.profiles || "Profiles")}
            </p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">
              {maxAttachments >= 9999 ? "∞" : maxAttachments}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.settings.attachments || "Attachments"}
            </p>
          </div>
        </div>
        
        {/* Upgrade CTAs — always route to /pricing for consistent toggle flow */}
        {!isPlus && !isPro && (
          <Button 
            onClick={() => navigate("/pricing")} 
            className="w-full"
            variant="default"
          >
            <Crown className="h-4 w-4 mr-2" />
            {lang === "es" ? "Ver planes" : "See plans"}
          </Button>
        )}

        {isPlus && !isPro && !hasPromoOverride && (
          <Button
            onClick={() => navigate("/pricing")}
            className="w-full"
            variant="outline"
          >
            {lang === "es" ? "Ver planes" : "See plans"}
          </Button>
        )}
        
        {(isPlus || isPro) && !hasPromoOverride && (
          <p className="text-sm text-muted-foreground text-center">
            {t.settings.plusActive || "Thank you for your support!"}
          </p>
        )}
      </div>
    </section>
  );
}
