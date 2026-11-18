import { dateLocale, t as tr } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { AppIcon } from '@/components/HealthIcons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { consult, isRealProfessional } from '@/data/consultations';
import { ConsultRequest, REQUEST_KIND_LABEL, RequestKind } from '@/data/specialistTypes';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { StoredAudio, VoiceRecorder } from '@/components/VoiceNote';
import { createShare, DataShare, isShareActive, listMyShares, scopeLabel, SHARE_SCOPES, ShareScope } from '@/data/sharing';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { KeyboardFooter } from '@/components/KeyboardFooter';
import { FOption, ON_BG } from '@/components/fine/FineForm';
import { FINE, ff } from '@/theme/fine';

const KINDS: { id: RequestKind; icon: string; hint: string }[] = [
  { id: 'question', icon: 'help-circle-outline', hint: 'A quick question about your health or plan' },
  { id: 'results_review', icon: 'flask-outline', hint: 'Ask them to look at your latest results' },
  { id: 'async_video', icon: 'film-outline', hint: 'Get a short video explaining your results' },
];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

// "Send request": pregunta o petición que el especialista contesta cuando puede
// (sin cita). Debajo, las solicitudes anteriores con este especialista y su respuesta.
// En la estética fina (2026-11-16, con el resto de especialistas): el tipo en filas con una línea fina y el círculo
// de marcar, chips con borde fino (jade lo elegido), cabeceras pequeñas en mayúsculas y el botón en esmeralda.
export const ConsultRequestScreen = () => {
  const { user } = useAuth();
  const { pro: proId, name: proName } = useLocalSearchParams<{ pro: string; name: string }>();
  const [kind, setKind] = useState<RequestKind>('question');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [history, setHistory] = useDeepState<ConsultRequest[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  // Compartir datos con este especialista (misma función que Sharing & privacy)
  const real = isRealProfessional(proId);
  const [share, setShare] = useDeepState<DataShare | null>(null);
  const [scopes, setScopes] = useState<ShareScope[]>(['profile', 'lab_reports']);
  const [shareState, setShareState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [localShared, setLocalShared] = useState(false);

  const load = useCallback(async () => {
    const all = await consult.myRequests().catch(() => []);
    setHistory(all.filter((r) => r.professionalId === proId));
    if (real) {
      const shares = await listMyShares().catch(() => []);
      setShare(shares.find((s) => s.professionalId === proId && isShareActive(s)) ?? null);
    }
  }, [proId, real, setHistory, setShare]);
  useReloadOnFocus(load);

  const doShare = async () => {
    if (!real) {
      setLocalShared(true);
      return;
    }
    setShareState('saving');
    try {
      await createShare(proId, scopes, null);
      setShareState('idle');
      load();
    } catch {
      setShareState('error');
    }
  };

  const send = async () => {
    setState('sending');
    setError('');
    try {
      await consult.sendRequest({ proId, proName, patientName: user?.nombre ?? tr('Patient'), kind, message: message.trim(), audioUri });
      setMessage('');
      setAudioUri(null);
      setRecorderKey((k) => k + 1);
      setState('sent');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not send'));
      setState('error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={tr('Send a request')} showBack />
        <Text style={styles.intro}>{tr("to {name}. They'll answer in the app, usually within 48 h.", { name: proName })}</Text>

        <View accessibilityRole="radiogroup">
          {KINDS.map((k, i) => (
            <FOption
              key={k.id}
              title={REQUEST_KIND_LABEL[k.id]}
              hint={tr(k.hint)}
              on={kind === k.id}
              onPress={() => setKind(k.id)}
              left={<Ionicons name={k.icon as any} size={20} color={kind === k.id ? FINE.jade : FINE.mute} />}
              last={i === KINDS.length - 1}
            />
          ))}
        </View>

        <TextInput
          style={styles.input}
          multiline
          value={message}
          onChangeText={(t) => {
            setMessage(t);
            if (state === 'sent') setState('idle');
          }}
          placeholder={tr('Write your message')}
          placeholderTextColor={FINE.mute}
        />
        <View style={{ marginTop: 10 }}>
          <VoiceRecorder key={recorderKey} onChange={setAudioUri} />
        </View>

        <Text style={styles.section}>{tr('Share your data with {name}', { name: proName })}</Text>
        {share ? (
          <View style={styles.shared}>
            <Ionicons name="shield-checkmark-outline" size={18} color={FINE.jade} />
            <Text style={styles.sharedText}>
              {tr('You share: {what}. Change it in You → Sharing & privacy.', { what: share.scopes.map(scopeLabel).join(', ') })}
            </Text>
          </View>
        ) : localShared ? (
          <Text style={styles.sent}>{tr('Shared ✓ (prototype: this specialist isn’t on Kuova yet)')}</Text>
        ) : (
          <>
            <Text style={styles.shareHint}>{tr('So they can answer with your real results. You can revoke it anytime.')}</Text>
            <View style={styles.scopes}>
              {SHARE_SCOPES.map((s) => {
                const on = scopes.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.scope, on && styles.scopeOn]}
                    onPress={() => setScopes((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    {/* AppIcon: las pesas («Actividad y entrenos») salen con el dibujo único de la app (fine/dumbbell.ts) */}
                    <AppIcon name={s.icon} size={14} color={on ? FINE.jade : FINE.mute} />
                    <Text style={[styles.scopeText, on && styles.scopeTextOn]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.shareBtn, scopes.length === 0 && { opacity: 0.5 }]} disabled={scopes.length === 0 || shareState === 'saving'} onPress={doShare}>
              <Ionicons name="share-social-outline" size={16} color={FINE.jade} />
              <Text style={styles.shareBtnText}>{shareState === 'saving' ? tr('Sharing…') : tr('Share with {name}', { name: proName })}</Text>
            </TouchableOpacity>
            {shareState === 'error' ? <Text style={styles.error}>{tr('Could not share. Try again.')}</Text> : null}
          </>
        )}
        {state === 'sent' && (
          <Text style={styles.sent}>
            {real ? tr('Sent ✓') : tr('Sent ✓ (prototype: this specialist isn’t on Kuova yet)')}
          </Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {history.length > 0 && (
          <>
            <Text style={styles.section}>{tr('Your requests')}</Text>
            {history.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.meta}>
                  {REQUEST_KIND_LABEL[r.kind]} · {shortDate(r.createdAt)} · {r.status === 'open' ? tr('Waiting for an answer') : tr('Answered')}
                </Text>
                {r.message ? <Text style={styles.msg}>{r.message}</Text> : null}
                {r.audioPath ? <StoredAudio path={r.audioPath} /> : null}
                {r.response && (
                  <View style={styles.answer}>
                    <Text style={styles.answerText}>{r.response}</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </KeyboardAwareScrollView>
      <KeyboardFooter>
        <TouchableOpacity style={[styles.cta, !message.trim() && !audioUri && { opacity: 0.5 }]} disabled={(!message.trim() && !audioUri) || state === 'sending'} onPress={send}>
          {state === 'sending' ? <ActivityIndicator color={FINE.ivory} /> : <Text style={styles.ctaText}>{tr('Send request')}</Text>}
        </TouchableOpacity>
      </KeyboardFooter>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  intro: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: -6, marginBottom: 8 },
  input: { ...ff('regular'), minHeight: 110, borderWidth: 1, borderColor: FINE.line, backgroundColor: FINE.tile, borderRadius: 14, padding: 12, color: FINE.ivory, fontSize: 14, textAlignVertical: 'top', marginTop: 16 },
  sent: { ...ff('regular'), color: FINE.jade, fontSize: 13, marginTop: 8 },
  // Lo que no ha salido: un coral suave, sin rojo de alarma (como formStyles.error)
  error: { ...ff('regular'), color: '#E9A48F', fontSize: 13, marginTop: 8 },
  // Cabeceras de sección pequeñas y en mayúsculas (como fine.secTitle)
  section: { ...ff('semibold'), color: FINE.mute, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 26, marginBottom: 10 },
  card: { backgroundColor: FINE.tile, borderWidth: 1, borderColor: FINE.line, borderRadius: 14, padding: 12, marginBottom: 8, gap: 6 },
  meta: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  msg: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 20 },
  answer: { borderLeftWidth: 1, borderLeftColor: FINE.jade, paddingLeft: 10 },
  answerText: { ...ff('regular'), color: FINE.ivory, fontSize: 13, lineHeight: 19 },
  shared: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: FINE.tile, borderWidth: 1, borderColor: FINE.line, borderRadius: 14, padding: 12 },
  sharedText: { ...ff('regular'), color: FINE.ivory, fontSize: 13, flex: 1, lineHeight: 18 },
  shareHint: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18, marginBottom: 10 },
  scopes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Chips con borde fino; elegido, borde jade y letra marfil (como FChip)
  scope: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, borderWidth: 1, borderColor: FINE.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  scopeOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  scopeText: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  scopeTextOn: { color: FINE.ivory },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, minHeight: 36, borderWidth: 1, borderColor: FINE.jadeLine, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  shareBtnText: { ...ff('regular'), color: FINE.jade, fontSize: 13 },
  // Botón principal: esmeralda con la letra marfil (como FButton)
  cta: { backgroundColor: FINE.emerald, borderRadius: 22, paddingVertical: 13, minHeight: 48, justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  ctaText: { ...ff('medium'), color: '#F0EFE6', fontSize: 15 },
});
