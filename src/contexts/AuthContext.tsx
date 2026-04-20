import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureSubscriptionRow } from "@/lib/subscriptions";
import { App } from "@capacitor/app";
import { getIsAndroidNative } from "@/utils/platform";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isRecoveryMode: boolean;
  clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        if (event === "PASSWORD_RECOVERY") {
          setIsRecoveryMode(true);
        }
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        
        // Fire-and-forget: ensure subscription row exists
        // IMPORTANT: Pass userId directly — never call getUser()/getSession()
        // inside onAuthStateChange as it can cause session clearing loops.
        if (newSession?.user) {
          ensureSubscriptionRow(newSession.user.id).catch(err => 
            console.warn("Background subscription check failed:", err)
          );
        }
      }
    );

    // THEN check for existing session (only once)
    if (!initializedRef.current) {
      initializedRef.current = true;
      supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
        if (!mounted) return;
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setLoading(false);
        
        // Fire-and-forget: ensure subscription row exists
        // Pass userId directly to avoid calling getUser() during bootstrap.
        if (existingSession?.user) {
          ensureSubscriptionRow(existingSession.user.id).catch(err => 
            console.warn("Background subscription check failed:", err)
          );
        }
      }).catch((err) => {
        console.warn("[AuthContext] getSession failed:", err);
        if (mounted) setLoading(false);
      });
    }

    // Safety watchdog: force loading to false after 3 seconds
    const watchdog = setTimeout(() => {
      if (mounted) {
        setLoading(prev => {
          if (prev) {
            console.warn("[AuthContext] Watchdog triggered - forcing loading=false");
          }
          return false;
        });
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  // Handle custom URI scheme deep links on Android (e.g. password recovery)
  useEffect(() => {
    if (!getIsAndroidNative()) return;

    const handleAppUrl = async (data: { url: string }) => {
      const url = data.url;
      if (!url.includes("myhealthhub://")) return;

      const hashPart = url.includes("#") ? url.split("#")[1] : url.split("?")[1];
      if (!hashPart) return;

      const params = new URLSearchParams(hashPart);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      const tokenHash = params.get("token_hash");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error && type === "recovery") {
          setIsRecoveryMode(true);
        }
        return;
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as any,
        });
        if (!error && type === "recovery") {
          setIsRecoveryMode(true);
        }
      }
    };

    let listenerHandle: any;
    App.addListener("appUrlOpen", handleAppUrl).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      listenerHandle?.remove();
    };
  }, []);

  // Resilient signOut: works even if user/session/profile is null
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[AuthContext] signOut backend call failed, completing local logout:", err);
    } finally {
      // Always clear local state regardless of backend response
      setUser(null);
      setSession(null);
    }
  };

  const clearRecoveryMode = () => setIsRecoveryMode(false);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, isRecoveryMode, clearRecoveryMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
