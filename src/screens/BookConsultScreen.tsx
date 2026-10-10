import { dateLocale, t } from '@/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { consult, isRealProfessional } from '@/data/consultations';
import { createShare } from '@/data/sharing';
import { AppointmentKind, AppointmentModality, KIND_LABEL } from '@/data/specialistTypes';

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

// Reservar una videoconsulta (o llamada) en los huecos libres del especialista.
export const BookConsultScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { pro: proId, name: proName } = useLocalSearchParams<{ pro: string; name: string }>();
  const [slots, setSlots] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [kind, setKind] = useState<AppointmentKind>('results_review');
  const [modality, setModality] = useState<AppointmentModality>('video');
  const [reason, setReason] = useState('');
  const [share, setShare] = useState(true);
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    consult.bookableSlots(proId).then(setSlots).catch(() => setSlots([]));
  }, [proId]);

  const byDay = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const s of slots ?? []) (out[new Date(s).toDateString()] ??= []).push(s);
    return out;
  }, [slots]);
  const days = Object.keys(byDay);
  const currentDay = day ?? days[0] ?? null;

  const book = async () => {
    if (!slot) return;
    setState('saving');
    setError('');
    try {
      await consult.requestAppointment({
        proId,
        proName,
        patientName: user?.nombre ?? t('Patient'),
        startsAt: slot,
        kind,
        modality,
        reason: reason.trim() || undefined,
      });
      if (share && isRealProfessional(proId)) {
        await createShare(proId, ['profile', 'lab_reports'], null).catch(() => undefined);
      }
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book');
      setState('error');
    }
  };

  if (state === 'done' && slot) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScreenHeader title={t('Consultation requested')} showBack />
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={60} color={Colors.ok} />
          <Text style={styles.doneTitle}>
            {dayLabel(slot)} at {time(slot)}
          </Text>
          <Text style={styles.muted}>
            {proName} will confirm it shortly. You'll find it in Manage your schedule, and the video link will appear there.
          </Text>
          {!isRealProfessional(proId) && <Text style={styles.proto}>{t("Prototype: this specialist isn't on Kuova yet, nothing was sent.")}</Text>}
          <TouchableOpacity style={styles.cta} onPress={() => router.back()}>
            <Text style={styles.ctaText}>{t('Done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Book a consultation')} showBack />
        <Text style={styles.intro}>with {proName}</Text>

        <Text style={styles.section}>{t('Type')}</Text>
        <View style={styles.chips}>
          {(['results_review', 'first', 'follow_up'] as AppointmentKind[]).map((k) => (
            <Chip key={k} on={kind === k} label={KIND_LABEL[k]} onPress={() => setKind(k)} />
          ))}
        </View>
        <View style={[styles.chips, { marginTop: 8 }]}>
          <Chip on={modality === 'video'} label={t('Video')} icon="videocam-outline" onPress={() => setModality('video')} />
          <Chip on={modality === 'voice'} label={t('Phone call')} icon="call-outline" onPress={() => setModality('voice')} />
        </View>

        <Text style={styles.section}>{t('Choose a time')}</Text>
        {slots === null ? (
          <ActivityIndicator color={Colors.accent} />
        ) : days.length === 0 ? (
          <Text style={styles.muted}>{t('No free slots in the next days. Send a request instead.')}</Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
              {days.map((d) => (
                <Chip key={d} on={d === currentDay} label={dayLabel(byDay[d][0])} onPress={() => { setDay(d); setSlot(null); }} />
              ))}
            </ScrollView>
            <View style={styles.slots}>
              {(currentDay ? byDay[currentDay] : []).map((s) => (
                <TouchableOpacity key={s} style={[styles.slot, slot === s && styles.slotOn]} onPress={() => setSlot(s)}>
                  <Text style={[styles.slotText, slot === s && { color: Colors.background }]}>{time(s)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.section}>{t('What would you like to talk about? (optional)')}</Text>
        <TextInput style={styles.input} multiline value={reason} onChangeText={setReason} placeholder={t('e.g. My ferritin and how to improve it')} placeholderTextColor={Colors.textMuted} />

        <TouchableOpacity style={styles.shareRow} onPress={() => setShare((v) => !v)}>
          <Ionicons name={share ? 'checkbox' : 'square-outline'} size={22} color={share ? Colors.accent : Colors.textMuted} />
          <Text style={styles.shareText}>Share my profile and lab results with {proName} (you can revoke it anytime)</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <TouchableOpacity style={[styles.cta, !slot && { opacity: 0.5 }]} disabled={!slot || state === 'saving'} onPress={book}>
        {state === 'saving' ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.ctaText}>{slot ? `Request ${dayLabel(slot)}, ${time(slot)}` : 'Choose a time'}</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const Chip = ({ on, label, icon, onPress }: { on: boolean; label: string; icon?: string; onPress: () => void }) => (
  <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
    {icon && <Ionicons name={icon as any} size={15} color={on ? Colors.background : Colors.textSecondary} />}
    <Text style={[styles.chipText, on && { color: Colors.background }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24, paddingHorizontal: 20 },
  intro: { color: Colors.textSecondary, fontSize: 14, marginTop: -6 },
  section: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  days: { gap: 8, paddingBottom: 10 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '22.5%', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, paddingVertical: 9 },
  slotOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  slotText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  muted: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  input: { minHeight: 70, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 14, textAlignVertical: 'top' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  shareText: { color: Colors.textPrimary, fontSize: 13, flex: 1 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 10 },
  cta: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 20 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  done: { alignItems: 'center', gap: 12, paddingHorizontal: 28, marginTop: 40 },
  doneTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  proto: { color: Colors.warning, fontSize: 12, textAlign: 'center' },
});
