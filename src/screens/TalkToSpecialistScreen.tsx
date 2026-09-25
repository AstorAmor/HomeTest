import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';

interface SpecialistOption {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: SpecialistOption[] = [
  {
    id: 'doctor',
    title: 'Doctor',
    subtitle: 'Review your full report and escalated markers',
    icon: 'medkit-outline',
  },
  {
    id: 'dietitian',
    title: 'Dietitian',
    subtitle: 'Turn your diet recommendations into a real plan',
    icon: 'nutrition-outline',
  },
  {
    id: 'trainer',
    title: 'Personal trainer',
    subtitle: 'Build a training plan around your goals',
    icon: 'barbell-outline',
  },
];

export const TalkToSpecialistScreen = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScreenHeader title="Talk to a Specialist" showBack />

      <View style={styles.content}>
        <Text style={styles.intro}>
          Pick who you'd like to talk to. This is a prototype — no request is sent yet.
        </Text>

        <View style={styles.list}>
          {OPTIONS.map((option) => {
            const selected = selectedId === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.card, selected && styles.cardSelected]}
                onPress={() => {
                  setSelectedId(option.id);
                  setRequested(false);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={selected ? Colors.background : Colors.accent}
                  />
                </View>
                <View style={styles.textWrap}>
                  <Text style={styles.cardTitle}>{option.title}</Text>
                  <Text style={styles.cardSubtitle}>{option.subtitle}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {requested ? (
          <View style={styles.confirmation}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
            <Text style={styles.confirmationText}>
              Request noted — a real booking flow isn't wired up in this prototype yet.
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, !selectedId && styles.submitButtonDisabled]}
            disabled={!selectedId}
            onPress={() => setRequested(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>Request appointment</Text>
          </TouchableOpacity>
        )}
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
    fontSize: 13,
    lineHeight: 19,
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
  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accentSoft,
    borderRadius: 14,
    padding: 14,
  },
  confirmationText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
});
