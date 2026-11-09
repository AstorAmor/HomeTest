import React, { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MfaScreen } from '@/screens/MfaScreen';

// Delante de toda la app (también de los enlaces directos de la web): con sesión iniciada y el doble
// factor pendiente, solo la pantalla del código o del alta. La base de datos ya no enseña nada sin él;
// esto evita que la app se vea vacía sin explicación.
export const MfaGuard = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn, mfaGate } = useAuth();
  if (isLoggedIn && mfaGate) return <MfaScreen mode={mfaGate} />;
  return <>{children}</>;
};
