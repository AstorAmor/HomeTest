import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { Achievement, formatAchievementValue, TIER_COLORS } from '@/data/achievements';
import { t } from '@/i18n';

const SIZE = 64;

// "Your badges": una medalla por logro, con su nivel (bronce → platino) y el progreso
// hacia el siguiente. Tocar una medalla muestra el detalle debajo.
export const BadgesSection = ({ achievements }: { achievements: Achievement[] }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = achievements.find((a) => a.id === selectedId) ?? null;
  const earned = achievements.filter((a) => a.level > 0).length;

  return (
    <View>
      <Text style={styles.summary}>
        {t('{n} of {total} unlocked · tap a badge to see how to level it up', { n: earned, total: achievements.length })}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {achievements.map((a) => {
          const color = a.tier ? TIER_COLORS[a.tier] : Colors.cardBorder;
          const r = SIZE / 2 - 3;
          const c = 2 * Math.PI * r;
          return (
            <TouchableOpacity
              key={a.id}
              style={styles.badge}
              onPress={() => setSelectedId(selectedId === a.id ? null : a.id)}
              activeOpacity={0.8}
            >
              <View style={{ width: SIZE, height: SIZE }}>
                <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
                  <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={Colors.divider} strokeWidth={4} fill="none" />
                  {a.nextThreshold !== null && (
                    <Circle
                      cx={SIZE / 2}
                      cy={SIZE / 2}
                      r={r}
                      stroke={a.level > 0 ? color : Colors.textMuted}
                      strokeWidth={4}
                      fill="none"
                      strokeDasharray={`${a.progressToNext * c} ${c}`}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                    />
                  )}
                  {a.nextThreshold === null && (
                    <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={color} strokeWidth={4} fill="none" />
                  )}
                </Svg>
                <View style={[styles.medal, { backgroundColor: a.level > 0 ? `${color}30` : Colors.card }]}>
                  <Ionicons name={a.icon as any} size={24} color={a.level > 0 ? color : Colors.textMuted} />
                </View>
              </View>
              <Text style={[styles.badgeTitle, a.level === 0 && { color: Colors.textMuted }]} numberOfLines={1}>
                {a.title}
              </Text>
              <Text style={[styles.badgeTier, { color: a.level > 0 ? color : Colors.textMuted }]}>
                {a.tier ? t(a.tier) : t('Locked')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selected && (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>
            {selected.title}
            {selected.tier ? ` · ${t(selected.tier)}` : ''}
          </Text>
          <Text style={styles.detailText}>{selected.description}</Text>
          <Text style={styles.detailText}>
            {t('Now:')} <Text style={styles.detailStrong}>{formatAchievementValue(selected, selected.value)}</Text>
            {selected.nextThreshold !== null
              ? `  ·  ${t('Next level at {value}', { value: formatAchievementValue(selected, selected.nextThreshold) })}`
              : `  ·  ${t('Top level reached')}`}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  summary: { color: Colors.textSecondary, fontSize: 12, paddingHorizontal: 20, marginBottom: 10 },
  row: { paddingHorizontal: 20, gap: 14 },
  badge: { width: 78, alignItems: 'center' },
  medal: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: SIZE - 16,
    height: SIZE - 16,
    borderRadius: (SIZE - 16) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  badgeTier: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  detail: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    gap: 4,
  },
  detailTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  detailText: { color: Colors.textSecondary, fontSize: 13 },
  detailStrong: { color: Colors.textPrimary, fontWeight: '700' },
});
