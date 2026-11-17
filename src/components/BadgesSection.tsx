import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Achievement } from '@/data/achievements';
import { t } from '@/i18n';
import { BadgeModal } from './badges/BadgeModal';
import { BadgeEmblem, badgeTone } from './badges/BadgeEmblem';
import { FINE, ff } from '@/theme/fine';
import { holdTabsProps } from '@/constants/tabs';

// «Insignias y rachas»: una por logro, con su nivel (bronce → diamante) y lo que falta para el siguiente. Con los
// mismos aros cometa con luz que los círculos de Hoy (fundador, 2026-11-16: «los badges están un poco pobres, no
// se han adaptado a que las circunferencias carguen así, modo brillante»): el aro se llena hasta el siguiente
// nivel con el color del nivel que tienes; sin ninguno, apagado. Tocar una la abre a pantalla completa, con el mismo
// emblema en grande (BadgeEmblem: el mismo dibujo y el mismo color en las dos).
export const BadgesSection = ({ achievements }: { achievements: Achievement[] }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = achievements.find((a) => a.id === selectedId) ?? null;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} {...holdTabsProps}>
        {achievements.map((a) => {
          const on = a.level > 0;
          const color = badgeTone(a);
          return (
            <TouchableOpacity
              key={a.id}
              style={styles.badge}
              onPress={() => setSelectedId(a.id)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${a.title}: ${a.tier ? t(a.tier) : t('Locked')}`}
            >
              <BadgeEmblem achievement={a} />
              <Text style={[styles.badgeTitle, !on && { color: FINE.mute }]} numberOfLines={2}>
                {a.title}
              </Text>
              {/* Sin conseguir, nada debajo (fundador, 2026-11-17: en lugar de «Bloqueada», que no aparezca nada); el
                  lector de pantalla sí lo dice */}
              {a.tier ? <Text style={[styles.badgeTier, { color: on ? color : FINE.mute }]}>{t(a.tier)}</Text> : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {/* Sin la línea «N de M desbloqueadas · toca…» (fundador, 2026-11-17: «no pongas nada de 1 de 7 desbloqueadas ni
          de toca para ver»): las insignias se explican solas */}

      <BadgeModal achievement={selected} onClose={() => setSelectedId(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 12, paddingTop: 4 },
  badge: { width: 80, alignItems: 'center' },
  badgeTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 11.5, lineHeight: 15, marginTop: 7, textAlign: 'center' },
  badgeTier: { ...ff('regular'), fontSize: 10.5, marginTop: 1 },
});
