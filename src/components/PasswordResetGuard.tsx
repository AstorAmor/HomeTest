import React, { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePasswordResetPending } from '@/data/passwordReset';
import { NewPasswordScreen } from '@/screens/NewPasswordScreen';

// Delante de toda la app (también de los enlaces directos de la web): si se ha entrado con el código de
// «¿Has olvidado tu contraseña?», solo «Elige una contraseña nueva» hasta guardarla.
// (En la rama entorno-pruebas esto lo hace MfaGuard, después del doble factor.)
export const PasswordResetGuard = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn } = useAuth();
  const resetPending = usePasswordResetPending();
  if (isLoggedIn && resetPending) return <NewPasswordScreen />;
  return <>{children}</>;
};
