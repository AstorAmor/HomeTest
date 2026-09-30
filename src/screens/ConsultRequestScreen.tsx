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

const KINDS: { id: RequestKind; icon: string; hint: string }[] = [
  { id: 'question', icon: 'help-circle-outline', hint: 'A quick question about your health or plan' },
  { id: 'results_review', icon: 'flask-outline', hint: 'Ask them to look at your latest results' },
  { id: 'async_video', icon: 'film-outline', hint: 'Get a short video explaining your results' },
];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

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

  const load = useCallback(async () => {
    const all = await consult.myRequests().catch(() => []);
    setHistory(all.filter((r) => r.professionalId === proId));
  }, [proId, setHistory]);
  useReloadOnFocus(load);

  const send = async () => {
    setState('sending');
    setError('');
    try {
      await consult.sendRequest({ proId, proName, patientName: user?.nombre ?? 'Patient', kind, message: message.trim() });
      setMessage('');
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
        {state === 'sent' && (
          <Text style={styles.sent}>
            Sent ✓ {isRealProfessional(proId) ? '' : '(prototype: this specialist isn’t on HomeTest yet)'}
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
                <Text style={styles.msg}>{r.message}</Text>
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
      <TouchableOpacity style={[styles.cta, !message.trim() && { opacity: 0.5 }]} disabled={!message.trim() || state === 'sending'} onPress={send}>
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
  cta: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
});
