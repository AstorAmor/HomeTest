import React, { createContext, useState, useContext, ReactNode } from 'react';
import { AuthUser } from '@/types';
import { mockPatient } from '@/data/mockData';

interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, nombre: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = async (email: string, password: string) => {
    // Mock login: aceptar cualquier email/password
    // En Fase 1, esto se conectará a Supabase Auth
    setUser({
      id: mockPatient.id,
      email,
      nombre: mockPatient.nombre,
    });
  };

  const signup = async (email: string, password: string, nombre: string) => {
    // Mock signup
    setUser({
      id: mockPatient.id,
      email,
      nombre,
    });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, signup, logout }}>
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
