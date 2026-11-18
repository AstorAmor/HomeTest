import { dateLocale, t } from '@/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { consult, isRealProfessional } from '@/data/consultations';
import { createShare } from '@/data/sharing';
import { Appointment, AppointmentKind, AppointmentModality, KIND_LABEL, recentAppointmentWith } from '@/data/specialistTypes';
import { FMark, ON_BG } from '@/components/fine/FineForm';
import { FINE, ff } from '@/theme/fine';

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
const when = (iso: string) => `${dayLabel(iso)}, ${time(iso)}`;

// Reservar una videoconsulta (o llamada) en los huecos libres del especialista.
// En la estética fina (2026-11-16, con el resto de especialistas): chips y huecos con borde fino (jade el elegido),
// cabeceras pequeñas en mayúsculas, la casilla de compartir como el círculo de marcar y el botón en esmeralda.
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
  // Memoria: si ya pidió una consulta con este especialista esta semana, se pregunta antes de duplicarla
  const [existing, setExisting] = useState<Appointment | null>(null);
  const [asking, setAsking] = useState(false);
  const [replaced, setReplaced] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    consult.bookableSlots(proId).then(setSlots).catch(() => setSlots([]));
    consult
      .myAppointments()
      .then((all) => setExisting(recentAppointmentWith(all, proId)))
      .catch(() => undefined);
  }, [proId]);

  const byDay = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const s of slots ?? []) (out[new Date(s).toDateString()] ??= []).push(s);
    return out;
  }, [slots]);
  const days = Object.keys(byDay);
  const currentDay = day ?? days[0] ?? null;

  // replace: la consulta anterior que se cambia por esta (se cancela solo si la nueva sale bien)
  const book = async (replace?: Appointment) => {
    if (!slot) return;
    setAsking(false);
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
      if (replace) {
        await consult.cancelAppointment(replace.id);
        setReplaced(replace.startsAt);
      }
      if (share && isRealProfessional(proId)) {
        await createShare(proId, ['profile', 'lab_reports'], null).catch(() => undefined);
      }
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not book'));
      setState('error');
    }
  };

  const cancelExisting = async () => {
    if (!existing) return;
    setAsking(false);
    try {
      await consult.cancelAppointment(existing.id);
      setNote(t('Your consultation on {when} has been cancelled.', { when: when(existing.startsAt) }));
      // Puede quedar otra pedida esa semana: se vuelve a mirar
      setExisting(recentAppointmentWith(await consult.myAppointments(), proId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not cancel'));
    }
  };

  if (state === 'done' && slot) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScreenHeader title={t('Consultation requested')} showBack />
        <View style={styles.done}>
          <Ionicons name="checkmark-circle-outline" size={56} color={FINE.jade} />
          <Text style={styles.doneTitle}>
            {t('{day} at {time}', { day: dayLabel(slot), time: time(slot) })}
          </Text>
          <Text style={styles.muted}>
            {t("{name} will confirm it shortly. You'll find it in Manage your schedule, and the video link will appear there.", { name: proName })}
          </Text>
          {replaced && <Text style={styles.muted}>{t('We have cancelled the one you had on {when}.', { when: when(replaced) })}</Text>}
          {!isRealProfessional(proId) && <Text style={styles.proto}>{t("Prototype: this specialist isn't on Kuova yet, nothing was sent.")}</Text>}
          <TouchableOpacity style={styles.cta} onPress={() => router.back()} accessibilityRole="button">
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
        <Text style={styles.intro}>{t('with {name}', { name: proName })}</Text>

        {existing && (
          <View style={styles.existing}>
            <Ionicons name="calendar-outline" size={18} color={FINE.jade} />
            <View style={{ flex: 1 }}>
              <Text style={styles.existingTitle}>{t('You already requested one for {when}', { when: when(existing.startsAt) })}</Text>
              <Text style={styles.existingSub}>{t(existing.status === 'confirmed' ? 'Confirmed' : 'Waiting for confirmation')}</Text>
            </View>
          </View>
        )}
        {note ? <Text style={styles.note}>{note}</Text> : null}

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
          <ActivityIndicator color={FINE.jade} />
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
                <TouchableOpacity
                  key={s}
                  style={[styles.slot, slot === s && styles.slotOn]}
                  onPress={() => setSlot(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: slot === s }}
                >
                  <Text style={styles.slotText}>{time(s)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.section}>{t('What would you like to talk about? (optional)')}</Text>
        <TextInput style={styles.input} multiline value={reason} onChangeText={setReason} placeholder={t('e.g. My ferritin and how to improve it')} placeholderTextColor={FINE.mute} />

        <TouchableOpacity style={styles.shareRow} onPress={() => setShare((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: share }}>
          <FMark on={share} />
          <Text style={styles.shareText}>{t('Share my profile and lab results with {name} (you can revoke it anytime)', { name: proName })}</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <TouchableOpacity
        style={[styles.cta, !slot && { opacity: 0.5 }]}
        disabled={!slot || state === 'saving'}
        onPress={() => (existing ? setAsking(true) : book())}
      >
        {state === 'saving' ? <ActivityIndicator color={FINE.ivory} /> : <Text style={styles.ctaText}>{slot ? t('Request {when}', { when: when(slot) }) : t('Choose a time')}</Text>}
      </TouchableOpacity>

      {/* Ya hay una pedida esta semana: cambiarla por la nueva; si está confirmada, también cancelarla */}
      <Modal visible={asking && !!existing && !!slot} transparent animationType="fade" onRequestClose={() => setAsking(false)}>
        <View style={styles.backdrop}>
          {existing && slot && (
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                {existing.status === 'confirmed' ? t('You already have a consultation with {name}', { name: proName }) : t('You have already requested this')}
              </Text>
              <Text style={styles.sheetBody}>
                {t(
                  existing.status === 'confirmed'
                    ? '{name} confirmed it for {when}. Do you want to change it to {next}?'
                    : '{name} has not answered your request for {when} yet. Do you want to change it to {next}?',
                  { name: proName, when: when(existing.startsAt), next: when(slot) },
                )}
              </Text>
              <TouchableOpacity style={styles.sheetPrimary} onPress={() => book(existing)}>
                <Text style={styles.ctaText}>{t('Yes, change it')}</Text>
              </TouchableOpacity>
              {existing.status === 'confirmed' && (
                <TouchableOpacity style={styles.sheetSecondary} onPress={cancelExisting}>
                  <Text style={styles.sheetDanger}>{t('Cancel the one I have')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.sheetSecondary} onPress={() => setAsking(false)}>
                <Text style={styles.sheetKeep}>{t('No, keep it')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const Chip = ({ on, label, icon, onPress }: { on: boolean; label: string; icon?: string; onPress: () => void }) => (
  <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }}>
    {icon && <Ionicons name={icon as any} size={15} color={on ? FINE.jade : FINE.mute} />}
    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 24, paddingHorizontal: 20 },
  intro: { ...ff('regular'), color: FINE.mute, fontSize: 14, marginTop: -6 },
  // Cabeceras de sección pequeñas y en mayúsculas (como fine.secTitle)
  section: { ...ff('semibold'), color: FINE.mute, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Chips con borde fino; el elegido, borde jade y letra marfil (como FChip)
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, borderWidth: 1, borderColor: FINE.line, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  chipText: { ...ff('regular'), color: FINE.mute, fontSize: 13.5 },
  chipTextOn: { color: FINE.ivory },
  days: { gap: 8, paddingBottom: 10 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '22.5%', alignItems: 'center', borderWidth: 1, borderColor: FINE.line, borderRadius: 12, paddingVertical: 9 },
  slotOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  slotText: { ...ff('regular'), color: FINE.ivory, fontSize: 14, fontVariant: ['tabular-nums'] },
  muted: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  input: { ...ff('regular'), minHeight: 70, borderWidth: 1, borderColor: FINE.line, backgroundColor: FINE.tile, borderRadius: 14, padding: 12, color: FINE.ivory, fontSize: 14, textAlignVertical: 'top' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  shareText: { ...ff('regular'), color: FINE.ivory, fontSize: 13, lineHeight: 18, flex: 1 },
  // Lo que no ha salido: un coral suave, sin rojo de alarma (como formStyles.error)
  error: { ...ff('regular'), color: '#E9A48F', fontSize: 13, marginTop: 10 },
  // Botón principal: esmeralda con la letra marfil (como FButton)
  cta: { backgroundColor: FINE.emerald, borderRadius: 22, paddingVertical: 13, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 20 },
  ctaText: { ...ff('medium'), color: '#F0EFE6', fontSize: 15 },
  done: { alignItems: 'center', gap: 12, paddingHorizontal: 28, marginTop: 40 },
  doneTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 22 },
  proto: { ...ff('regular'), color: FINE.gold, fontSize: 12, textAlign: 'center' },
  existing: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: FINE.tile, borderWidth: 1, borderColor: FINE.line, borderRadius: 14, padding: 12 },
  existingTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 14 },
  existingSub: { ...ff('regular'), color: FINE.mute, fontSize: 12, marginTop: 2 },
  note: { ...ff('regular'), color: FINE.jade, fontSize: 13, marginTop: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: FINE.deep, borderWidth: 1, borderColor: FINE.line, borderRadius: 20, padding: 20, gap: 4 },
  sheetTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 18 },
  sheetBody: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 14 },
  sheetPrimary: { backgroundColor: FINE.emerald, borderRadius: 22, paddingVertical: 13, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  sheetSecondary: { alignItems: 'center', paddingVertical: 12 },
  sheetDanger: { ...ff('regular'), color: '#E9A48F', fontSize: 14 },
  sheetKeep: { ...ff('regular'), color: FINE.mute, fontSize: 14 },
});
