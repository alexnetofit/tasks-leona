import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/config/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isRecovery: boolean;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_PROFILE_RETRIES = 3;
const PROFILE_RETRY_DELAY = 800;
const AUTH_TIMEOUT = 8000; // 8s max para loading

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const initialized = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    for (let attempt = 1; attempt <= MAX_PROFILE_RETRIES; attempt++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn(`[Auth] Profile fetch attempt ${attempt} failed:`, error.message);
          if (attempt < MAX_PROFILE_RETRIES) {
            await new Promise((r) => setTimeout(r, PROFILE_RETRY_DELAY));
            continue;
          }
          return null;
        }

        return data as Profile | null;
      } catch (err) {
        console.warn(`[Auth] Profile fetch attempt ${attempt} error:`, err);
        if (attempt < MAX_PROFILE_RETRIES) {
          await new Promise((r) => setTimeout(r, PROFILE_RETRY_DELAY));
        }
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Safety timeout — nunca ficar em loading infinito
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      console.warn('[Auth] Safety timeout — forçando fim do loading');
    }, AUTH_TIMEOUT);

    const initAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          const p = await fetchProfile(existingSession.user.id);
          setProfile(p);
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    };

    initAuth();

    // Listener para mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Detectar fluxo de recuperação de senha
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovery(true);
        }

        if (newSession?.user) {
          // Não bloquear — fetch em background
          fetchProfile(newSession.user.id).then((p) => setProfile(p));
        } else {
          setProfile(null);
        }

        // Sempre liberar o loading
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';

  const clearRecovery = () => setIsRecovery(false);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, isAdmin, isRecovery, clearRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
