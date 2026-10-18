import { t } from '@/i18n';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { directionsUrl, hoursLabel, LabCenter } from '@/data/labCenters';

// Lo que hay que saber de un centro: dirección, horario de extracciones, llamar, cómo llegar y cómo
// ir preparado. Igual en la ficha de la cita (/lab-appointment, con "Calendario") y en "Pedir cita"
// en cuanto eliges centro, antes de reservar.
export const LabCenterInfo = ({ center, title, calendarUrl }: { center: LabCenter; title?: boolean; calendarUrl?: string }) => {
  const tel = `tel:${center.phone.replace(/\s/g, '')}`;
  return (
    <View>
      {title && (
        <Text style={styles.title}>
          {center.network} · {center.name}
        </Text>
      )}
      <Text style={styles.address}>{center.address}</Text>
      <Text style={styles.muted}>{t('Blood draws: {hours}', { hours: hoursLabel(center) })}</Text>
      {center.notes && <Text style={styles.muted}>{t(center.notes)}</Text>}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(tel)} activeOpacity={0.85}>
          <View style={styles.actionIcon}>
            <Ionicons name="call-outline" size={20} color={Colors.accent} />
          </View>
          <Text style={styles.actionText}>{t('Phone the lab')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(directionsUrl(center))} activeOpacity={0.85}>
          <View style={styles.actionIcon}>
            <Ionicons name="navigate-outline" size={20} color={Colors.accent} />
          </View>
          <Text style={styles.actionText}>{t('Directions')}</Text>
        </TouchableOpacity>
        {calendarUrl && (
          <TouchableOpacity style={styles.action} onPress={() => Linking.openURL(calendarUrl)} activeOpacity={0.85}>
            <View style={styles.actionIcon}>
              <Ionicons name="calendar-outline" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.actionText}>{t('Calendar')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.phone}>{center.phone}</Text>

      <View style={styles.prepCard}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
        <Text style={styles.prepText}>
          {t('Bring your ID. For most blood tests, fast for 8 hours beforehand (water is fine) and avoid intense exercise the day before.')}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginHorizontal: 20 },
  address: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginHorizontal: 20, marginTop: 12 },
  muted: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginTop: 3 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 20, marginTop: 20 },
  action: { alignItems: 'center', gap: 6, width: 90 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: withAlpha(Colors.accent, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  phone: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  prepCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 18,
  },
  prepText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
});
