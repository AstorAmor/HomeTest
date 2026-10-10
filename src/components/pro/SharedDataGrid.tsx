import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { SHARE_SCOPES } from '@/data/sharing';
import { SharedScope } from '@/data/specialistTypes';
import { t } from '@/i18n';

// "Qué comparte contigo": las 11 categorías que un paciente puede compartir. Las compartidas, con
// un resumen de un vistazo; las demás, con candado: el especialista sabe que existen pero no las ve
// (lo garantiza la base de datos, no la pantalla).
export const SharedDataGrid = ({ items, wide }: { items: SharedScope[]; wide?: boolean }) => {
  const shared = items.filter((i) => i.shared);
  const locked = items.filter((i) => !i.shared);
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.count}>{t('Shares {n} of {total} categories with you', { n: shared.length, total: items.length })}</Text>
      <View style={styles.grid}>
        {[...shared, ...locked].map((i) => {
          const sc = SHARE_SCOPES.find((s) => s.id === i.scope);
          return (
            <View key={i.scope} style={[styles.tile, wide ? styles.tileWide : styles.tileNarrow, !i.shared && styles.tileLocked]}>
              <View style={styles.tileHead}>
                <Ionicons name={(i.shared ? sc?.icon ?? 'document-outline' : 'lock-closed-outline') as any} size={16} color={i.shared ? Colors.accent : Colors.textMuted} />
                <Text style={[styles.tileTitle, !i.shared && { color: Colors.textMuted }]} numberOfLines={1}>
                  {t(sc?.label ?? i.scope)}
                </Text>
              </View>
              <Text style={[styles.tileBody, !i.shared && { color: Colors.textMuted }]} numberOfLines={3}>
                {i.shared ? i.summary || t('Shared with you') : t('Not shared')}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>
        {t('You only see what the patient decides to share, and only while the permission is active. They can withdraw it at any time.')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  count: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { backgroundColor: Colors.background, borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.3), borderRadius: 12, padding: 10, gap: 4 },
  tileWide: { width: '32%', minWidth: 200, flexGrow: 1 },
  tileNarrow: { width: '48%', flexGrow: 1 },
  tileLocked: { borderColor: Colors.cardBorder, borderStyle: 'dashed', backgroundColor: 'transparent' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', flexShrink: 1 },
  tileBody: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
});
