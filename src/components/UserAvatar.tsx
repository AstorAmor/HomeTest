import React from 'react';
import { Avatar } from './Avatar';
import { useAuth } from '@/context/AuthContext';
import { mockPatient } from '@/data/mockData';
import { useAvatar } from '@/data/avatar';

const demoPhoto = require('../../assets/images/avatar.jpg');

// Avatar del usuario con sesión: su foto (Mi perfil → tocar la foto) o, si no tiene, la inicial
// de su alias. La foto de ejemplo (Juan) solo aparece en modo demo, sin cuenta y sin foto propia.
export const UserAvatar = ({ size = 38 }: { size?: number }) => {
  const { user, authMode } = useAuth();
  const photo = useAvatar();
  if (photo) return <Avatar nombre={user?.nombre || '?'} source={{ uri: photo }} size={size} />;
  if (authMode === 'demo') {
    return <Avatar nombre={user?.nombre ?? mockPatient.nombre} source={demoPhoto} size={size} />;
  }
  return <Avatar nombre={user?.nombre || user?.email || '?'} size={size} />;
};

// Nombre de pila para saludos ("Hi Laura!")
export const useFirstName = () => {
  const { user } = useAuth();
  return (user?.nombre || mockPatient.nombre).trim().split(/\s+/)[0];
};
