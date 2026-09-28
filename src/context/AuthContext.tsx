import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthUser } from '@/types';
import { mockPatient } from '@/data/mockData';
import { isSupabaseConfigured, setCurrentUserId, supabase } from '@/lib/supabase';

// Modo de demo que se elige tras el login (selector "developer"):
// - new: usuario nuevo -> cuestionario de onboarding
// - results: usuario que acaba de recibir resultados -> celebración + informe
// - returning: usuario habitual -> directo a Today
export type DemoMode = 'new' | 'results' | 'returning';

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  // true mientras se recupera la sesión guardada al abrir la app
  initializing: boolean;
  // 'supabase': cuentas reales y datos en la nube; 'demo': login simulado y datos en el móvil
  authMode: 'supabase' | 'demo';
  demoMode: DemoMode | null;
  setDemoMode: (mode: DemoMode) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, nombre: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const userFromSession = (session: Session | null): AuthUser | null => {
  if (!session) return null;
  const u = session.user;
  return {
    id: u.id,
    email: u.email ?? '',
    nombre: (u.user_metadata?.display_name as string | undefined) ?? u.email?.split('@')[0] ?? '',
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [demoMode, setDemoMode] = useState<DemoMode | null>(null);
  const [initializing, setInitializing] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    const apply = (session: Session | null) => {
      // El id se fija antes que el estado para que los repositorios ya lean de la nube
      setCurrentUserId(session?.user.id ?? null);
      setUser(userFromSession(session));
    };
    supabase.auth.getSession().then(({ data }) => {
      apply(data.session);
      setInitializing(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw new Error(error.message);
      return;
    }
    // Modo demo: aceptar cualquier email/password
    setUser({ id: mockPatient.id, email, nombre: mockPatient.nombre });
  };

  const signup = async (email: string, password: string, nombre: string) => {
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: nombre.trim() } },
      });
      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error('Account created. Check your email to confirm it, then sign in.');
      }
      return;
    }
    setUser({ id: mockPatient.id, email, nombre });
  };

  const logout = () => {
    setDemoMode(null);
    if (supabase) {
      supabase.auth.signOut();
      return;
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        initializing,
        authMode: isSupabaseConfigured ? 'supabase' : 'demo',
        demoMode,
        setDemoMode,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
