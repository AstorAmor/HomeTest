import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { GripStrengthInfo } from '@/screens/GripStrengthInfo';
import { gripStrengthRepository } from '@/data/gripStrengthRepository';
import { ageFromDob, profileRepository, type UserProfile } from '@/data/profileRepository';
import { GRIP_BAND_LABEL, gripBand } from '@/logic/gripStrength';
import { FINE } from '@/theme/fine';
import { t } from '@/i18n';

// Fuerza de agarre (como el VO2max): se mide con un dinamómetro de mano y aquí se apunta el mejor intento; la ficha
// dice cómo queda frente a la gente de su edad y sexo (Dodds 2014, src/logic/gripStrength.ts). La curva en jade,
// como las demás fichas en fino.
type Who = { age: number | null; sex: 'male' | 'female' | null };
const whoOf = (p: UserProfile): Who => ({ age: ageFromDob(p.dateOfBirth), sex: p.sex === 'female' ? 'female' : p.sex === 'male' ? 'male' : null });

export default function GripStrengthDetail() {
  const router = useRouter();
  // Con el perfil leído la última vez, la banda sale al momento (fundador, 2026-11-17: «las medidas tardan en cargar»)
  const [who, setWho] = useState<Who>(() => {
    const p = profileRepository.peek();
    return p ? whoOf(p) : { age: null, sex: null };
  });
  useEffect(() => {
    profileRepository
      .get()
      .then((p) => setWho(whoOf(p)))
      .catch(() => undefined);
  }, []);

  return (
    <SimpleMetricDetailScreen
      title={t('Grip strength')}
      color={FINE.jade}
      icon="hand-left-outline"
      loadEntries={() => gripStrengthRepository.getAll()}
      peekEntries={() => gripStrengthRepository.peek()}
      onAddPress={() => router.push('/log-grip-strength' as any)}
      onEditPress={(id) => router.push({ pathname: '/log-grip-strength' as any, params: { id } })}
      describe={(v) => (who.age != null && Number.isFinite(who.age) && who.sex ? t(GRIP_BAND_LABEL[gripBand(v, who.age, who.sex)]) : null)}
      extra={<GripStrengthInfo />}
    />
  );
}
