import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FButton, FOption } from '@/components/fine/FineForm';
import { RoleEmblem } from '@/components/fine/RoleEmblem';
import type { ProfessionalRole } from '@/data/servicesMock';
import { t } from '@/i18n';
import { fine } from '@/theme/fine';

// «Habla con un especialista sobre tu plan» (Tu plan y el plan del informe): eliges con quién y te
// lleva a sus especialistas en /professionals, donde se reserva de verdad.
// En la estética fina (fundador, 2026-11-16: los iconos de los especialistas «se ven muy gordos»): opciones en filas
// con una línea fina, el dibujo a línea de cada rol en un aro fino (components/fine/RoleEmblem.tsx) y el círculo de
// marcar a la derecha, en lugar de tarjetas con un icono sobre un círculo de color.

interface SpecialistOption {
  id: ProfessionalRole;
  title: string;
  subtitle: string;
}

const OPTIONS: SpecialistOption[] = [
  { id: 'doctor', title: 'Doctor', subtitle: 'Review your full report and the values to watch' },
  { id: 'dietitian', title: 'Dietitian', subtitle: 'Turn your diet recommendations into a real plan' },
  { id: 'trainer', title: 'Personal trainer', subtitle: 'Build a training plan around your goals' },
];

export const TalkToSpecialistScreen = () => {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<ProfessionalRole | null>(null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Talk to a specialist')} showBack />

      <View style={styles.content}>
        <Text style={[fine.lead, styles.intro]}>{t('Who would you like to talk to about your plan?')}</Text>

        <View style={styles.list} accessibilityRole="radiogroup">
          {OPTIONS.map((option, i) => (
            <FOption
              key={option.id}
              title={t(option.title)}
              hint={t(option.subtitle)}
              on={selectedId === option.id}
              onPress={() => setSelectedId(option.id)}
              left={<RoleEmblem role={option.id} size={42} />}
              last={i === OPTIONS.length - 1}
            />
          ))}
        </View>

        <FButton
          label={t('See specialists')}
          disabled={!selectedId}
          onPress={() => selectedId && router.push({ pathname: '/professionals', params: { role: selectedId } })}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  intro: { marginTop: 0, marginBottom: 12 },
  list: { marginBottom: 24 },
});
