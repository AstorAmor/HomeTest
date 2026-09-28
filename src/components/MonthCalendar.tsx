import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

// Calendario mensual propio (funciona igual en Android, iOS y web). Sirve para:
// - marcar días con puntos de color (agenda de pruebas)
// - seleccionar un rango (inicio y fin del periodo)

export interface DayMark {
  color: string;
}

interface MonthCalendarProps {
  month: Date; // cualquier día del mes a mostrar
  onMonthChange: (month: Date) => void;
  marks?: Record<string, DayMark[]>; // YYYY-MM-DD -> puntos
  rangeStart?: string | null; // YYYY-MM-DD
  rangeEnd?: string | null;
  rangeColor?: string;
  selectedDay?: string | null;
  onDayPress?: (day: string) => void;
  maxDate?: string; // no se pueden elegir días posteriores
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const toDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const MonthCalendar = ({
  month,
  onMonthChange,
  marks = {},
  rangeStart,
  rangeEnd,
  rangeColor = Colors.pinkSoft,
  selectedDay,
  onDayPress,
  maxDate,
}: MonthCalendarProps) => {
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // lunes primero
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toDayKey(new Date(month.getFullYear(), month.getMonth(), d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const today = toDayKey(new Date());
  const shift = (n: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const inRange = (day: string) =>
    !!rangeStart && day >= rangeStart && day <= (rangeEnd ?? rangeStart);

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => shift(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.cell} />;
          const disabled = !!maxDate && day > maxDate;
          const ranged = inRange(day);
          const edge = day === rangeStart || day === (rangeEnd ?? rangeStart);
          const selected = selectedDay === day;
          return (
            <TouchableOpacity
              key={day}
              style={styles.cell}
              disabled={disabled || !onDayPress}
              onPress={() => onDayPress?.(day)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.dayCircle,
                  ranged && { backgroundColor: `${rangeColor}40` },
                  edge && { backgroundColor: rangeColor },
                  selected && styles.selected,
                  day === today && !edge && !selected && styles.today,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    disabled && styles.dayDisabled,
                    edge && { color: '#3A1128', fontWeight: '800' },
                    selected && { color: Colors.background, fontWeight: '800' },
                  ]}
                >
                  {Number(day.slice(8))}
                </Text>
              </View>
              <View style={styles.dots}>
                {(marks[day] ?? []).slice(0, 3).map((m, j) => (
                  <View key={j} style={[styles.dot, { backgroundColor: m.color }]} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  selected: { backgroundColor: Colors.accent },
  today: { borderWidth: 1, borderColor: Colors.accent },
  dayText: { color: Colors.textPrimary, fontSize: 14 },
  dayDisabled: { color: Colors.textMuted, opacity: 0.4 },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
