import React, { createContext, useState, useContext, useEffect, useRef, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthUser } from '@/types';
import { mockPatient } from '@/data/mockData';
import { isSupabaseConfigured, setCurrentUserId, supabase } from '@/lib/supabase';
import {
  amIAdmin,
  getMyProfessionalAccount,
  ProfessionalAccount,
  ProfessionalRole,
  registerAsProfessional,
} from '@/data/sharing';

export interface ProfessionalSignup {
  role: ProfessionalRole;
  specialty?: string;
  licenseNumber?: string;
}

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
  // Ficha profesional si la cuenta es de un profesional (null = paciente)
  professional: ProfessionalAccount | null;
  refreshProfessional: () => Promise<void>;
  // Administrador de HomeTest (verifica profesionales y aprueba tarifas)
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, nombre: string, professional?: ProfessionalSignup) => Promise<void>;
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
  const [professional, setProfessional] = useState<ProfessionalAccount | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  // Durante el alta de un profesional, la ficha aún no existe: no consultarla en paralelo
  const creatingProfessional = useRef(false);

  const refreshProfessional = async () => {
    try {
      setProfessional(await getMyProfessionalAccount());
    } catch {
      setProfessional(null);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    const apply = async (session: Session | null) => {
      // El id se fija antes que el estado para que los repositorios ya lean de la nube
      setCurrentUserId(session?.user.id ?? null);
      if (!session) {
        setProfessional(null);
        setIsAdmin(false);
      } else {
        if (!creatingProfessional.current) await refreshProfessional();
        setIsAdmin(await amIAdmin());
      }
      setUser(userFromSession(session));
    };
    supabase.auth.getSession().then(async ({ data }) => {
      await apply(data.session);
      setInitializing(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Fuera del callback: supabase-js no admite otras llamadas suyas dentro de él
      setTimeout(() => apply(session), 0);
    });
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

  const signup = async (
    email: string,
    password: string,
    nombre: string,
    professionalSignup?: ProfessionalSignup
  ) => {
    if (supabase) {
      creatingProfessional.current = !!professionalSignup;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: nombre.trim() } },
        });
        if (error) throw new Error(error.message);
        if (!data.session) {
          throw new Error('Account created. Check your email to confirm it, then sign in.');
        }
        if (professionalSignup) {
          setCurrentUserId(data.session.user.id);
          await registerAsProfessional({ displayName: nombre.trim(), ...professionalSignup });
          await refreshProfessional();
        }
      } finally {
        creatingProfessional.current = false;
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
        professional,
        refreshProfessional,
        isAdmin,
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
