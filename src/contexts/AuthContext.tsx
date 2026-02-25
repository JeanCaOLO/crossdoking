
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'ADMIN' | 'OPERATOR' | 'VISUALIZADOR';

interface User {
  id: string;
  auth_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Normaliza roles legacy de la BD al nuevo esquema
function normalizeRole(role: string): UserRole {
  const map: Record<string, UserRole> = {
    ADMIN: 'ADMIN',
    OPERATOR: 'OPERATOR',
    OPERADOR: 'OPERATOR',
    SUPERVISOR: 'OPERATOR',
    VISUALIZADOR: 'VISUALIZADOR',
    AUDITOR: 'VISUALIZADOR',
  };
  return map[role?.toUpperCase()] ?? 'OPERATOR';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const loadUserProfile = async (authUser: AuthUser): Promise<User | null> => {
    try {
      const { data: profile, error: profileError } = await supabase
        .schema('public')
        .from('users')
        .select('id, auth_id, email, full_name, role, active, created_at')
        .eq('auth_id', authUser.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setUser(null);
        return null;
      }

      if (!profile) {
        const newProfile = {
          auth_id: authUser.id,
          email: authUser.email!,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
          role: 'OPERADOR',
          active: true,
        };

        const { data: createdProfile, error: createError } = await supabase
          .schema('public')
          .from('users')
          .insert(newProfile)
          .select()
          .single();

        if (createError) {
          setError(createError.message);
          setUser(null);
          return null;
        }

        const normalized: User = {
          ...createdProfile,
          role: normalizeRole(createdProfile.role),
        };
        setUser(normalized);
        setError(null);
        return normalized;
      }

      const normalized: User = {
        ...profile,
        role: normalizeRole(profile.role),
      };
      setUser(normalized);
      setError(null);
      return normalized;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando perfil');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initAuth = async () => {
      try {
        setLoading(true);
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setError(sessionError.message);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        if (!currentSession) {
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(currentSession);
        loadUserProfile(currentSession.user).catch(() => setLoading(false));
      } catch (err: any) {
        setError(err.message || 'Error al inicializar autenticación');
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession) {
          setSession(newSession);
          setLoading(true);
          loadUserProfile(newSession.user).catch(() => setLoading(false));
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) throw signInError;
      if (!data.session) throw new Error('No se pudo iniciar sesión');

      setSession(data.session);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
      setUser(null);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, error, signIn, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
