import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { useRouter } from 'expo-router';
import { loadPersona, localMidnight, Persona, PERSONAS } from '@/data/simulation';
import { simulatePersona } from '@/logic/nudges';
import { NudgeTimeline, STATUS_LABEL } from '@/components/dev/NudgeTimeline';

// Developer mode → Simulated users. Los usuarios de simulation/personas: qué prueba cada uno,
// si se cumplen sus comprobaciones y qué aviso recibe cada día (y por qué). "Open the app as…"
// carga sus datos en el modo demo para ver la app tal como la vería.
export const SimulationScreen = () => {
  const router = useRouter();
  const start = useMemo(localMidnight, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const results = useMemo(
    () => PERSONAS.map((p) => ({ persona: p, ...simulatePersona(p, start) })),
    [start]
  );

  const open = async (p: Persona) => {
    setError('');
    setLoading(p.id);
    try {
      await loadPersona(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this user');
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Simulated users" showBack />
        <Text style={styles.intro}>
          Test users with different habits and moments, defined in simulation/personas (one JSON each). Day 0 is
          today. The same checks run with npm run simulate and npm test.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={[styles.card, styles.builder]} onPress={() => router.push('/case-builder')} activeOpacity={0.85}>
          <Ionicons name="construct-outline" size={22} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>Build a case</Text>
            <Text style={styles.summary}>Pick sex, age, what goes wrong and for how long: see the notifications it gets.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {results.map(({ persona, days, expectations }) => {
          const failed = expectations.filter((e) => !e.pass).length;
          const isOpen = openId === persona.id;
          return (
            <View key={persona.id} style={styles.card}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => setOpenId(isOpen ? null : persona.id)} activeOpacity={0.85}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{persona.name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {persona.name}
                    {persona.profile.age ? `, ${persona.profile.age}` : ''}
                  </Text>
                  <Text style={styles.summary} numberOfLines={isOpen ? undefined : 2}>
                    {persona.summary}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: withAlpha(failed ? Colors.danger : Colors.ok, 0.14) }]}>
                  <Text style={[styles.badgeText, { color: failed ? Colors.danger : Colors.ok }]}>
                    {expectations.length - failed}/{expectations.length}
                  </Text>
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.detail}>
                  {persona.tests && <Text style={styles.tests}>Tests: {persona.tests}</Text>}
                  {expectations.map((e, i) => (
                    <View key={i} style={styles.expectRow}>
                      <Ionicons
                        name={e.pass ? 'checkmark-circle' : 'close-circle'}
                        size={16}
                        color={e.pass ? Colors.ok : Colors.danger}
                      />
                      <Text style={styles.expectText}>
                        Day {e.day}: {e.nudge} → {STATUS_LABEL[e.status]}
                        {e.pass ? '' : ` (got ${STATUS_LABEL[e.actual]})`}
                      </Text>
                    </View>
                  ))}

                  <Text style={styles.timelineTitle}>Timeline</Text>
                  <NudgeTimeline days={days} />

                  <TouchableOpacity style={styles.cta} onPress={() => open(persona)} disabled={!!loading}>
                    {loading === persona.id ? (
                      <ActivityIndicator color={Colors.background} />
                    ) : (
                      <Text style={styles.ctaText}>Open the app as {persona.name}</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.ctaNote}>Replaces the demo data on this device with {persona.name}'s, up to today.</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, paddingHorizontal: 20, marginBottom: 14 },
  error: { color: Colors.danger, fontSize: 13, paddingHorizontal: 20, marginBottom: 10 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  builder: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderColor: Colors.accent },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.accent, fontSize: 17, fontWeight: '800' },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  summary: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  detail: { borderTopWidth: 1, borderTopColor: Colors.divider, padding: 14, gap: 6 },
  tests: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  expectRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expectText: { flex: 1, color: Colors.textSecondary, fontSize: 12 },
  timelineTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 26,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
  ctaNote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center' },
});
