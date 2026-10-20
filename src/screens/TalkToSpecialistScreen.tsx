import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import type { ProfessionalRole } from '@/data/servicesMock';
import { t } from '@/i18n';

// «Habla con un especialista sobre tu plan» (Tu plan y el plan del informe): eliges con quién y te
// lleva a sus especialistas en /professionals, donde se reserva de verdad.

interface SpecialistOption {
  id: ProfessionalRole;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: SpecialistOption[] = [
  { id: 'doctor', title: 'Doctor', subtitle: 'Review your full report and the values to watch', icon: 'medkit-outline' },
  { id: 'dietitian', title: 'Dietitian', subtitle: 'Turn your diet recommendations into a real plan', icon: 'nutrition-outline' },
  { id: 'trainer', title: 'Personal trainer', subtitle: 'Build a training plan around your goals', icon: 'barbell-outline' },
];

export const TalkToSpecialistScreen = () => {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<ProfessionalRole | null>(null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title={t('Talk to a specialist')} showBack />

      <View style={styles.content}>
        <Text style={styles.intro}>{t('Who would you like to talk to about your plan?')}</Text>

        <View style={styles.list}>
          {OPTIONS.map((option) => {
            const selected = selectedId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => setSelectedId(option.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                  <Ionicons name={option.icon} size={24} color={selected ? Colors.background : Colors.accent} />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.cardTitle}>{t(option.title)}</Text>
                  <Text style={styles.cardSubtitle}>{t(option.subtitle)}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, !selectedId && styles.submitButtonDisabled]}
          disabled={!selectedId}
          onPress={() => selectedId && router.push({ pathname: '/professionals', params: { role: selectedId } })}
          activeOpacity={0.85}
        >
          <Text style={styles.submitButtonText}>{t('See specialists')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  intro: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  list: {
    gap: 12,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  cardSelected: {
    borderColor: Colors.accent,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapSelected: {
    backgroundColor: Colors.accent,
  },
  textWrap: {
    flex: 1,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
