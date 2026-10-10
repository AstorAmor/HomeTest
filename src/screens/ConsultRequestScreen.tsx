import { dateLocale } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { consult, isRealProfessional } from '@/data/consultations';
import { ConsultRequest, REQUEST_KIND_LABEL, RequestKind } from '@/data/specialistTypes';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { StoredAudio, VoiceRecorder } from '@/components/VoiceNote';
import { createShare, DataShare, isShareActive, listMyShares, scopeLabel, SHARE_SCOPES, ShareScope } from '@/data/sharing';

const KINDS: { id: RequestKind; icon: string; hint: string }[] = [
  { id: 'question', icon: 'help-circle-outline', hint: 'A quick question about your health or plan' },
  { id: 'results_review', icon: 'flask-outline', hint: 'Ask them to look at your latest results' },
  { id: 'async_video', icon: 'film-outline', hint: 'Get a short video explaining your results' },
];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

// "Send request": pregunta o petición que el especialista contesta cuando puede
// (sin cita). Debajo, las solicitudes anteriores con este especialista y su respuesta.
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
      await consult.sendRequest({ proId, proName, patientName: user?.nombre ?? 'Patient', kind, message: message.trim(), audioUri });
      setMessage('');
      setAudioUri(null);
      setRecorderKey((k) => k + 1);
      setState('sent');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
      setState('error');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Send a request" showBack />
        <Text style={styles.intro}>to {proName}. They'll answer in the app, usually within 48 h.</Text>

        <View style={{ gap: 8 }}>
          {KINDS.map((k) => (
            <TouchableOpacity key={k.id} style={[styles.kind, kind === k.id && styles.kindOn]} onPress={() => setKind(k.id)}>
              <Ionicons name={k.icon as any} size={20} color={kind === k.id ? Colors.accent : Colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.kindTitle}>{REQUEST_KIND_LABEL[k.id]}</Text>
                <Text style={styles.kindHint}>{k.hint}</Text>
              </View>
              {kind === k.id && <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />}
            </TouchableOpacity>
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
          placeholder="Write your message"
          placeholderTextColor={Colors.textMuted}
        />
        <View style={{ marginTop: 10 }}>
          <VoiceRecorder key={recorderKey} onChange={setAudioUri} />
        </View>

        <Text style={styles.section}>Share your data with {proName}</Text>
        {share ? (
          <View style={styles.shared}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.ok} />
            <Text style={styles.sharedText}>
              You share: {share.scopes.map(scopeLabel).join(', ')}. Change it in More → Sharing & privacy.
            </Text>
          </View>
        ) : localShared ? (
          <Text style={styles.sent}>Shared ✓ (prototype: this specialist isn’t on Kuova yet)</Text>
        ) : (
          <>
            <Text style={styles.shareHint}>So they can answer with your real results. You can revoke it anytime.</Text>
            <View style={styles.scopes}>
              {SHARE_SCOPES.map((s) => {
                const on = scopes.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.scope, on && styles.scopeOn]}
                    onPress={() => setScopes((prev) => (on ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                  >
                    <Ionicons name={s.icon as any} size={14} color={on ? Colors.background : Colors.textSecondary} />
                    <Text style={[styles.scopeText, on && { color: Colors.background }]}>{s.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={[styles.shareBtn, scopes.length === 0 && { opacity: 0.5 }]} disabled={scopes.length === 0 || shareState === 'saving'} onPress={doShare}>
              <Ionicons name="share-social-outline" size={16} color={Colors.accent} />
              <Text style={styles.shareBtnText}>{shareState === 'saving' ? 'Sharing…' : `Share with ${proName}`}</Text>
            </TouchableOpacity>
            {shareState === 'error' ? <Text style={styles.error}>Could not share. Try again.</Text> : null}
          </>
        )}
        {state === 'sent' && (
          <Text style={styles.sent}>
            Sent ✓ {isRealProfessional(proId) ? '' : '(prototype: this specialist isn’t on Kuova yet)'}
          </Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {history.length > 0 && (
          <>
            <Text style={styles.section}>Your requests</Text>
            {history.map((r) => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.meta}>
                  {REQUEST_KIND_LABEL[r.kind]} · {shortDate(r.createdAt)} · {r.status === 'open' ? 'Waiting for an answer' : 'Answered'}
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
      </ScrollView>
      <TouchableOpacity style={[styles.cta, !message.trim() && !audioUri && { opacity: 0.5 }]} disabled={(!message.trim() && !audioUri) || state === 'sending'} onPress={send}>
        {state === 'sending' ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.ctaText}>Send request</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  intro: { color: Colors.textSecondary, fontSize: 14, marginTop: -6, marginBottom: 16 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12 },
  kindOn: { borderColor: Colors.accent },
  kindTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  kindHint: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  input: { minHeight: 110, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, padding: 12, color: Colors.textPrimary, fontSize: 14, textAlignVertical: 'top', marginTop: 16 },
  sent: { color: Colors.ok, fontSize: 13, fontWeight: '700', marginTop: 8 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 8 },
  section: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 12, marginBottom: 8, gap: 6 },
  meta: { color: Colors.textSecondary, fontSize: 12 },
  msg: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  answer: { borderLeftWidth: 3, borderLeftColor: Colors.accent, paddingLeft: 10 },
  answerText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  shared: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.card, borderRadius: 12, padding: 12 },
  sharedText: { color: Colors.textPrimary, fontSize: 13, flex: 1, lineHeight: 18 },
  shareHint: { color: Colors.textSecondary, fontSize: 12, marginBottom: 8 },
  scopes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scope: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  scopeOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  scopeText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderColor: Colors.accent, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  shareBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
  cta: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
});
