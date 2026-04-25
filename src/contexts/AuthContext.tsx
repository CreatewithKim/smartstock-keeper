import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { startSync, stopSyncAndClear } from "@/services/syncService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSyncedUserId = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleSession = (session: Session | null) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      const newUserId = session?.user?.id ?? null;
      if (newUserId && newUserId !== lastSyncedUserId.current) {
        lastSyncedUserId.current = newUserId;
        // Defer to keep auth callback fast and avoid blocking React state.
        setTimeout(() => {
          startSync(newUserId).catch((err) =>
            console.warn("[auth] startSync failed", err)
          );
        }, 0);
      } else if (!newUserId && lastSyncedUserId.current) {
        lastSyncedUserId.current = null;
        setTimeout(() => {
          stopSyncAndClear().catch((err) =>
            console.warn("[auth] stopSyncAndClear failed", err)
          );
        }, 0);
      }
    };

    // Listener first so we never miss an auth event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => handleSession(session)
    );

    // Then hydrate from the persisted session in localStorage.
    supabase.auth.getSession().then(({ data: { session } }) => handleSession(session));

    return () => {
      isMounted = false;
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
};
