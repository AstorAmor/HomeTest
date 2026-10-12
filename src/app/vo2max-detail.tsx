import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { Vo2maxInfo } from '@/screens/Vo2maxInfo';
import { vo2maxRepository } from '@/data/vo2maxRepository';
import { profileRepository } from '@/data/profileRepository';
import { VO2_BAND_LABEL, vo2Band } from '@/logic/vo2max';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';

const ageOf = (dob?: string) => {
  if (!dob) return null;
  const d = new Date(dob);
  return Number.isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
};

// VO2max: se mide en una prueba con un especialista y aquí se apunta; la ficha dice cómo queda
// frente a la gente de tu edad y sexo (registro FRIEND).
export default function Vo2maxDetail() {
  const router = useRouter();
  const [who, setWho] = useState<{ age: number | null; sex: 'male' | 'female' | null }>({ age: null, sex: null });
  useEffect(() => {
    profileRepository
      .get()
      .then((p) => setWho({ age: ageOf(p.dateOfBirth), sex: p.sex === 'female' ? 'female' : p.sex === 'male' ? 'male' : null }))
      .catch(() => undefined);
  }, []);

  return (
    <SimpleMetricDetailScreen
      title={t('VO2max')}
      color={Colors.sky}
      icon="mci:lungs"
      loadEntries={() => vo2maxRepository.getAll()}
      onAddPress={() => router.push('/log-vo2max')}
      onEditPress={(id) => router.push({ pathname: '/log-vo2max', params: { id } })}
      describe={(v) => (who.age != null && who.sex ? t(VO2_BAND_LABEL[vo2Band(v, who.age, who.sex)]) : null)}
      extra={<Vo2maxInfo />}
    />
  );
}
