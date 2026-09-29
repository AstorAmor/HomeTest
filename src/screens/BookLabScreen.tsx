import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TileMap } from '@/components/TileMap';
import { MonthCalendar, toDayKey } from '@/components/MonthCalendar';
import { Colors } from '@/constants/colors';
import { directionsUrl, hoursLabel, LAB_CENTERS, slotsFor, windowFor } from '@/data/labCenters';
import { appointmentEvent, LabAppointment, labAppointmentRepository } from '@/data/labAppointments';
import { calendarLinks } from '@/data/schedule';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const longDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

// "Book an appointment": elegir centro en el mapa o en la lista, día y hora.
// PROTOTIPO: la cita se guarda en el móvil; aún no se reserva en el laboratorio.
export const BookLabScreen = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [month, setMonth] = useState(new Date());
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [booked, setBooked] = useState<LabAppointment | null>(null);
  const [upcoming, setUpcoming] = useDeepState<LabAppointment[]>([]);

  const today = toDayKey(new Date());
  const center = LAB_CENTERS.find((c) => c.id === selectedId) ?? null;
  const slots = useMemo(() => (center && day ? slotsFor(center, day) : []), [center, day]);

  const load = useCallback(async () => {
    const all = await labAppointmentRepository.getAll();
    setUpcoming(all.filter((a) => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
  }, [setUpcoming, today]);
  useReloadOnFocus(load);

  const selectCenter = (id: string) => {
    setSelectedId(id);
    setTime(null);
  };

  const confirm = async () => {
    if (!center || !day || !time) return;
    const appt = await labAppointmentRepository.save({ centerId: center.id, date: day, time });
    setBooked(appt);
    load();
  };

  const cancel = async (id: string) => {
    await labAppointmentRepository.cancel(id);
    load();
  };

  if (booked && center) {
    const links = calendarLinks(appointmentEvent(booked, center));
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title="Book an appointment" showBack />
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={32} color={Colors.background} />
            </View>
            <Text style={styles.doneTitle}>Appointment requested</Text>
            <Text style={styles.doneText}>
              {longDate(booked.date)} at {booked.time}
              {'\n'}
              {center.network} · {center.name}
              {'\n'}
              {center.address}
            </Text>
            <Text style={styles.prep}>
              Bring your ID. For most blood tests, fast for 8 hours beforehand (water is fine) and avoid intense exercise
              the day before.
            </Text>
            <Text style={styles.proto}>Prototype: the lab has not received this booking yet.</Text>
          </View>
          <Text style={styles.section}>Add to your calendar</Text>
          <View style={styles.row}>
            {(['google', 'outlook', 'yahoo'] as const).map((k) => (
              <TouchableOpacity key={k} style={styles.chip} onPress={() => Linking.openURL(links[k])}>
                <Text style={styles.chipText}>{k[0].toUpperCase() + k.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(directionsUrl(center))}>
            <Ionicons name="navigate-outline" size={18} color={Colors.accent} />
            <Text style={styles.link}>Get directions</Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => {
            setBooked(null);
            setDay(null);
            setTime(null);
          }}
        >
          <Text style={styles.ctaText}>Done</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Book an appointment" showBack />
        <Text style={styles.intro}>Blood draw at a partner lab near you. Madrid · Eurofins Megalab.</Text>

        {upcoming.length > 0 && (
          <View style={styles.upcoming}>
            <Text style={styles.section}>Your appointments</Text>
            {upcoming.map((a) => {
              const c = LAB_CENTERS.find((x) => x.id === a.centerId);
              return (
                <View key={a.id} style={styles.apptRow}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.accent} />
                  <Text style={styles.apptText}>
                    {longDate(a.date)} · {a.time}
                    {'\n'}
                    <Text style={styles.muted}>{c ? `${c.network} ${c.name}` : 'Lab'}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => cancel(a.id)}>
                    <Text style={styles.cancel}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.mapWrap}>
          <TileMap points={LAB_CENTERS} selectedId={selectedId} onSelect={selectCenter} height={320} />
        </View>

        <Text style={styles.section}>{center ? 'Your lab' : `${LAB_CENTERS.length} labs in Madrid`}</Text>
        {(center ? [center] : LAB_CENTERS).map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.card, c.id === selectedId && styles.cardOn]}
            onPress={() => selectCenter(c.id)}
            activeOpacity={0.85}
          >
            <View style={styles.cardHead}>
              <Ionicons name="location" size={18} color={c.id === selectedId ? Colors.accent : Colors.textSecondary} />
              <Text style={styles.cardTitle}>
                {c.network} · {c.name}
              </Text>
            </View>
            <Text style={styles.cardText}>{c.address}</Text>
            <Text style={styles.cardText}>Blood draws: {hoursLabel(c)}</Text>
            {c.notes && <Text style={styles.muted}>{c.notes}</Text>}
          </TouchableOpacity>
        ))}
        {center && (
          <TouchableOpacity
            onPress={() => {
              setSelectedId(null);
              setDay(null);
              setTime(null);
            }}
          >
            <Text style={styles.change}>Choose another lab</Text>
          </TouchableOpacity>
        )}

        {center && (
          <>
            <Text style={styles.section}>Choose a day</Text>
            <View style={styles.calendar}>
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                selectedDay={day}
                onDayPress={(d) => {
                  if (d < today) return;
                  setDay(d);
                  setTime(null);
                }}
              />
            </View>
            {day && (
              <>
                <Text style={styles.section}>{longDate(day)}</Text>
                {slots.length === 0 ? (
                  <Text style={styles.muted}>
                    {windowFor(center, day) ? 'No times left today.' : 'This lab is closed that day. Try another day.'}
                  </Text>
                ) : (
                  <View style={styles.slots}>
                    {slots.map((s) => (
                      <TouchableOpacity key={s} style={[styles.slot, time === s && styles.slotOn]} onPress={() => setTime(s)}>
                        <Text style={[styles.slotText, time === s && { color: Colors.background }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.prep}>Tip: early slots make fasting easier.</Text>
              </>
            )}
          </>
        )}
      </ScrollView>

      {center && day && time && (
        <TouchableOpacity style={styles.cta} onPress={confirm}>
          <Text style={styles.ctaText}>
            Confirm · {new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, {time}
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 28 },
  intro: { color: Colors.textSecondary, fontSize: 14, marginHorizontal: 20, marginBottom: 14 },
  mapWrap: { marginHorizontal: 20 },
  section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 8,
    gap: 3,
  },
  cardOn: { borderColor: Colors.accent },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 },
  cardText: { color: Colors.textSecondary, fontSize: 13 },
  muted: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 0 },
  change: { color: Colors.accent, fontSize: 13, fontWeight: '700', marginHorizontal: 20, marginTop: 4 },
  calendar: { marginHorizontal: 20 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 20 },
  slot: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, paddingVertical: 8, width: '22.5%', alignItems: 'center' },
  slotOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  slotText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  prep: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginTop: 10 },
  proto: { color: Colors.warning, fontSize: 12, marginTop: 8, textAlign: 'center' },
  upcoming: {},
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  apptText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  cancel: { color: Colors.danger, fontSize: 13, fontWeight: '700' },
  done: { alignItems: 'center', gap: 10, paddingHorizontal: 24, marginTop: 20 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  doneText: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, marginHorizontal: 20 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 18 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  cta: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 16, alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
});
