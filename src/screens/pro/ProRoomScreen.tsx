import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsWide } from '@/components/pro/ProLayout';
import { VideoPane } from '@/components/pro/VideoPane';
import { NotesPanel, ResultsPanel } from '@/components/pro/PatientPanels';
import { Colors, OnDark } from '@/constants/colors';
import { isPortalDemo, portal } from '@/data/specialistPortal';
import { DailyCall } from '@/components/DailyCall';
import { getVideoJoinUrl } from '@/data/video';
import { Appointment, PatientLabResult, PatientSummary } from '@/data/specialistTypes';

type Panel = 'results' | 'notes';

// D. Sala de consulta. Web de escritorio → SplitScreenConsultation (vídeo a la
// izquierda, datos y notas en directo a la derecha). Móvil → MobileVideoConsultation
// (vídeo a pantalla completa y resultados/notas en un panel inferior deslizable).
export const ProRoomScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const { appt: apptId, patient: patientId, mode: modeParam } = useLocalSearchParams<{ appt?: string; patient: string; mode?: string }>();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [lab, setLab] = useState<PatientLabResult | null>(null);
  // Vídeo real (Daily) con cuenta de especialista; en la demo, la sala simulada.
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState('');
  const [realApptId, setRealApptId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date(Date.now() + 60 * 86400000).toISOString();
    const [appts, patients, l] = await Promise.all([
      apptId ? portal.listAppointments(from, to) : Promise.resolve([]),
      portal.listPatients(),
      portal.patientLab(patientId).catch(() => null),
    ]);
    const a = appts.find((x) => x.id === apptId) ?? null;
    setAppt(a);
    setPatient(patients.find((p) => p.id === patientId) ?? null);
    setLab(l);
    if (a && a.status === 'pending') await portal.updateAppointment(a.id, { status: 'confirmed' });
    if (!isPortalDemo()) {
      try {
        // Llamada sin cita previa (desde la ficha): se crea una cita "ahora" para la sala.
        const id =
          a?.id ??
          (await portal.scheduleFollowUp(
            patientId,
            patients.find((p) => p.id === patientId)?.name ?? 'Patient',
            new Date().toISOString(),
            'follow_up',
            modeParam === 'voice' ? 'voice' : 'video',
            30,
          ));
        setRealApptId(id);
        setJoinUrl(await getVideoJoinUrl(id));
      } catch (e) {
        setVideoError(e instanceof Error ? e.message : 'Could not open the video room');
      }
    }
  }, [apptId, patientId, modeParam]);

  useEffect(() => {
    load();
  }, [load]);

  const mode: 'video' | 'voice' = (appt?.modality ?? (modeParam === 'voice' ? 'voice' : 'video')) as 'video' | 'voice';
  const name = patient?.name ?? appt?.patientName ?? 'Patient';

  const end = async () => {
    const id = appt?.id ?? realApptId;
    if (id) await portal.updateAppointment(id, { status: 'completed' });
    router.canGoBack() ? router.back() : router.replace('/pro');
  };

  const video = isPortalDemo() ? null : joinUrl ? (
    <DailyCall joinUrl={joinUrl} onClose={end} patientName={name} />
  ) : (
    <View style={styles.videoState}>
      <Text style={styles.videoStateText}>{videoError || 'Preparing the video room…'}</Text>
      {videoError ? (
        <TouchableOpacity onPress={end}>
          <Text style={styles.videoStateLink}>Close</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
  const props = { name, mode, patientId, apptId: appt?.id ?? realApptId, lab, onEnd: end, video };

  if (wide) return <SplitScreenConsultation {...props} />;
  return <MobileVideoConsultation {...props} />;
};

interface RoomProps {
  name: string;
  mode: 'video' | 'voice';
  patientId: string;
  apptId: string | null;
  lab: PatientLabResult | null;
  onEnd: () => void;
  video: React.ReactNode | null; // sala real (Daily); null = sala simulada
}

const PanelTabs = ({ value, onChange }: { value: Panel; onChange: (p: Panel) => void }) => (
  <View style={styles.tabs}>
    {(['results', 'notes'] as Panel[]).map((p) => (
      <TouchableOpacity key={p} style={[styles.tab, value === p && styles.tabOn]} onPress={() => onChange(p)}>
        <Ionicons name={p === 'results' ? 'flask-outline' : 'create-outline'} size={16} color={value === p ? Colors.background : Colors.textSecondary} />
        <Text style={[styles.tabText, value === p && { color: Colors.background }]}>{p === 'results' ? 'Results' : 'Live notes'}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ---------------------------------------------------------------- Web de escritorio
const SplitScreenConsultation = ({ name, mode, patientId, apptId, lab, onEnd, video }: RoomProps) => {
  const [panel, setPanel] = useState<Panel>('results');
  return (
    <View style={styles.split}>
      <View style={styles.splitVideo}>{video ?? <VideoPane patientName={name} mode={mode} onEnd={onEnd} />}</View>
      <View style={styles.splitSide}>
        <View style={styles.sideHead}>
          <Text style={styles.sideTitle}>{name}</Text>
          {video ? (
            <TouchableOpacity style={styles.endBtn} onPress={onEnd}>
              <Text style={styles.endBtnText}>End consultation</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <PanelTabs value={panel} onChange={setPanel} />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {panel === 'results' ? <ResultsPanel lab={lab} compact /> : <NotesPanel patientId={patientId} appointmentId={apptId} live />}
        </ScrollView>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------- Móvil
const MobileVideoConsultation = ({ name, mode, patientId, apptId, lab, onEnd, video }: RoomProps) => {
  const { height } = useWindowDimensions();
  const sheetH = Math.round(height * 0.68);
  const [panel, setPanel] = useState<Panel | null>(null);
  const y = useRef(new Animated.Value(sheetH)).current;

  const open = (p: Panel) => {
    setPanel(p);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };
  const close = () => Animated.timing(y, { toValue: sheetH, duration: 220, useNativeDriver: true }).start(() => setPanel(null));

  // Deslizar el asa hacia abajo cierra el panel.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => (g.dy > 90 ? close() : Animated.spring(y, { toValue: 0, useNativeDriver: true }).start()),
    }),
  ).current;

  return (
    <View style={styles.mobileRoot}>
      {video ?? <VideoPane patientName={name} mode={mode} onEnd={onEnd} bottomInset={70} />}
      <SafeAreaView edges={['bottom']} style={styles.mobileBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.mobileBtn} onPress={() => open('results')}>
          <Ionicons name="flask-outline" size={18} color={OnDark.text} />
          <Text style={styles.mobileBtnText}>Results</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mobileBtn} onPress={() => open('notes')}>
          <Ionicons name="create-outline" size={18} color={OnDark.text} />
          <Text style={styles.mobileBtnText}>Notes</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {panel && <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />}
      <Animated.View style={[styles.sheet, { height: sheetH, transform: [{ translateY: y }] }]}>
        <View {...pan.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
          <PanelTabs value={panel ?? 'results'} onChange={(p) => setPanel(p)} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {panel === 'notes' ? <NotesPanel patientId={patientId} appointmentId={apptId} live /> : <ResultsPanel lab={lab} compact />}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  split: { flex: 1, flexDirection: 'row', backgroundColor: Colors.background },
  splitVideo: { flex: 1.35, padding: 12, paddingRight: 6 },
  splitSide: { flex: 1, maxWidth: 520, backgroundColor: Colors.card, borderLeftWidth: 1, borderLeftColor: Colors.cardBorder, padding: 16, gap: 12 },
  sideTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '900', flex: 1 },
  sideHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  endBtn: { backgroundColor: '#E5484D', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  endBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  videoState: { flex: 1, backgroundColor: OnDark.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, borderRadius: 12 },
  videoStateText: { color: OnDark.text, fontSize: 15, textAlign: 'center' },
  videoStateLink: { color: OnDark.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: Colors.cardBorder },
  tabOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  mobileRoot: { flex: 1, backgroundColor: OnDark.background, overflow: 'hidden' },
  mobileBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 12, paddingBottom: 12 },
  mobileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  mobileBtnText: { color: OnDark.text, fontSize: 13, fontWeight: '700' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 12, gap: 10 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.cardBorder },
});
