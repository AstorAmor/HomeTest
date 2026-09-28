import React from 'react';
import { Avatar } from './Avatar';
import { useAuth } from '@/context/AuthContext';
import { mockPatient } from '@/data/mockData';

const demoPhoto = require('../../assets/images/avatar.jpg');

// Avatar del usuario con sesión: iniciales de su nombre real. La foto de ejemplo
// (Juan) solo aparece en modo demo, sin cuenta.
export const UserAvatar = ({ size = 38 }: { size?: number }) => {
  const { user, authMode } = useAuth();
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
