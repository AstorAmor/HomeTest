import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppearanceSwitch } from '@/components/AppearanceSwitch';
import { Colors } from '@/constants/colors';
import { getLang, Lang, LANGUAGES, saveLanguage, t } from '@/i18n';
import { getTextSize, saveTextSize, TEXT_SIZES, TextSize } from '@/theme/textSize';
import { reloadKeepingPlace } from '@/theme/appearance';

// Apariencia, idioma y tamaño de letra: lo mismo en Settings de la app y en Ajustes del portal del
// médico. Cambiar cualquiera recarga la app con un fundido y vuelve a `returnTo`.
export const PreferencesBlock = ({ returnTo }: { returnTo: string }) => {
  const [size, setSize] = useState<TextSize>('default');
  const lang = getLang();
  useEffect(() => {
    getTextSize().then(setSize);
  }, []);

  const chooseLang = async (id: Lang) => {
    if (id === lang) return;
    await saveLanguage(id);
    await reloadKeepingPlace(Colors.background, returnTo);
  };
  const chooseSize = async (id: TextSize) => {
    if (id === size) return;
    setSize(id);
    await saveTextSize(id);
    await reloadKeepingPlace(Colors.background, returnTo);
  };

  return (
    <>
      <Text style={styles.section}>{t('Appearance')}</Text>
      <View style={styles.block}>
        <AppearanceSwitch returnTo={returnTo} />
      </View>

      <Text style={styles.section}>{t('Language')}</Text>
      <View style={styles.card}>
        {LANGUAGES.map((l, i) => {
          const on = l.id === lang;
          return (
            <TouchableOpacity
              key={l.id}
              style={[styles.row, i > 0 && styles.divider, !l.ready && { opacity: 0.5 }]}
              disabled={!l.ready}
              onPress={() => chooseLang(l.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: !l.ready }}
            >
              <Text style={styles.rowTitle}>{l.name}</Text>
              {!l.ready && <Text style={styles.soon}>{t('Coming soon')}</Text>}
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? Colors.accent : Colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.section}>{t('Text size')}</Text>
      <View style={styles.sizes}>
        {TEXT_SIZES.map((s) => {
          const on = s.id === size;
          return (
            <TouchableOpacity key={s.id} style={[styles.size, on && styles.sizeOn]} onPress={() => chooseSize(s.id)}>
              <Text style={[styles.sizeSample, { fontSize: 15 * s.scale }, on && styles.sizeTextOn]}>Aa</Text>
              <Text style={[styles.sizeLabel, on && styles.sizeTextOn]}>{t(s.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};

export const prefStyles = StyleSheet.create({
  section: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginHorizontal: 20, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, overflow: 'hidden' },
});

const styles = StyleSheet.create({
  section: prefStyles.section,
  block: { marginHorizontal: 20 },
  card: prefStyles.card,
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  soon: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  sizes: { flexDirection: 'row', gap: 8, marginHorizontal: 20 },
  size: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  sizeOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sizeSample: { color: Colors.textPrimary, fontWeight: '800' },
  sizeLabel: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  sizeTextOn: { color: Colors.background },
});
