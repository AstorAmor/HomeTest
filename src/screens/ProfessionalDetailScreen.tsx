import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Colors } from '@/constants/colors';
import { mockProfessionals, ROLE_INFO } from '@/data/servicesMock';

// Huecos dummy para la reserva
const SLOTS = ['Today 19:00', 'Tomorrow 08:00', 'Tomorrow 18:30', 'Wed 10:00', 'Thu 17:00', 'Fri 12:00'];

export const ProfessionalDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pro = mockProfessionals.find((p) => p.id === id) ?? mockProfessionals[0];
  const [slot, setSlot] = useState<string | null>(null);
  const [shareResults, setShareResults] = useState(true);
  const [booked, setBooked] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={ROLE_INFO[pro.role].label.replace(/s$/, '')} showBack />

        <View style={styles.hero}>
          <Avatar nombre={pro.name.replace('Dr. ', '')} size={84} />
          <Text style={styles.name}>{pro.name}</Text>
          <Text style={styles.specialty}>{pro.specialty}</Text>
          <View style={styles.statsRow}>
            <Stat icon="star" color={Colors.amber} value={pro.rating.toFixed(1)} label={`${pro.reviews} reviews`} />
            <Stat icon="cash-outline" color={Colors.accent} value={`€${pro.pricePerSession}`} label={`${pro.sessionMinutes} min`} />
            <Stat
              icon={pro.online ? 'videocam-outline' : 'location-outline'}
              color={Colors.violet}
              value={pro.online ? 'Online' : 'In person'}
              label="Madrid"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.bio}>{pro.bio}</Text>
        <Text style={styles.languages}>Speaks {pro.languages.join(' and ')}</Text>

        <Text style={styles.sectionTitle}>Book a session</Text>
        <View style={styles.slots}>
          {SLOTS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.slot, slot === s && styles.slotSelected]}
              onPress={() => {
                setSlot(s);
                setBooked(false);
              }}
            >
              <Text style={[styles.slotText, slot === s && { color: Colors.background }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.shareRow} onPress={() => setShareResults(!shareResults)}>
          <Ionicons
            name={shareResults ? 'checkbox' : 'square-outline'}
            size={22}
            color={shareResults ? Colors.accent : Colors.textMuted}
          />
          <Text style={styles.shareText}>Share my latest results with {pro.name.split(' ').slice(0, 2).join(' ')}</Text>
        </TouchableOpacity>

        {booked && (
          <View style={styles.confirmation}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
            <Text style={styles.confirmationText}>
              Prototype: booking for {slot} noted. No real request is sent yet.
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.cta, !slot && styles.ctaDisabled]}
        disabled={!slot}
        onPress={() => setBooked(true)}
      >
        <Text style={styles.ctaText}>{slot ? `Book ${slot} · €${pro.pricePerSession}` : 'Pick a time'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const Stat = ({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) => (
  <View style={styles.stat}>
    <Ionicons name={icon as any} size={18} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },
  hero: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 12 },
  specialty: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 18,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 8, marginTop: 8 },
  bio: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, paddingHorizontal: 20 },
  languages: { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 20, marginTop: 6, marginBottom: 16 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  slot: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  slotSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  slotText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 18 },
  shareText: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accentSoft,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 16,
  },
  confirmationText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaDisabled: { backgroundColor: Colors.cardBorder },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
