import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import { StoredAudio } from '@/components/VoiceNote';
import { ClinicalNote, ConsultRequest, PatientLabResult, PatientMarker, REQUEST_KIND_LABEL } from '@/data/specialistTypes';
import { TemplatePicker } from '@/components/pro/TemplatePicker';
import { useProIdentity } from '@/components/pro/ProLayout';
import { TEMPLATE_TOPICS, TopicOption, findGaps, guessTopic, templates, toTemplateBody, topicOptions, topicSettings } from '@/data/proTemplates';

import { dateLocale, num, t as tr } from '@/i18n';
const shortDate = (iso: string | null) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Posición 0-1 del valor dentro de una barra que va de low-20% a high+20%.
const barPos = (m: PatientMarker) => {
  const v = typeof m.value === 'number' ? m.value : NaN;
  if (Number.isNaN(v) || m.low === null || m.high === null) return null;
  const span = m.high - m.low || 1;
  const min = m.low - span * 0.4;
  const max = m.high + span * 0.4;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
};

// ---------------------------------------------------------------- Resultados
export const ResultsPanel = ({ lab, compact }: { lab: PatientLabResult | null; compact?: boolean }) => {
  const [all, setAll] = useState(false);
  if (!lab) {
    return <Text style={styles.muted}>{tr('No lab results shared yet. Ask the patient to share "Lab reports" with you.')}</Text>;
  }
  const out = lab.markers.filter((m) => m.status !== 'in');
  const shown = all ? lab.markers : out;
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.labHead}>
        <Ionicons name="document-text-outline" size={18} color={Colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.labTitle}>{lab.title}</Text>
          <Text style={styles.muted}>
            {shortDate(lab.date)} · {lab.lab} · {tr('{n} of {total} out of range', { n: out.length, total: lab.markers.length })}
          </Text>
        </View>
        {!compact && (
          <TouchableOpacity style={styles.fileBtn}>
            <Ionicons name="attach-outline" size={16} color={Colors.accent} />
            <Text style={styles.fileText}>{tr('PDF')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {shown.map((m) => {
        const pos = barPos(m);
        const color = m.status === 'in' ? Colors.ok : Colors.attention;
        return (
          <View key={m.id} style={styles.marker}>
            <View style={{ flex: 1 }}>
              <Text style={styles.markerName} numberOfLines={1}>
                {m.name}
              </Text>
              <Text style={styles.range}>
                {m.low === null ? '–' : num(m.low)} – {m.high === null ? '–' : num(m.high)} {m.unit}
              </Text>
            </View>
            {pos !== null && (
              <View style={styles.bar}>
                <View style={styles.barIn} />
                <View style={[styles.barDot, { left: `${pos * 100}%`, backgroundColor: color }]} />
              </View>
            )}
            <Text style={[styles.markerValue, { color }]}>
              {num(m.value)} {m.status === 'high' ? '↑' : m.status === 'low' ? '↓' : ''}
            </Text>
          </View>
        );
      })}
      <TouchableOpacity onPress={() => setAll((v) => !v)}>
        <Text style={styles.link}>{all ? tr('Show only out-of-range values') : tr('Show all {n} values', { n: lab.markers.length })}</Text>
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------- Notas SOAP
const FIELDS: { key: 'subjective' | 'objective' | 'assessment' | 'plan'; label: string; hint: string }[] = [
  { key: 'subjective', label: 'S · Subjective', hint: 'What the patient tells you' }, // se traducen al pintar
  { key: 'objective', label: 'O · Objective', hint: 'Results, measurements' },
  { key: 'assessment', label: 'A · Assessment', hint: 'Your clinical judgement' },
  { key: 'plan', label: 'P · Plan', hint: 'Next steps, tests, follow-up' },
];

// Editor de notas privadas. `live`: guarda solo al dejar de escribir (en consulta).
export const NotesPanel = ({ patientId, appointmentId, live }: { patientId: string; appointmentId?: string | null; live?: boolean }) => {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [draft, setDraft] = useState<Partial<ClinicalNote>>({});
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const list = await portal.listNotes(patientId);
    setNotes(list);
    // En consulta, continuar la nota de esta cita si ya existe
    const current = appointmentId ? list.find((n) => n.appointmentId === appointmentId) : undefined;
    setDraft(current ?? { patientId, appointmentId: appointmentId ?? null });
  }, [patientId, appointmentId]);

  useEffect(() => {
    load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const save = async (d: Partial<ClinicalNote>) => {
    setState('saving');
    const saved = await portal.saveNote({ ...d, patientId, appointmentId: appointmentId ?? d.appointmentId ?? null });
    setDraft(saved);
    setNotes((prev) => [saved, ...prev.filter((n) => n.id !== saved.id)]);
    setState('saved');
  };

  const change = (key: (typeof FIELDS)[number]['key'], value: string) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    setState('idle');
    if (live) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => save(next), 1200);
    }
  };

  const history = notes.filter((n) => n.id !== draft.id);

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.notesHead}>
        <Ionicons name="lock-closed-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.muted}>{tr('Private notes — only you can see them')}</Text>
        <View style={{ flex: 1 }} />
        {state === 'saving' ? <ActivityIndicator size="small" color={Colors.accent} /> : state === 'saved' ? <Text style={styles.saved}>{tr('Saved')}</Text> : null}
      </View>
      {FIELDS.map((f) => (
        <View key={f.key}>
          <Text style={styles.fieldLabel}>{tr(f.label)}</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder={tr(f.hint)}
            placeholderTextColor={Colors.textMuted}
            value={(draft[f.key] as string) ?? ''}
            onChangeText={(t) => change(f.key, t)}
          />
        </View>
      ))}
      {!live && (
        <TouchableOpacity style={styles.btn} onPress={() => save(draft)}>
          <Text style={styles.btnText}>{draft.id ? tr('Update note') : tr('Save note')}</Text>
        </TouchableOpacity>
      )}
      {history.length > 0 && (
        <View style={{ gap: 8, marginTop: 6 }}>
          <Text style={styles.sectionLabel}>{tr('Earlier notes')}</Text>
          {history.map((n) => (
            <TouchableOpacity key={n.id} style={styles.pastNote} onPress={() => !live && setDraft(n)}>
              <Text style={styles.pastDate}>{shortDate(n.createdAt)}</Text>
              {FIELDS.map((f) =>
                n[f.key] ? (
                  <Text key={f.key} style={styles.pastLine}>
                    <Text style={{ fontWeight: '800' }}>{f.label.slice(0, 1)}: </Text>
                    {n[f.key]}
                  </Text>
                ) : null,
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------- Solicitudes
// Contestar con plantillas: se sugieren por la pregunta, se insertan y no se puede enviar
// mientras quede un hueco [entre corchetes] sin rellenar.
export const RequestsPanel = ({ requests, onAnswered }: { requests: ConsultRequest[]; onAnswered: () => void }) => {
  const [answer, setAnswer] = useState<Record<string, string>>({});
  if (requests.length === 0) return <Text style={styles.muted}>{tr('No requests from this patient.')}</Text>;
  return (
    <View style={{ gap: 10 }}>
      {requests.map((r) => {
        const text = answer[r.id] ?? '';
        const gaps = findGaps(text);
        const canSend = !!text.trim() && gaps.length === 0;
        return (
          <View key={r.id} style={styles.request}>
            <View style={styles.requestHead}>
              <Text style={styles.requestKind}>{REQUEST_KIND_LABEL[r.kind]}</Text>
              <Text style={[styles.requestStatus, { color: r.status === 'open' ? Colors.attention : Colors.ok }]}>
                {r.status === 'open' ? tr('Pending') : r.status === 'answered' ? tr('Answered') : tr('Closed')}
              </Text>
            </View>
            {r.message ? <Text style={styles.requestMsg}>{r.message}</Text> : null}
            {r.audioPath ? <StoredAudio path={r.audioPath} label={tr('Voice note from the patient')} /> : null}
            <Text style={styles.muted}>{shortDate(r.createdAt)}</Text>
            {r.response ? (
              <>
                <View style={styles.response}>
                  <Text style={styles.responseText}>{r.response}</Text>
                </View>
                <SaveAsTemplate request={r} />
              </>
            ) : (
              <>
                <TemplatePicker
                  question={r.message}
                  patientName={r.patientName}
                  extraTopic={r.kind === 'results_review' ? 'blood_test' : undefined}
                  onInsert={(t) => setAnswer((a) => ({ ...a, [r.id]: a[r.id]?.trim() ? `${a[r.id].trimEnd()}\n\n${t}` : t }))}
                />
                <TextInput
                  style={[styles.input, { minHeight: Math.min(420, 56 + text.split('\n').length * 18) }]}
                  multiline
                  placeholder={tr('Write your answer, or insert a template')}
                  placeholderTextColor={Colors.textMuted}
                  value={text}
                  onChangeText={(t) => setAnswer((a) => ({ ...a, [r.id]: t }))}
                />
                {gaps.length > 0 && (
                  <View style={styles.gaps}>
                    <Ionicons name="create-outline" size={14} color={Colors.attention} />
                    <Text style={styles.gapsText}>
                      Fill in or delete before sending: {gaps.slice(0, 4).join('  ')}
                      {gaps.length > 4 ? `  +${gaps.length - 4} more` : ''}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.btn, !canSend && { opacity: 0.5 }]}
                  disabled={!canSend}
                  onPress={async () => {
                    await portal.answerRequest(r.id, text.trim());
                    onAnswered();
                  }}
                >
                  <Text style={styles.btnText}>{tr('Send answer')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        );
      })}
    </View>
  );
};

// Una respuesta ya enviada se puede guardar como plantilla (el nombre del paciente pasa a [name])
const SaveAsTemplate = ({ request }: { request: ConsultRequest }) => {
  const me = useProIdentity();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  // Los temas del médico (sin los de ejemplo que haya borrado) + "Otro"
  const [options, setOptions] = useState<TopicOption[]>([]);
  const [topicKey, setTopicKey] = useState('other');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (state === 'saved') {
    return (
      <View style={styles.savedRow}>
        <Ionicons name="checkmark-circle" size={14} color={Colors.ok} />
        <Text style={styles.saved}>{tr('Saved to your templates')}</Text>
      </View>
    );
  }
  if (!open) {
    return (
      <TouchableOpacity
        onPress={async () => {
          const [list, settings] = await Promise.all([templates.list().catch(() => []), topicSettings.get()]);
          const opts = topicOptions(settings, list);
          const guessed = guessTopic(`${request.message} ${request.response ?? ''}`);
          setOptions(opts);
          setTopicKey(opts.some((o) => o.key === guessed) ? guessed : 'other');
          setOpen(true);
        }}
      >
        <Text style={styles.link}>{tr('Save this answer as a template')}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={styles.saveBox}>
      <TextInput
        style={[styles.input, { minHeight: 40 }]}
        placeholder={tr('Template name, e.g. “Iron and vitamin D together”')}
        placeholderTextColor={Colors.textMuted}
        value={title}
        onChangeText={setTitle}
        autoFocus
      />
      <View style={styles.topics}>
        {[...options, { key: 'other', label: TEMPLATE_TOPICS.find((t) => t.id === 'other')!.label, icon: '' }].map((o) => (
          <TouchableOpacity key={o.key} style={[styles.topic, topicKey === o.key && styles.topicOn]} onPress={() => setTopicKey(o.key)}>
            <Text style={[styles.topicText, topicKey === o.key && { color: Colors.background }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {state === 'error' && <Text style={styles.error}>{tr('Could not save the template. Try again.')}</Text>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          style={[styles.btn, { flex: 1 }, !title.trim() && { opacity: 0.5 }]}
          disabled={!title.trim() || state === 'saving'}
          onPress={async () => {
            setState('saving');
            try {
              const o = options.find((x) => x.key === topicKey);
              await templates.save({
                title,
                topic: o?.fixed ?? 'other',
                customTopic: o?.custom ?? null,
                keywords: [],
                body: toTemplateBody(request.response ?? '', request.patientName, me.name),
              });
              setState('saved');
            } catch {
              setState('error');
            }
          }}
        >
          <Text style={styles.btnText}>{tr('Save template')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => setOpen(false)}>
          <Text style={styles.btnGhostText}>{tr('Cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  muted: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
  labHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  labTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.5), borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  fileText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  marker: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.background, borderRadius: 10, padding: 10 },
  markerName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  range: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  bar: { width: 80, height: 6, borderRadius: 3, backgroundColor: withAlpha(Colors.attention, 0.25) },
  barIn: { position: 'absolute', left: '22%', right: '22%', top: 0, bottom: 0, backgroundColor: withAlpha(Colors.ok, 0.45), borderRadius: 3 },
  barDot: { position: 'absolute', top: -3, width: 12, height: 12, marginLeft: -6, borderRadius: 6, borderWidth: 2, borderColor: Colors.card },
  markerValue: { fontSize: 14, fontWeight: '900', minWidth: 58, textAlign: 'right' },
  notesHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saved: { color: Colors.ok, fontSize: 12, fontWeight: '700' },
  fieldLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  input: { minHeight: 56, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 14, textAlignVertical: 'top' },
  btn: { backgroundColor: Colors.accent, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  sectionLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  pastNote: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, gap: 3 },
  pastDate: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  pastLine: { color: Colors.textPrimary, fontSize: 12, lineHeight: 17 },
  request: { backgroundColor: Colors.background, borderRadius: 12, padding: 12, gap: 6 },
  requestHead: { flexDirection: 'row', justifyContent: 'space-between' },
  requestKind: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  requestStatus: { fontSize: 12, fontWeight: '800' },
  requestMsg: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  response: { borderLeftWidth: 3, borderLeftColor: Colors.accent, paddingLeft: 10 },
  responseText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  gaps: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  gapsText: { color: Colors.attention, fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  saveBox: { gap: 8, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 8 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topic: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  topicOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  topicText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  error: { color: Colors.danger, fontSize: 12 },
  btnGhost: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  btnGhostText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
