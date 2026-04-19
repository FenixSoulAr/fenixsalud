import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureSubscriptionRow } from "@/lib/subscriptions";

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
