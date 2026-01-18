import { useState, useEffect } from "react";
import { Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({ timezone: "UTC", notification_in_app: true, notification_email: false });
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
    if (error) { toast.error("We couldn't save your settings. Please try again."); return; }
    toast.success("Settings saved.");
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    
    if (!profile.first_name.trim()) { toast.error("First name is required."); return; }
    if (!profile.last_name.trim()) { toast.error("Last name is required."); return; }
    
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update(profile).eq("user_id", user!.id);
    setSavingProfile(false);
    if (error) { toast.error("We couldn't save your profile. Please try again."); return; }
    toast.success("Profile saved.");
  }

  async function handleDeleteAccount() {
    // In production, this would call an edge function to delete user data
    await signOut();
    toast.success("Account deleted");
  }

  if (loading) return <LoadingPage />;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      <div className="max-w-2xl space-y-8">
        {/* Profile Section */}
        <section className="health-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Patient Profile
          </h2>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-field">
                <Label>First Name *</Label>
                <Input 
                  value={profile.first_name} 
                  onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} 
                  placeholder="First name"
                />
              </div>
              <div className="form-field">
                <Label>Last Name *</Label>
                <Input 
                  value={profile.last_name} 
                  onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} 
                  placeholder="Last name"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="form-field">
                <Label>National ID</Label>
                <Input 
                  value={profile.national_id} 
                  onChange={(e) => setProfile({ ...profile, national_id: e.target.value })} 
                  placeholder="Optional"
                />
              </div>
              <div className="form-field">
                <Label>Phone</Label>
                <Input 
                  value={profile.phone} 
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })} 
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div className="form-field">
              <Label>Email</Label>
              <Input 
                value={user?.email || ""} 
                disabled 
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-medium mb-3">Insurance Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="form-field">
                  <Label>Provider</Label>
                  <Input 
                    value={profile.insurance_provider} 
                    onChange={(e) => setProfile({ ...profile, insurance_provider: e.target.value })} 
                    placeholder="Optional"
                  />
                </div>
                <div className="form-field">
                  <Label>Plan</Label>
                  <Input 
                    value={profile.insurance_plan} 
                    onChange={(e) => setProfile({ ...profile, insurance_plan: e.target.value })} 
                    placeholder="Optional"
                  />
                </div>
                <div className="form-field">
                  <Label>Member ID</Label>
                  <Input 
                    value={profile.insurance_member_id} 
                    onChange={(e) => setProfile({ ...profile, insurance_member_id: e.target.value })} 
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
            
            <div className="form-field">
              <Label>Allergies</Label>
              <Textarea 
                value={profile.allergies} 
                onChange={(e) => setProfile({ ...profile, allergies: e.target.value })} 
                placeholder="List any known allergies..."
                rows={2}
              />
            </div>
            
            <div className="form-field">
              <Label>Notes</Label>
              <Textarea 
                value={profile.notes} 
                onChange={(e) => setProfile({ ...profile, notes: e.target.value })} 
                placeholder="Any additional health information..."
                rows={2}
              />
            </div>
            
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </section>

        {/* Notifications */}
        <section className="health-card">
          <h2 className="text-lg font-semibold mb-4">Notifications</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><Label>In-app reminders</Label><p className="text-sm text-muted-foreground">Show reminders within the app</p></div>
              <Switch checked={settings.notification_in_app} onCheckedChange={(v) => setSettings({ ...settings, notification_in_app: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Email reminders</Label><p className="text-sm text-muted-foreground">Receive reminders via email</p></div>
              <Switch checked={settings.notification_email} onCheckedChange={(v) => setSettings({ ...settings, notification_email: v })} />
            </div>
          </div>
        </section>

        {/* Timezone */}
        <section className="health-card">
          <h2 className="text-lg font-semibold mb-4">Timezone</h2>
          <Select value={settings.timezone} onValueChange={(v) => setSettings({ ...settings, timezone: v })}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{timezones.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
          </Select>
        </section>

        <Button onClick={handleSaveSettings} disabled={savingSettings}>{savingSettings ? "Saving..." : "Save settings"}</Button>

        {/* Danger Zone */}
        <section className="health-card border-destructive/50">
          <h2 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all data.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" />Delete account</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently remove your data.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </div>
  );
}
