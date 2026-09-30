import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { MonthCalendar, toDayKey } from '@/components/MonthCalendar';
import { Colors, withAlpha } from '@/constants/colors';
import { portal } from '@/data/specialistPortal';
import { Appointment, AppointmentStatus, KIND_LABEL } from '@/data/specialistTypes';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { calendarLinks } from '@/data/schedule';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const longDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export const statusStyle = (s: AppointmentStatus) =>
  ({
    pending: { label: 'Pending', color: Colors.attention },
    confirmed: { label: 'Confirmed', color: Colors.ok },
    completed: { label: 'Completed', color: Colors.textSecondary },
    cancelled: { label: 'Cancelled', color: Colors.danger },
  })[s];

const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

// B. Agenda: calendario (semana / mes) arriba y la lista de citas del día abajo.
export const ProAgendaScreen = () => {
  const router = useRouter();
  const wide = useIsWide();
  const [view, setView] = useState<'week' | 'month'>('week');
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(toDayKey(new Date()));
  const [appts, setAppts] = useDeepState<Appointment[]>([]);
  const [requests, setRequests] = useDeepState<Appointment[]>([]);
  const [openCal, setOpenCal] = useState<string | null>(null);

  const load = useCallback(async () => {
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 20);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 12);
    const [list, reqs] = await Promise.all([portal.listAppointments(from.toISOString(), to.toISOString()), portal.pendingRequests()]);
    setAppts(list);
    setRequests(reqs);
  }, [month, setAppts, setRequests]);
  useReloadOnFocus(load);

  const byDay = useMemo(() => {
    const out: Record<string, Appointment[]> = {};
    for (const a of appts) (out[toDayKey(new Date(a.startsAt))] ??= []).push(a);
    return out;
  }, [appts]);

  const marks = useMemo(() => {
    const out: Record<string, { color: string }[]> = {};
    for (const [k, list] of Object.entries(byDay)) out[k] = list.filter((a) => a.status !== 'cancelled').slice(0, 3).map(() => ({ color: Colors.accent }));
    return out;
  }, [byDay]);

  const weekStart = startOfWeek(new Date(`${selected}T12:00:00`));
  const week = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i));
  const dayList = (byDay[selected] ?? []).filter((a) => a.status !== 'cancelled');
  const pendingCount = requests.length;

  const confirm = async (a: Appointment) => {
    await portal.updateAppointment(a.id, { status: 'confirmed' });
    load();
  };
  const decline = async (a: Appointment) => {
    await portal.updateAppointment(a.id, { status: 'cancelled' });
    load();
  };

  // Enlaces para añadir la cita a Google Calendar / Outlook del especialista.
  const calFor = (a: Appointment) => {
    const start = new Date(a.startsAt);
    const end = new Date(start.getTime() + a.durationMin * 60000);
    const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return calendarLinks({
      id: a.id,
      type: 'lab',
      date: toDayKey(start),
      start: hm(start),
      end: hm(end),
      title: `${KIND_LABEL[a.kind]} - ${a.patientName} (${a.modality === 'video' ? 'video' : 'call'})`,
      detail: `HomeTest consultation${a.reason ? `: ${a.reason}` : ''}. Open the HomeTest portal to start it.`,
    });
  };

  const fmt = (iso: string, withDay = true) =>
    new Date(iso).toLocaleString('en-GB', withDay ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const requestsBlock =
    requests.length > 0 ? (
      <View style={styles.requests}>
        <Text style={styles.reqTitle}>Requests · {requests.length}</Text>
        <Text style={styles.reqSub}>Oldest first. Approve or decline each one.</Text>
        {requests.map((a, i) => (
          <View key={a.id} style={styles.reqItem}>
            <Text style={styles.reqNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{a.patientName}</Text>
              <Text style={styles.metaText}>
                {fmt(a.startsAt)} · {KIND_LABEL[a.kind]} · {a.modality === 'video' ? 'Video' : 'Call'}
              </Text>
              {a.reason ? <Text style={styles.reason}>{`"${a.reason}"`}</Text> : null}
              {a.createdAt ? <Text style={styles.requested}>Requested {fmt(a.createdAt, false)}</Text> : null}
              <View style={[styles.actions, { marginTop: 8 }]}>
                <TouchableOpacity style={styles.btn} onPress={() => confirm(a)}>
                  <Ionicons name="checkmark" size={16} color={Colors.background} />
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGhost} onPress={() => decline(a)}>
                  <Ionicons name="close" size={16} color={Colors.danger} />
                  <Text style={[styles.btnGhostText, { color: Colors.danger }]}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGhost} onPress={() => router.push({ pathname: '/pro-patient', params: { id: a.patientId } })}>
                  <Text style={styles.btnGhostText}>Patient</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>
    ) : null;

  const calendar = (
    <View style={styles.card}>
      <View style={styles.toggleRow}>
        {(['week', 'month'] as const).map((v) => (
          <TouchableOpacity key={v} style={[styles.toggle, view === v && styles.toggleOn]} onPress={() => setView(v)}>
            <Text style={[styles.toggleText, view === v && { color: Colors.background }]}>{v === 'week' ? 'Week' : 'Month'}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => { const t = new Date(); setSelected(toDayKey(t)); setMonth(t); }}>
          <Text style={styles.today}>Today</Text>
        </TouchableOpacity>
      </View>

      {view === 'month' ? (
        <MonthCalendar month={month} onMonthChange={setMonth} marks={marks} selectedDay={selected} onDayPress={setSelected} />
      ) : (
        <>
          <View style={styles.weekNav}>
            <TouchableOpacity onPress={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setSelected(toDayKey(d)); setMonth(d); }} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.weekTitle}>
              {week[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {week[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </Text>
            <TouchableOpacity onPress={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setSelected(toDayKey(d)); setMonth(d); }} hitSlop={10}>
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekRow}>
            {week.map((d) => {
              const key = toDayKey(d);
              const n = (byDay[key] ?? []).filter((a) => a.status !== 'cancelled').length;
              const on = key === selected;
              return (
                <TouchableOpacity key={key} style={[styles.weekDay, on && styles.weekDayOn]} onPress={() => setSelected(key)}>
                  <Text style={[styles.weekDow, on && { color: Colors.background }]}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}</Text>
                  <Text style={[styles.weekNum, on && { color: Colors.background }]}>{d.getDate()}</Text>
                  <Text style={[styles.weekCount, on && { color: Colors.background }]}>{n ? `${n}` : '·'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );

  const list = (
    <View style={{ flex: 1 }}>
      {requestsBlock}
      <Text style={styles.dayTitle}>{longDay(selected)}</Text>
      {dayList.length === 0 && <Text style={styles.empty}>No consultations this day.</Text>}
      {dayList.map((a) => {
        const st = statusStyle(a.status);
        return (
          <View key={a.id} style={styles.item}>
            <View style={styles.itemTop}>
              <Text style={styles.itemTime}>{time(a.startsAt)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{a.patientName}</Text>
                <View style={styles.meta}>
                  <Text style={styles.metaText}>{KIND_LABEL[a.kind]}</Text>
                  <Ionicons name={a.modality === 'video' ? 'videocam-outline' : 'call-outline'} size={13} color={Colors.textSecondary} />
                  <Text style={styles.metaText}>{a.modality === 'video' ? 'Video' : 'Call'} · {a.durationMin}′</Text>
                </View>
                {a.reason ? <Text style={styles.reason}>“{a.reason}”</Text> : null}
              </View>
              <Text style={[styles.status, { color: st.color, borderColor: st.color }]}>{st.label}</Text>
            </View>
            <View style={styles.actions}>
              {a.status === 'pending' && (
                <TouchableOpacity style={styles.btnGhost} onPress={() => confirm(a)}>
                  <Ionicons name="checkmark" size={16} color={Colors.accent} />
                  <Text style={styles.btnGhostText}>Confirm</Text>
                </TouchableOpacity>
              )}
              {a.status !== 'completed' && (
                <TouchableOpacity style={styles.btn} onPress={() => router.push({ pathname: '/pro-room', params: { appt: a.id, patient: a.patientId } })}>
                  <Ionicons name={a.modality === 'video' ? 'videocam' : 'call'} size={16} color={Colors.background} />
                  <Text style={styles.btnText}>Start consultation</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.btnGhost} onPress={() => router.push({ pathname: '/pro-patient', params: { id: a.patientId } })}>
                <Ionicons name="document-text-outline" size={16} color={Colors.accent} />
                <Text style={styles.btnGhostText}>View history</Text>
              </TouchableOpacity>
              {a.status === 'confirmed' && (
                <TouchableOpacity style={styles.btnGhost} onPress={() => setOpenCal(openCal === a.id ? null : a.id)}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.accent} />
                  <Text style={styles.btnGhostText}>Add to calendar</Text>
                </TouchableOpacity>
              )}
            </View>
            {openCal === a.id && (
              <View style={styles.actions}>
                {(['google', 'outlook'] as const).map((k) => (
                  <TouchableOpacity key={k} style={styles.btnGhost} onPress={() => Linking.openURL(calFor(a)[k])}>
                    <Ionicons name={k === 'google' ? 'logo-google' : 'logo-microsoft'} size={14} color={Colors.accent} />
                    <Text style={styles.btnGhostText}>{k === 'google' ? 'Google' : 'Outlook'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <ProLayout
      active="agenda"
      title="Agenda"
      badge={{ agenda: pendingCount }}
      right={pendingCount ? <Text style={styles.pending}>{pendingCount} to confirm</Text> : null}
    >
      {wide ? (
        <View style={styles.wideRow}>
          <View style={{ width: 380 }}>{calendar}</View>
          {list}
        </View>
      ) : (
        <>
          {calendar}
          {list}
        </>
      )}
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  wideRow: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 12, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  toggle: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  toggleOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  toggleText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  today: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  weekTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  weekRow: { flexDirection: 'row', gap: 4 },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: Colors.background },
  weekDayOn: { backgroundColor: Colors.accent },
  weekDow: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  weekNum: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginVertical: 2 },
  weekCount: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  dayTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  empty: { color: Colors.textSecondary, fontSize: 14 },
  item: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12 },
  itemTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  itemTime: { color: Colors.textPrimary, fontSize: 16, fontWeight: '900', width: 52 },
  itemName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  metaText: { color: Colors.textSecondary, fontSize: 12 },
  reason: { color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  status: { fontSize: 11, fontWeight: '800', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.accent, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  btnGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.5), borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  btnGhostText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  pending: { color: Colors.attention, fontSize: 13, fontWeight: '800' },
  requests: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.attention, borderRadius: 16, padding: 14, marginBottom: 16, gap: 10 },
  reqTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  reqSub: { color: Colors.textSecondary, fontSize: 12, marginTop: -6 },
  reqItem: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 10 },
  reqNum: { color: Colors.attention, fontSize: 16, fontWeight: '900', width: 18 },
  requested: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
});
