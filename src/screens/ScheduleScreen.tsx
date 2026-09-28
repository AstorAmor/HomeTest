import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MonthCalendar, toDayKey } from '@/components/MonthCalendar';
import { Colors } from '@/constants/colors';
import { buildSchedule, calendarLinks, SCHEDULE_COLORS, ScheduleEvent, ScheduleType } from '@/data/schedule';

const TYPE_LABEL: Record<ScheduleType, string> = {
  delivery: 'Kit delivery',
  sample: 'Take sample',
  pickup: 'Sample pickup',
  results: 'Results',
  membership: 'Membership',
};

const formatDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

// "Manage your schedule": vista mensual de pruebas, envíos y resultados, y botones
// para añadir cada evento a Google Calendar, Outlook o Yahoo.
export const ScheduleScreen = () => {
  const events = useMemo(buildSchedule, []);
  const firstUpcoming = events.find((e) => e.date >= toDayKey(new Date()))?.date ?? toDayKey(new Date());
  const [month, setMonth] = useState(new Date(`${firstUpcoming}T12:00:00`));
  const [selected, setSelected] = useState<string | null>(firstUpcoming);

  const marks = useMemo(() => {
    const out: Record<string, { color: string }[]> = {};
    for (const e of events) (out[e.date] ??= []).push({ color: SCHEDULE_COLORS[e.type] });
    return out;
  }, [events]);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const shown = selected ? events.filter((e) => e.date === selected) : events.filter((e) => e.date.startsWith(monthKey));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Your schedule" showBack />

        <View style={styles.card}>
          <MonthCalendar
            month={month}
            onMonthChange={(m) => {
              setMonth(m);
              setSelected(null);
            }}
            marks={marks}
            selectedDay={selected}
            onDayPress={(d) => setSelected(selected === d ? null : d)}
          />
          <View style={styles.legend}>
            {(Object.keys(TYPE_LABEL) as ScheduleType[])
              .filter((t) => t !== 'sample')
              .map((t) => (
                <View key={t} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SCHEDULE_COLORS[t] }]} />
                  <Text style={styles.legendText}>{TYPE_LABEL[t]}</Text>
                </View>
              ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {selected ? formatDay(selected) : month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </Text>
        {shown.length === 0 ? (
          <Text style={styles.empty}>Nothing scheduled.</Text>
        ) : (
          shown.map((e) => <EventCard key={e.id} event={e} showDate={!selected} />)
        )}

        <View style={styles.syncNote}>
          <Ionicons name="sync-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.syncText}>
            Add any event to Google Calendar, Outlook or Yahoo with one tap. Automatic two-way sync comes with your
            professional appointments.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const EventCard = ({ event, showDate }: { event: ScheduleEvent; showDate: boolean }) => {
  const links = calendarLinks(event);
  const color = SCHEDULE_COLORS[event.type];
  return (
    <View style={[styles.event, { borderLeftColor: color }]}>
      <View style={styles.eventHeader}>
        <Text style={[styles.eventType, { color }]}>{TYPE_LABEL[event.type]}</Text>
        <Text style={styles.eventTime}>
          {showDate ? `${new Date(`${event.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ` : ''}
          {event.start ? `${event.start}${event.end ? `–${event.end}` : ''}` : 'All day'}
        </Text>
      </View>
      <Text style={styles.eventTitle}>{event.title}</Text>
      <Text style={styles.eventDetail}>{event.detail}</Text>
      <View style={styles.addRow}>
        <Text style={styles.addLabel}>Add to</Text>
        {(
          [
            ['Google', links.google, 'logo-google'],
            ['Outlook', links.outlook, 'mail-outline'],
            ['Yahoo', links.yahoo, 'calendar-outline'],
          ] as const
        ).map(([label, url, icon]) => (
          <TouchableOpacity key={label} style={styles.addButton} onPress={() => Linking.openURL(url)}>
            <Ionicons name={icon} size={13} color={Colors.textPrimary} />
            <Text style={styles.addText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: Colors.textSecondary, fontSize: 11 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  empty: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 20 },
  event: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderLeftWidth: 4,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 4,
  },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  eventType: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  eventTime: { color: Colors.textSecondary, fontSize: 12 },
  eventTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  eventDetail: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  addLabel: { color: Colors.textMuted, fontSize: 12, marginRight: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  addText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  syncNote: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 14 },
  syncText: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
});
