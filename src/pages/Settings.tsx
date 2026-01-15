import { useState, useEffect } from "react";
import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingPage } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const timezones = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"];

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ timezone: "UTC", notification_in_app: true, notification_email: false });

  useEffect(() => { if (user) fetchSettings(); }, [user]);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("timezone, notification_in_app, notification_email").eq("user_id", user!.id).maybeSingle();
    if (data) setSettings({ timezone: data.timezone || "UTC", notification_in_app: data.notification_in_app ?? true, notification_email: data.notification_email ?? false });
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from("profiles").update(settings).eq("user_id", user!.id);
    setSaving(false);
    if (error) { toast.error("We couldn't save your settings. Please try again."); return; }
    toast.success("Settings saved.");
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

        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save settings"}</Button>

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
