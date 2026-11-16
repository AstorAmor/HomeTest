import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { useHistorial } from '@/hooks/useHistorial';
import { historialSummary } from '@/logic/historial';
import { userFlags } from '@/data/userFlags';
import { t } from '@/i18n';
import { INTER } from '@/theme/fine';

// «Tu historial» en Mis datos: alergias arriba (lo primero que necesita un profesional), grupo
// sanguíneo, vacunas e historia clínica (cirugías, ingresos, enfermedades…), y la tarjeta de emergencia
// que sale de ellos. Tocar el título lo pliega y lo despliega (fundador, 2026-11-06: antes «Ocultar» lo quitaba y había
// que volver a ponerlo en Configura tu experiencia); se recuerda en user_flags 'mydata_history_open'. Quitarlo del todo
// sigue en Configura tu experiencia (sección 'history'). La tarjeta de emergencia sigue en Más.
const OPEN_FLAG = 'mydata_history_open';

export function HistorialBlock() {
  const router = useRouter();
  const { h } = useHistorial();
  const [open, setOpen] = useState(true);
  useEffect(() => {
    userFlags
      .get(OPEN_FLAG)
      .then((v) => setOpen(v !== false))
      .catch(() => undefined);
  }, []);
  if (!h) return null;
  const toggle = () => {
    setOpen(!open);
    userFlags.set(OPEN_FLAG, !open).catch(() => undefined);
  };
  const s = historialSummary(h);
  const tile = (
    key: string,
    icon: React.ReactNode,
    label: string,
    value: string,
    sub: string,
    to: string | { pathname: string; params: Record<string, string> },
    wide = false,
  ) => (
    <TouchableOpacity key={key} style={[styles.tile, wide && styles.wide]} onPress={() => router.push(to as any)} activeOpacity={0.85}>
      <View style={styles.tileHead}>
        {icon}
        <Text style={styles.tileLabel}>{label}</Text>
        <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
      </View>
      <Text style={styles.tileValue} numberOfLines={2}>
        {value}
      </Text>
      {sub ? (
        <Text style={styles.tileSub} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.head, !open && styles.headClosed]}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={t('Your history')}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('Your history')}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
        </View>
        <Text style={styles.meta}>
          {open
            ? t('Allergies, blood group, vaccines and more. Tap one to add or change it.')
            : t('Allergies, blood group, vaccines and more. Tap to open it.')}
        </Text>
      </TouchableOpacity>
      {open && (
        <>
          <View style={styles.grid}>
            {tile('alg', <Ionicons name="alert-circle-outline" size={16} color={Colors.coral} />, t('Allergies'), s.allergies, '', '/historial-alergias', true)}
            {tile('bg', <Ionicons name="water-outline" size={16} color={Colors.coral} />, t('Blood group'), s.bloodGroup, '', '/historial-grupo')}
            {tile(
              'vac',
              <MaterialCommunityIcons name="needle" size={16} color={Colors.sky} />,
              t('Vaccines'),
              String(s.vaccineCount),
              s.vaccines,
              '/historial-vacunas',
            )}
            {tile(
              'his',
              <Ionicons name="document-text-outline" size={16} color={Colors.ok} />,
              t('Medical history'),
              s.events,
              s.eventNames,
              '/historial-lista',
              true,
            )}
          </View>
          <TouchableOpacity style={styles.card} onPress={() => router.push('/emergency-card' as any)} activeOpacity={0.85}>
            <View style={styles.cardIcon}>
              <Ionicons name="qr-code-outline" size={20} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t('My emergency card')}</Text>
              <Text style={styles.cardSub}>{t('What whoever helps you should know in an emergency, with a QR code')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  head: { paddingHorizontal: 20, marginBottom: 12, gap: 2 },
  title: { fontSize: 20, fontFamily: INTER.medium, color: Colors.textPrimary },
  headClosed: { marginBottom: 14 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    rowGap: 10,
  },
  tile: {
    width: '48.5%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  wide: { width: '100%' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: INTER.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tileValue: { color: Colors.textPrimary, fontSize: 16, fontFamily: INTER.medium },
  tileSub: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 12, lineHeight: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: withAlpha(Colors.gold, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(Colors.gold, 0.35),
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(Colors.gold, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 15, fontFamily: INTER.medium },
  cardSub: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 12, marginTop: 2 },
});
