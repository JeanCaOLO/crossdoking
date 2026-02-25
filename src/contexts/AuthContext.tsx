
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  auth_id: string;
  email: string;
  full_name: string | null;
  role: 'ADMIN' | 'OPERADOR';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  // Función para cargar el perfil del usuario desde public.users
  const loadUserProfile = async (authUser: AuthUser): Promise<User | null> => {
    console.log('🔍 [AUTH] Cargando perfil para auth_id:', authUser.id);
    
    try {
      console.log('🔍 [AUTH] Iniciando query a public.users...');

      // Query directo sin verificación previa de sesión
      const { data: profile, error: profileError } = await supabase
        .schema('public')
        .from('users')
        .select('id, auth_id, email, full_name, role, active, created_at')
        .eq('auth_id', authUser.id)
        .maybeSingle();

      console.log('👤 [AUTH] Resultado perfil:', {
        authId: authUser.id,
        data: profile,
        error: profileError,
        hasProfile: !!profile,
      });

      if (profileError) {
        console.error('❌ [AUTH] Error al cargar perfil:', profileError);
        setError(profileError.message);
        setUser(null);
        return null;
      }

      if (!profile) {
        console.log('⚠️ [AUTH] Perfil no existe, creando uno nuevo...');
        
        const newProfile = {
          auth_id: authUser.id,
          email: authUser.email!,
          full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario',
          role: 'OPERADOR' as const,
          active: true,
        };

        console.log('📝 [AUTH] Intentando crear perfil:', newProfile);

        const { data: createdProfile, error: createError } = await supabase
          .schema('public')
          .from('users')
          .insert(newProfile)
          .select()
          .single();

        console.log('📦 [AUTH] Resultado de creación:', {
          createdProfile,
          error: createError,
        });

        if (createError) {
          console.error('❌ [AUTH] Error al crear perfil:', createError);
          setError(createError.message);
          setUser(null);
          return null;
        }

        console.log('✅ [AUTH] Perfil creado exitosamente:', createdProfile);
        setUser(createdProfile);
        setError(null);
        return createdProfile;
      }

      console.log('✅ [AUTH] Perfil cargado:', profile);
      setUser(profile);
      setError(null);
      return profile;
    } catch (err) {
      console.error('💥 [AUTH] Excepción en loadUserProfile:', err);
      console.error('💥 [AUTH] Stack trace:', err instanceof Error ? err.stack : 'No stack');
      setError(err instanceof Error ? err.message : 'Error cargando perfil');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
      console.log('✅ [AUTH] loadUserProfile finalizó (loading=false)');
    }
  };

  // Inicialización: cargar sesión actual
  useEffect(() => {
    if (initializedRef.current) {
      console.log('⏭️ [AUTH] Ya inicializado, saltando...');
      return;
    }

    initializedRef.current = true;
    console.log('🚀 [AUTH] Inicializando AuthContext...');

    const initAuth = async () => {
      try {
        setLoading(true);
        console.log('📡 [AUTH] Obteniendo sesión actual...');

        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('❌ [AUTH] Error al obtener sesión:', sessionError);
          setError(sessionError.message);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        if (!currentSession) {
          console.log('ℹ️ [AUTH] No hay sesión activa');
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        console.log('✅ [AUTH] Sesión encontrada:', {
          user_id: currentSession.user.id,
          email: currentSession.user.email,
        });

        setSession(currentSession);

        // SIN AWAIT - Dejar que loadUserProfile maneje setLoading(false)
        loadUserProfile(currentSession.user).catch(err => {
          console.error('❌ [AUTH] Error en loadUserProfile (initAuth):', err);
          setLoading(false);
        });

      } catch (err: any) {
        console.error('❌ [AUTH] Error en initAuth:', err);
        setError(err.message || 'Error al inicializar autenticación');
        setLoading(false);
      }
    };

    initAuth();

    // Suscribirse a cambios de autenticación
    console.log('👂 [AUTH] Configurando listener de cambios de auth...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('🔔 [AUTH] Evento de auth:', event, {
        hasSession: !!newSession,
        userId: newSession?.user?.id,
      });

      // Ignorar INITIAL_SESSION para evitar duplicar la carga
      if (event === 'INITIAL_SESSION') {
        console.log('⏭️ [AUTH] Ignorando INITIAL_SESSION (ya manejado en init)');
        return;
      }

      if (event === 'SIGNED_OUT') {
        console.log('👋 [AUTH] Usuario cerró sesión');
        setSession(null);
        setUser(null);
        setError(null);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log(`🔄 [AUTH] ${event} - Actualizando sesión...`);
        
        if (newSession) {
          setSession(newSession);
          setLoading(true);
          console.log('🔍 [AUTH] Llamando a loadUserProfile...');
          
          // SIN AWAIT - Patrón recomendado por Supabase
          loadUserProfile(newSession.user).catch(err => {
            console.error('❌ [AUTH] Error en loadUserProfile (listener):', err);
            setLoading(false);
          });
        }
      }
    });

    return () => {
      console.log('🧹 [AUTH] Limpiando suscripción...');
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('🔐 [AUTH] Intentando iniciar sesión:', email);
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('❌ [AUTH] Error en signIn:', signInError);
        throw signInError;
      }

      if (!data.session) {
        console.error('❌ [AUTH] No se obtuvo sesión después del login');
        throw new Error('No se pudo iniciar sesión');
      }

      console.log('✅ [AUTH] Login exitoso');
      setSession(data.session);

      // SIN AWAIT - El listener manejará la carga del perfil
      console.log('✅ [AUTH] signIn completado, listener manejará el perfil');
    } catch (err: any) {
      console.error('❌ [AUTH] Error en signIn:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  };

  const signOut = async () => {
    console.log('👋 [AUTH] Cerrando sesión...');
    
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error('❌ [AUTH] Error al cerrar sesión:', signOutError);
        throw signOutError;
      }

      setSession(null);
      setUser(null);
      setError(null);
      setLoading(false);
      console.log('✅ [AUTH] Sesión cerrada exitosamente');
    } catch (err: any) {
      console.error('❌ [AUTH] Error en signOut:', err);
      throw err;
    }
  };

  // Log del estado actual cada vez que cambia
  useEffect(() => {
    console.log('📊 [AUTH] Estado actual:', {
      loading,
      hasSession: !!session,
      hasUser: !!user,
      userId: user?.id,
      userRole: user?.role,
      error,
      pathname: window.location.pathname,
    });
  }, [loading, session, user, error]);

  return (
    <AuthContext.Provider value={{ session, user, loading, error, signIn, signOut }}>
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
