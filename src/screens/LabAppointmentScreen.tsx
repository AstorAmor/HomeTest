import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TileMap } from '@/components/TileMap';
import { LabCenterInfo } from '@/components/LabCenterInfo';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { Colors } from '@/constants/colors';
import { LAB_CENTERS } from '@/data/labCenters';
import { appointmentEvent, LabAppointment, labAppointmentRepository } from '@/data/labAppointments';
import { calendarLinks } from '@/data/schedule';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { TAB, tabHref } from '@/constants/tabs';

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Ficha de una cita en laboratorio (/lab-appointment?id=…): se abre al tocar la cita en Hoy, Lab,
// Agenda o en "Pedir cita". Mapa con el centro, llamar, cómo llegar, añadir al calendario, cambiar
// día u hora (vuelve a "Pedir cita" con el centro elegido) y cancelar.
// PROTOTIPO como la reserva: todo vive en el móvil y el laboratorio aún no recibe nada.
export const LabAppointmentScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [appt, setAppt] = useDeepState<LabAppointment | null>(null);
  const [loaded, setLoaded] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      setAppt(id ? await labAppointmentRepository.get(String(id)) : null);
      setLoaded(true);
    }, [id, setAppt]),
  );

  const center = appt ? LAB_CENTERS.find((c) => c.id === appt.centerId) ?? null : null;

  if (!appt || !center) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Lab appointment')} showBack backFallback={tabHref(TAB.schedule)} />
        {loaded && <Text style={styles.empty}>{t('This appointment no longer exists. It may have been cancelled.')}</Text>}
      </SafeAreaView>
    );
  }

  const links = calendarLinks(appointmentEvent(appt, center));

  const cancel = async () => {
    const ok = await confirmAsk(
      t('Cancel this appointment?'),
      `${longDate(appt.date)} · ${appt.time}\n${center.network} ${center.name}`,
      t('Cancel appointment'),
    );
    if (!ok) return;
    await labAppointmentRepository.cancel(appt.id);
    if (router.canGoBack()) router.back();
    else router.replace(tabHref(TAB.schedule) as any);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Lab appointment')} showBack backFallback={tabHref(TAB.schedule)} />

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="flask-outline" size={24} color={Colors.background} />
          </View>
          <Text style={styles.heroDate}>{capitalised(longDate(appt.date))}</Text>
          <Text style={styles.heroTime}>{appt.time}</Text>
          <Text style={styles.heroLab}>
            {center.network} · {center.name}
          </Text>
        </View>

        <View style={styles.mapWrap}>
          <TileMap points={[center]} selectedId={center.id} height={220} />
        </View>
        <LabCenterInfo center={center} calendarUrl={links.google} />

        <TouchableOpacity
          style={styles.reschedule}
          onPress={() => router.push({ pathname: '/book-lab', params: { center: center.id, reschedule: appt.id } })}
          activeOpacity={0.85}
        >
          <Ionicons name="swap-horizontal-outline" size={18} color={Colors.background} />
          <Text style={styles.rescheduleText}>{t('Change day or time')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.85}>
          <Text style={styles.cancelText}>{t('Cancel appointment')}</Text>
        </TouchableOpacity>
        <Text style={styles.proto}>{t('Prototype: the lab has not received this booking yet.')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  empty: { color: Colors.textSecondary, fontSize: 14, marginHorizontal: 20, marginTop: 12 },
  hero: { alignItems: 'center', gap: 4, marginHorizontal: 20, marginBottom: 18 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroDate: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroTime: { color: Colors.accent, fontSize: 30, fontWeight: '800' },
  heroLab: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  mapWrap: { marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  reschedule: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 22,
  },
  rescheduleText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
  proto: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 2 },
});
