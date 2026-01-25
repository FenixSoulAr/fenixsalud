import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureSubscriptionRow } from "@/lib/subscriptions";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Fire-and-forget: ensure subscription row exists (don't block)
        if (session?.user) {
          ensureSubscriptionRow().catch(err => 
            console.warn("Background subscription check failed:", err)
          );
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Fire-and-forget: ensure subscription row exists (don't block)
      if (session?.user) {
        ensureSubscriptionRow().catch(err => 
          console.warn("Background subscription check failed:", err)
        );
      }
    });

    // Safety watchdog: force loading to false after 3 seconds
    const watchdog = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[AuthContext] Watchdog triggered - forcing loading=false");
        setLoading(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
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
