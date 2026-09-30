import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Switch, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProLayout, useIsWide, useProIdentity } from '@/components/pro/ProLayout';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { isPortalDemo, portal } from '@/data/specialistPortal';
import { updateMyProfessionalChannels } from '@/data/sharing';
import { Availability, DEFAULT_AVAILABILITY, TimeRange, WEEKDAYS, WEEKDAY_LABEL, Weekday } from '@/data/specialistTypes';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { AppearanceSwitch } from '@/components/AppearanceSwitch';

const SLOT_OPTIONS = [15, 20, 30, 45, 60];
const BUFFER_OPTIONS = [0, 5, 10, 15];
const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// A. Perfil y configuración: datos del especialista, contacto profesional y privado,
// canales que ofrece a sus pacientes y configuración de la agenda.
export const ProSettingsScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const me = useProIdentity();
  const { professional, refreshProfessional, logout, setDemoMode, demoMode } = useAuth();
  const demo = isPortalDemo();

  const [contact, setContact] = useState({ firstName: '', lastName: '', workPhone: '', workEmail: '' });
  const [priv, setPriv] = useState({ personalPhone: '', personalEmail: '' });
  const [channels, setChannels] = useState({ videoEnabled: true, requestsEnabled: true, chatEnabled: false });
  const [av, setAv] = useState<Availability>(DEFAULT_AVAILABILITY);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  useReloadOnFocus(
    useCallback(async () => {
      const [a, p] = await Promise.all([portal.getAvailability(), portal.getPrivate()]);
      setAv(a);
      setPriv(p);
      if (professional) {
        setContact({
          firstName: professional.firstName ?? '',
          lastName: professional.lastName ?? '',
          workPhone: professional.workPhone ?? '',
          workEmail: professional.workEmail ?? '',
        });
        setChannels({
          videoEnabled: professional.videoEnabled !== false,
          requestsEnabled: professional.requestsEnabled !== false,
          chatEnabled: !!professional.chatEnabled,
        });
      } else {
        setContact({ firstName: 'Marta', lastName: 'Echeverría', workPhone: '+34 910 000 000', workEmail: 'marta@consulta.example' });
        setChannels({ videoEnabled: true, requestsEnabled: true, chatEnabled: true });
      }
    }, [professional]),
  );

  const invalidRanges = WEEKDAYS.some((d) => av.weekly[d].some((r) => !isTime(r.start) || !isTime(r.end) || r.start >= r.end));

  const save = async () => {
    if (invalidRanges) {
      setError('Check the opening hours: use HH:MM and make each end later than its start.');
      setState('error');
      return;
    }
    setState('saving');
    setError('');
    try {
      await Promise.all([
        portal.saveAvailability(av),
        portal.savePrivate(priv),
        demo ? Promise.resolve() : updateMyProfessionalChannels({ ...contact, ...channels }),
      ]);
      if (!demo) await refreshProfessional();
      setState('saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setState('error');
    }
  };

  const setDay = (d: Weekday, ranges: TimeRange[]) => setAv((a) => ({ ...a, weekly: { ...a.weekly, [d]: ranges } }));

  const appearanceCard = (
    <Section title="Appearance">
      <AppearanceSwitch returnTo="/pro-settings" />
      <Text style={styles.muted}>Light, dark or follow your device. The portal reloads and you stay signed in.</Text>
    </Section>
  );

  const profileCard = (
    <Section title="Your profile">
      <View style={styles.idRow}>
        <View style={styles.idAvatar}>
          <Ionicons name="person" size={26} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.idName}>{me.name}</Text>
          <Text style={styles.muted}>
            {me.role} · {me.verified ? 'Verified by HomeTest' : 'Pending verification'}
          </Text>
        </View>
      </View>
      {!demo ? (
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/pro-profile')}>
          <Ionicons name="create-outline" size={16} color={Colors.accent} />
          <Text style={styles.linkText}>Edit public profile: photo, specialty, licence no., bio, languages, rate</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.muted}>In the demo the public profile can't be edited.</Text>
      )}
    </Section>
  );

  const contactCard = (
    <Section title="Contact">
      <View style={styles.two}>
        <Field label="First name" value={contact.firstName} onChange={(v) => setContact({ ...contact, firstName: v })} />
        <Field label="Last name" value={contact.lastName} onChange={(v) => setContact({ ...contact, lastName: v })} />
      </View>
      <Text style={styles.groupLabel}>Professional · patients can see it</Text>
      <View style={styles.two}>
        <Field label="Work phone" value={contact.workPhone} onChange={(v) => setContact({ ...contact, workPhone: v })} keyboard="phone-pad" />
        <Field label="Work email" value={contact.workEmail} onChange={(v) => setContact({ ...contact, workEmail: v })} keyboard="email-address" />
      </View>
      <Text style={styles.groupLabel}>
        <Ionicons name="lock-closed-outline" size={12} /> Personal · only you and HomeTest
      </Text>
      <View style={styles.two}>
        <Field label="Personal phone" value={priv.personalPhone} onChange={(v) => setPriv({ ...priv, personalPhone: v })} keyboard="phone-pad" />
        <Field label="Personal email" value={priv.personalEmail} onChange={(v) => setPriv({ ...priv, personalEmail: v })} keyboard="email-address" />
      </View>
    </Section>
  );

  const channelsCard = (
    <Section title="Channels you offer">
      <Toggle label="Video and phone consultations" sub="Patients can book in your free slots" value={channels.videoEnabled} onChange={(v) => setChannels({ ...channels, videoEnabled: v })} />
      <Toggle label="Requests" sub="Questions and results reviews, answered when it suits you" value={channels.requestsEnabled} onChange={(v) => setChannels({ ...channels, requestsEnabled: v })} />
      <Toggle label="Chat" sub="Direct messages with your patients" value={channels.chatEnabled} onChange={(v) => setChannels({ ...channels, chatEnabled: v })} />
    </Section>
  );

  const agendaCard = (
    <Section title="Agenda">
      <Text style={styles.groupLabel}>Calendar sync</Text>
      <View style={styles.chips}>
        {(['none', 'google', 'outlook'] as const).map((p) => (
          <TouchableOpacity key={p} style={[styles.chip, av.calendarProvider === p && styles.chipOn]} onPress={() => setAv({ ...av, calendarProvider: p })}>
            {p !== 'none' && <Ionicons name={p === 'google' ? 'logo-google' : 'logo-microsoft'} size={14} color={av.calendarProvider === p ? Colors.background : Colors.textSecondary} />}
            <Text style={[styles.chipText, av.calendarProvider === p && { color: Colors.background }]}>{p === 'none' ? 'None' : p === 'google' ? 'Google' : 'Outlook'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {av.calendarProvider !== 'none' && (
        <Text style={styles.muted}>
          Next step: sign in with {av.calendarProvider === 'google' ? 'Google' : 'Microsoft'} to sync both ways. Until then, each consultation can be added to your calendar with one tap.
        </Text>
      )}

      <Text style={styles.groupLabel}>Consultation length</Text>
      <View style={styles.chips}>
        {SLOT_OPTIONS.map((m) => (
          <TouchableOpacity key={m} style={[styles.chip, av.slotMinutes === m && styles.chipOn]} onPress={() => setAv({ ...av, slotMinutes: m })}>
            <Text style={[styles.chipText, av.slotMinutes === m && { color: Colors.background }]}>{m}′</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.groupLabel}>Buffer between consultations</Text>
      <View style={styles.chips}>
        {BUFFER_OPTIONS.map((m) => (
          <TouchableOpacity key={m} style={[styles.chip, av.bufferMinutes === m && styles.chipOn]} onPress={() => setAv({ ...av, bufferMinutes: m })}>
            <Text style={[styles.chipText, av.bufferMinutes === m && { color: Colors.background }]}>{m === 0 ? 'None' : `${m}′`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.groupLabel}>Weekly availability</Text>
      {WEEKDAYS.map((d) => {
        const ranges = av.weekly[d];
        return (
          <View key={d} style={styles.dayRow}>
            <View style={styles.dayHead}>
              <Switch
                value={ranges.length > 0}
                onValueChange={(on) => setDay(d, on ? [{ start: '09:00', end: '14:00' }] : [])}
                trackColor={{ true: Colors.accent, false: Colors.cardBorder }}
              />
              <Text style={styles.dayName}>{WEEKDAY_LABEL[d]}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              {ranges.length === 0 && <Text style={styles.muted}>Unavailable</Text>}
              {ranges.map((r, i) => (
                <View key={i} style={styles.rangeRow}>
                  <TextInput style={[styles.time, !isTime(r.start) && styles.bad]} value={r.start} onChangeText={(t) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, start: t } : x)))} maxLength={5} />
                  <Text style={styles.muted}>–</Text>
                  <TextInput style={[styles.time, (!isTime(r.end) || r.end <= r.start) && styles.bad]} value={r.end} onChangeText={(t) => setDay(d, ranges.map((x, j) => (j === i ? { ...x, end: t } : x)))} maxLength={5} />
                  <TouchableOpacity onPress={() => setDay(d, ranges.filter((_, j) => j !== i))} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
              {ranges.length > 0 && ranges.length < 3 && (
                <TouchableOpacity onPress={() => setDay(d, [...ranges, { start: '16:00', end: '19:00' }])}>
                  <Text style={styles.linkText}>+ Add hours</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </Section>
  );

  return (
    <ProLayout
      active="settings"
      title="Profile & settings"
      right={
        <TouchableOpacity style={styles.save} onPress={save} disabled={state === 'saving'}>
          {state === 'saving' ? <ActivityIndicator color={Colors.background} size="small" /> : <Text style={styles.saveText}>{state === 'saved' ? 'Saved ✓' : 'Save'}</Text>}
        </TouchableOpacity>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {wide ? (
        <View style={styles.cols}>
          <View style={styles.col}>
            {profileCard}
            {contactCard}
            {channelsCard}
          </View>
          <View style={styles.col}>
            {appearanceCard}
            {agendaCard}
          </View>
        </View>
      ) : (
        <>
          {profileCard}
          {contactCard}
          {channelsCard}
          {agendaCard}
          {appearanceCard}
        </>
      )}
      <TouchableOpacity
        style={styles.exit}
        onPress={() => {
          if (demoMode === 'pro') {
            setDemoMode(null);
            router.replace('/');
          } else logout();
        }}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Text style={styles.exitText}>{demoMode === 'pro' ? 'Exit demo portal' : 'Log out'}</Text>
      </TouchableOpacity>
    </ProLayout>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Field = ({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (v: string) => void; keyboard?: 'phone-pad' | 'email-address' }) => (
  <View style={{ flex: 1, minWidth: 140 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={keyboard} autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'} placeholderTextColor={Colors.textMuted} />
  </View>
);

const Toggle = ({ label, sub, value, onChange }: { label: string; sub: string; value: boolean; onChange: (v: boolean) => void }) => (
  <View style={styles.toggleRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Text style={styles.muted}>{sub}</Text>
    </View>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: Colors.accent, false: Colors.cardBorder }} />
  </View>
);

const styles = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  col: { flex: 1, gap: 0 },
  section: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 16, marginBottom: 16, gap: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  muted: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  idAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  idName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { color: Colors.accent, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  two: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  groupLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 4 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, color: Colors.textPrimary, fontSize: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  dayRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.divider },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 104 },
  dayName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { width: 64, textAlign: 'center', borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 8, paddingVertical: 6, color: Colors.textPrimary, fontSize: 14 },
  bad: { borderColor: Colors.danger },
  save: { backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7, minWidth: 70, alignItems: 'center' },
  saveText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  error: { color: Colors.danger, fontSize: 13, marginBottom: 10 },
  exit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  exitText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
});
