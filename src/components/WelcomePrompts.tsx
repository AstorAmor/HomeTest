import React, { useCallback, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { userFlags } from '@/data/userFlags';
import { familyHistoryStore } from '@/data/familyHistoryStore';
import { CYCLE_GOAL_PROMPTED, cycleGoalStore } from '@/data/cycleGoal';
import { profileRepository } from '@/data/profileRepository';
import { useSections } from '@/data/appPrefs';
import { t } from '@/i18n';
import { useTourActive } from '@/components/tour/tourStore';

// Avisos de bienvenida (fundador, 2026-10-17): al entrar en Hoy las primeras veces, una tarjeta
// invita a hacer el perfil genético y, a las mujeres, el cuestionario de la regla. Siempre se puede
// decidir: Empezar · Más tarde (vuelve en 3 días) · Saltar (ese no vuelve) · Silenciar estos
// avisos (no sale ninguno más). Se guarda en user_flags, así que vale en todos los dispositivos.

type PromptId = 'genetics' | 'cycle';

const stateKey = (id: PromptId) => `welcome_prompt:${id}`; // 'started' | 'skipped' | ISO hasta cuándo se pospone
const MUTED = 'welcome_prompts_muted';
const POSTPONE_DAYS = 3;

const PROMPTS: Record<PromptId, { icon: React.ReactNode; title: string; body: string; cta: string; href: string }> = {
  genetics: {
    icon: <MaterialCommunityIcons name="dna" size={30} color={Colors.gold} />,
    title: 'Discover your genetic profile',
    body: 'A few minutes about your family history can show whether some tests or check-ups are worth doing earlier. Only you see your answers.',
    cta: 'Start my genetic profile',
    href: '/know-your-roots',
  },
  cycle: {
    icon: <Ionicons name="flower-outline" size={30} color={Colors.gold} />,
    title: 'Tell us about your period',
    body: 'A few questions about your cycle and what you want (just to track it, to get pregnant or to avoid it), so predictions and tips fit you.',
    cta: 'Answer the questions',
    href: '/cycle-goal',
  },
};

// Si un aviso está pendiente: no hecho, no saltado y sin posponer hasta una fecha futura
const isOpen = (state: unknown) => {
  if (state === 'started' || state === 'skipped') return false;
  if (typeof state === 'string' && state > new Date().toISOString()) return false;
  return true;
};

export const WelcomePrompts = () => {
  // Con el tutorial en marcha (justo después de los cuestionarios), esperan a que acabe
  const touring = useTourActive();
  const router = useRouter();
  const show = useSections();
  const [queue, setQueue] = useState<PromptId[]>([]);
  const cycleOn = show('cycle');

  const load = useCallback(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const flags = await userFlags.getAll();
        if (flags[MUTED] === true) return;
        const next: PromptId[] = [];
        if (isOpen(flags[stateKey('genetics')]) && !(await familyHistoryStore.getRecord())) next.push('genetics');
        if (cycleOn && isOpen(flags[stateKey('cycle')]) && !flags[CYCLE_GOAL_PROMPTED]) {
          const [profile, goal] = await Promise.all([profileRepository.get(), cycleGoalStore.get()]);
          if (profile.sex === 'female' && !goal) next.push('cycle');
        }
        if (!cancelled) setQueue(next);
      } catch {
        // Sin avisos si algo falla: nunca bloquean la app
      }
    }, 900); // deja que Hoy se pinte antes
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cycleOn]);
  useFocusEffect(load);

  const current = queue[0];
  if (!current || touring) return null;
  const p = PROMPTS[current];
  const advance = () => setQueue((q) => q.slice(1));

  const start = () => {
    userFlags.set(stateKey(current), 'started');
    setQueue([]);
    router.push(p.href as any);
  };
  const later = () => {
    userFlags.set(stateKey(current), new Date(Date.now() + POSTPONE_DAYS * 86400000).toISOString());
    advance();
  };
  const skip = () => {
    userFlags.set(stateKey(current), 'skipped');
    advance();
  };
  const mute = () => {
    userFlags.set(MUTED, true);
    setQueue([]);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={later}>
      <Pressable style={styles.backdrop} onPress={later}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.iconWrap}>{p.icon}</View>
          <Text style={styles.title}>{t(p.title)}</Text>
          <Text style={styles.body}>{t(p.body)}</Text>
          <TouchableOpacity style={styles.cta} onPress={start} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{t(p.cta)}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.background} />
          </TouchableOpacity>
          <View style={styles.row}>
            <TouchableOpacity style={styles.secondary} onPress={later} activeOpacity={0.85}>
              <Ionicons name="time-outline" size={16} color={Colors.textPrimary} />
              <Text style={styles.secondaryText}>{t('Later')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={skip} activeOpacity={0.85}>
              <Ionicons name="play-skip-forward-outline" size={16} color={Colors.textPrimary} />
              <Text style={styles.secondaryText}>{t('Skip this one')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={mute} style={styles.muteBtn}>
            <Ionicons name="notifications-off-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.muteText}>{t('Mute these suggestions')}</Text>
          </TouchableOpacity>
          {queue.length > 1 && <Text style={styles.count}>{t('1 of {n}', { n: queue.length })}</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: withAlpha(Colors.gold, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  body: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  cta: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 28,
    paddingVertical: 15,
    marginTop: 20,
  },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 10 },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 24,
    paddingVertical: 12,
  },
  secondaryText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  muteBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 16 },
  muteText: { color: Colors.textMuted, fontSize: 13 },
  count: { color: Colors.textMuted, fontSize: 11, marginTop: 10 },
});
