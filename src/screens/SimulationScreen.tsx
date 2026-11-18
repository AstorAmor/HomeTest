import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chev, SecHead } from '@/components/fine/Fine';
import { FButton, formStyles } from '@/components/fine/FineForm';
import { settingsStyles } from '@/components/settings/SettingsParts';
import { useRouter } from 'expo-router';
import { CLEARED_LOGS, clearTestAccount, loadPersona, localMidnight, Persona, PERSONAS, scenarioTarget } from '@/data/simulation';
import { simulatePersona } from '@/logic/nudges';
import { REAL_ACCOUNT_REFUSAL } from '@/logic/scenarioAccount';
import { NudgeTimeline, STATUS_LABEL } from '@/components/dev/NudgeTimeline';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { useAuth } from '@/context/AuthContext';
import { FINE, ff, fine } from '@/theme/fine';

// Developer mode → Simulated users (demo) y Ajustes → Test scenarios (cuenta de prueba). Los
// usuarios de simulation/personas: qué prueba cada uno, si se cumplen sus comprobaciones y qué
// aviso recibe cada día (y por qué). En la demo, "Open the app as…" carga sus datos en el móvil;
// en una cuenta de prueba, "Load … into this account" los escribe en Supabase (y vaciarla borra
// lo registrado). En una cuenta real no se carga nada.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: herramientas y casos en filas con línea fina (sin tarjetas,
// sin iconos ni avatar de color), el resultado de las comprobaciones en jade u oro (sin rojo) y el botón esmeralda.
export const SimulationScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const start = useMemo(localMidnight, []);
  const target = useMemo(scenarioTarget, []);
  const inAccount = target === 'test_account';
  const who = user?.email || 'this account';
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const results = useMemo(
    () => PERSONAS.map((p) => ({ persona: p, ...simulatePersona(p, start) })),
    [start]
  );

  const open = async (p: Persona) => {
    setError('');
    if (
      inAccount &&
      !(await confirmAsk(
        `Load ${p.name} into ${who}?`,
        `Deletes this account's ${CLEARED_LOGS}, and writes ${p.name}'s instead, up to today. Lab results, files, orders and shares stay.`,
        'Load'
      ))
    )
      return;
    setLoading(p.id);
    try {
      await loadPersona(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this user');
      setLoading(null);
    }
  };

  const clear = async () => {
    setError('');
    if (
      !(await confirmAsk(
        `Clear ${who}?`,
        `Deletes this account's ${CLEARED_LOGS}. Lab results, files, orders, shares and the profile stay.`,
        'Clear'
      ))
    )
      return;
    setLoading('clear');
    try {
      await clearTestAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not clear this account');
      setLoading(null);
    }
  };

  // Una herramienta (vaciar, construir un caso): fila con línea fina; mientras carga algo, no se puede pulsar
  const toolRow = (title: string, sub: string, onPress: () => void, right: React.ReactNode) => (
    <TouchableOpacity style={fine.row} onPress={onPress} disabled={!!loading} activeOpacity={0.7} accessibilityRole="button">
      <View style={styles.flex}>
        <Text style={fine.rowTitle}>{title}</Text>
        <Text style={fine.rowSub}>{sub}</Text>
      </View>
      {right}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={target === 'demo' ? 'Simulated users' : 'Test scenarios'}
          showBack
          backFallback={target === 'demo' ? undefined : '/settings'}
        />
        <View style={settingsStyles.body}>
          <Text style={styles.intro}>
            {inAccount
              ? `Load a case into this test account (${who}) to see its screens and notifications on any device where you sign in with it. Day 0 is today.`
              : 'Test users with different habits and moments, defined in simulation/personas (one JSON each). Day 0 is today. The same checks run with npm run simulate and npm test.'}
          </Text>
          {target === 'real_account' ? <Text style={[formStyles.error, styles.error]}>{REAL_ACCOUNT_REFUSAL}</Text> : null}
          {error ? <Text style={[formStyles.error, styles.error]}>{error}</Text> : null}

          {inAccount &&
            toolRow(
              'Clear this test account',
              "Deletes only this account's logs, so it starts empty.",
              clear,
              loading === 'clear' ? <ActivityIndicator color={FINE.mute} /> : null,
            )}
          {target !== 'real_account' &&
            toolRow('Build a case', 'Pick sex, age, what goes wrong and for how long: see the notifications it gets.', () => router.push('/case-builder'), <Chev />)}

          <SecHead title={`${results.length} cases`} />
          {results.map(({ persona, days, expectations }, idx) => {
            const failed = expectations.filter((e) => !e.pass).length;
            const isOpen = openId === persona.id;
            return (
              <View key={persona.id} style={[styles.persona, idx === results.length - 1 && !isOpen && settingsStyles.noLine]}>
                <TouchableOpacity
                  style={styles.personaHead}
                  onPress={() => setOpenId(isOpen ? null : persona.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <View style={styles.flex}>
                    <Text style={fine.rowTitle}>
                      {persona.name}
                      {persona.profile.age ? `, ${persona.profile.age}` : ''}
                    </Text>
                    <Text style={fine.rowSub} numberOfLines={isOpen ? undefined : 2}>
                      {persona.summary}
                    </Text>
                  </View>
                  {/* Comprobaciones que se cumplen: jade si todas, oro si falla alguna (para mirarla) */}
                  <Text style={[styles.score, { color: failed ? FINE.gold : FINE.jade }]}>
                    {expectations.length - failed}/{expectations.length}
                  </Text>
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.detail}>
                    {persona.tests && <Text style={styles.tests}>Tests: {persona.tests}</Text>}
                    {expectations.map((e, i) => (
                      <View key={i} style={styles.expectRow}>
                        <Ionicons name={e.pass ? 'checkmark' : 'close'} size={14} color={e.pass ? FINE.jade : FINE.gold} />
                        <Text style={styles.expectText}>
                          Day {e.day}: {e.nudge} → {STATUS_LABEL[e.status]}
                          {e.pass ? '' : ` (got ${STATUS_LABEL[e.actual]})`}
                        </Text>
                      </View>
                    ))}

                    <Text style={styles.timelineTitle}>Timeline</Text>
                    <NudgeTimeline days={days} />

                    {target !== 'real_account' && (
                      <>
                        <FButton
                          label={inAccount ? `Load ${persona.name} into this account` : `Open the app as ${persona.name}`}
                          onPress={() => open(persona)}
                          disabled={!!loading}
                          busy={loading === persona.id}
                          style={styles.cta}
                        />
                        <Text style={styles.ctaNote}>
                          {inAccount
                            ? `Replaces this test account's logs with ${persona.name}'s, up to today.`
                            : `Replaces the demo data on this device with ${persona.name}'s, up to today.`}
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  intro: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  error: { marginBottom: 8 },
  // Cada caso: su fila con línea fina; al abrirlo, el detalle debajo, encima de la línea
  persona: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  personaHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, minHeight: 50 },
  score: { ...ff('regular'), fontSize: 13, fontVariant: ['tabular-nums'] },
  detail: { paddingBottom: 14, gap: 6 },
  tests: { ...ff('regular'), color: FINE.ivory, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  expectRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expectText: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 12 },
  timelineTitle: { ...fine.kicker, marginTop: 12, marginBottom: 4 },
  cta: { marginTop: 14 },
  ctaNote: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, textAlign: 'center' },
});
