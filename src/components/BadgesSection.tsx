import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Achievement, TIER_COLORS } from '@/data/achievements';
import { t } from '@/i18n';
import { BadgeModal } from './badges/BadgeModal';
import { GlowRing, ringTones } from './GlowRing';
import { FINE, fine, ff } from '@/theme/fine';

const SIZE = 66;
// El dibujo a línea (como el resto de iconos de la app nueva) si existe; si no, el de siempre
const lineIcon = (name: string) => (`${name}-outline` in Ionicons.glyphMap ? `${name}-outline` : name) as keyof typeof Ionicons.glyphMap;

// «Insignias y rachas»: una por logro, con su nivel (bronce → diamante) y lo que falta para el siguiente. Con los
// mismos aros cometa con luz que los círculos de Hoy (fundador, 2026-11-16: «los badges están un poco pobres, no
// se han adaptado a que las circunferencias carguen así, modo brillante»): el aro se llena hasta el siguiente
// nivel con el color del nivel que tienes; sin ninguno, apagado. Tocar una la abre a pantalla completa.
export const BadgesSection = ({ achievements }: { achievements: Achievement[] }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = achievements.find((a) => a.id === selectedId) ?? null;
  const earned = achievements.filter((a) => a.level > 0).length;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {achievements.map((a) => {
          const on = a.level > 0;
          const color = on && a.tier ? TIER_COLORS[a.tier] : FINE.mute;
          // Todos los niveles: el aro entero; si no, lo que falta para el siguiente
          const progress = a.nextThreshold === null ? 1 : a.progressToNext;
          return (
            <TouchableOpacity
              key={a.id}
              style={styles.badge}
              onPress={() => setSelectedId(a.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${a.title}: ${a.tier ? t(a.tier) : t('Locked')}`}
            >
              <GlowRing progress={progress} colors={ringTones(color)} size={SIZE} stroke={4}>
                <Ionicons name={lineIcon(a.icon)} size={22} color={on ? color : FINE.mute} style={!on && { opacity: 0.7 }} />
              </GlowRing>
              <Text style={[styles.badgeTitle, !on && { color: FINE.mute }]} numberOfLines={2}>
                {a.title}
              </Text>
              <Text style={[styles.badgeTier, { color: on ? color : FINE.mute }]}>{a.tier ? t(a.tier) : t('Locked')}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={[fine.note, styles.summary]}>
        {t('{n} of {total} unlocked · tap a badge to see it full screen and share it', { n: earned, total: achievements.length })}
      </Text>

      <BadgeModal achievement={selected} onClose={() => setSelectedId(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  summary: { paddingHorizontal: 20 },
  row: { paddingHorizontal: 20, gap: 12, paddingTop: 4 },
  badge: { width: 80, alignItems: 'center' },
  badgeTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 11.5, lineHeight: 15, marginTop: 7, textAlign: 'center' },
  badgeTier: { ...ff('regular'), fontSize: 10.5, marginTop: 1 },
});
