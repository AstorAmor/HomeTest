import React, { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePasswordResetPending } from '@/data/passwordReset';
import { MfaScreen } from '@/screens/MfaScreen';
import { NewPasswordScreen } from '@/screens/NewPasswordScreen';

// Delante de toda la app (también de los enlaces directos de la web): con sesión iniciada y el doble
// factor pendiente, solo la pantalla del código o del alta. La base de datos ya no enseña nada sin él;
// esto evita que la app se vea vacía sin explicación.
// Después, si se ha entrado con el código de «¿Has olvidado tu contraseña?», solo «Elige una contraseña
// nueva» (va detrás del doble factor porque Supabase no deja cambiarla sin él).
export const MfaGuard = ({ children }: { children: ReactNode }) => {
  const { isLoggedIn, mfaGate } = useAuth();
  const resetPending = usePasswordResetPending();
  if (isLoggedIn && mfaGate) return <MfaScreen mode={mfaGate} />;
  if (isLoggedIn && resetPending) return <NewPasswordScreen />;
  return <>{children}</>;
};
