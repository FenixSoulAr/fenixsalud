import { useState, useEffect } from "react";
import { Trash2, User, Shield, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { SharingSection } from "@/components/sharing/SharingSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSharing } from "@/contexts/SharingContext";
import { toast } from "sonner";
import { useTranslations } from "@/i18n";

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
  const { canManageSharing } = useSharing();
  const t = useTranslations();
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({ timezone: "UTC", notification_in_app: true, notification_email: false });
  const [passwordForm, setPasswordForm] = useState({ current: "", newPassword: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);
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
    const { data } = await supabase
      .from("profiles")
      .select("timezone, notification_in_app, notification_email, first_name, last_name, national_id, phone, insurance_provider, insurance_plan, insurance_member_id, allergies, notes")
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
    setLoading(false);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    const { error } = await supabase.from("profiles").update(settings).eq("user_id", user!.id);
    setSavingSettings(false);
    if (error) { toast.error(t.toast.couldNotSaveSettings); return; }
    toast.success(t.toast.settingsSaved);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    
    if (!profile.first_name.trim()) { toast.error(t.toast.firstNameRequired); return; }
    if (!profile.last_name.trim()) { toast.error(t.toast.lastNameRequired); return; }
    
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update(profile).eq("user_id", user!.id);
    setSavingProfile(false);
    if (error) { toast.error(t.toast.couldNotSaveProfile); return; }
    toast.success(t.toast.profileSaved);
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
    }).eq("user_id", user!.id);
    
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

  async function handleDeleteAccount() {
    await signOut();
    toast.success(t.toast.accountDeleted);
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
            
            {/* Danger Zone */}
            <div className="border-t pt-6">
              <h3 className="text-sm font-medium text-destructive mb-2">{t.settings.dangerZone}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t.settings.dangerZoneDesc}</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />{t.settings.deleteAccount}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.settings.deleteAccountTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{t.settings.deleteAccountDescription}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t.actions.delete}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
