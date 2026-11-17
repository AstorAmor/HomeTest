import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { getLang, Lang, LANGUAGES, saveLanguage, t } from '@/i18n';
import { getTextSize, saveTextSize, TEXT_SIZES, TextSize } from '@/theme/textSize';
import { reloadKeepingPlace } from '@/theme/appearance';
import { SecHead } from '@/components/fine/Fine';
import { FMark, ON_BG } from '@/components/fine/FineForm';
import { settingsStyles } from '@/components/settings/SettingsParts';
import { FINE, ff, fine, INTER } from '@/theme/fine';

// Idioma y tamaño de letra: lo mismo en Settings de la app y en Ajustes del portal del médico.
// Cambiar cualquiera recarga la app con un fundido y vuelve a `returnTo`.
// Sin selector de apariencia desde el 2026-11-16: la app es solo oscura (DARK_ONLY en theme/appearance.ts).
// El selector sigue en components/AppearanceSwitch.tsx por si se vuelve a ofrecer el tema claro.
// `fine` (Ajustes de la app, 2026-11-17): en el lenguaje fino, con cabeceras pequeñas, filas con línea fina y la
// marca redonda a la derecha, y los tamaños en recuadros con borde; sin márgenes propios (los pone la pantalla).
// Sin `fine`, como antes (tarjetas): el portal de especialistas sigue con su aspecto.
export const PreferencesBlock = ({ returnTo, fine: isFine }: { returnTo: string; fine?: boolean }) => {
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

  if (isFine) {
    return (
      <>
        <SecHead title={t('Language')} style={settingsStyles.firstSec} />
        <View accessibilityRole="radiogroup">
          {LANGUAGES.map((l, i) => {
            const on = l.id === lang;
            return (
              <TouchableOpacity
                key={l.id}
                style={[fine.row, i === LANGUAGES.length - 1 && settingsStyles.noLine, !l.ready && fineStyles.off]}
                disabled={!l.ready}
                onPress={() => chooseLang(l.id)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !l.ready }}
              >
                <View style={fineStyles.flex}>
                  <Text style={fine.rowTitle}>{l.name}</Text>
                  {!l.ready && <Text style={fine.rowSub}>{t('Coming soon')}</Text>}
                </View>
                {l.ready && <FMark on={on} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <SecHead title={t('Text size')} />
        <View style={fineStyles.sizes} accessibilityRole="radiogroup">
          {TEXT_SIZES.map((s) => {
            const on = s.id === size;
            return (
              <TouchableOpacity
                key={s.id}
                style={[fineStyles.size, on && fineStyles.sizeOn]}
                onPress={() => chooseSize(s.id)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t(s.label)}
              >
                <Text style={[fineStyles.sizeSample, { fontSize: 15 * s.scale }, on && fineStyles.sizeTextOn]}>Aa</Text>
                <Text style={[fineStyles.sizeLabel, on && fineStyles.sizeTextOn]} numberOfLines={1}>
                  {t(s.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  }

  return (
    <>
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
              <Text style={[styles.sizeSample, { fontFamily: INTER.regular, fontSize: 15 * s.scale }, on && styles.sizeTextOn]}>Aa</Text>
              <Text style={[styles.sizeLabel, on && styles.sizeTextOn]}>{t(s.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};

// Las tarjetas de antes (portal de especialistas)
export const prefStyles = StyleSheet.create({
  section: { color: Colors.textSecondary, fontSize: 13, fontFamily: INTER.semibold, marginHorizontal: 20, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, overflow: 'hidden' },
});

const styles = StyleSheet.create({
  section: prefStyles.section,
  card: prefStyles.card,
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontFamily: INTER.medium },
  soon: { color: Colors.textMuted, fontSize: 12, fontFamily: INTER.medium },
  sizes: { flexDirection: 'row', gap: 8, marginHorizontal: 20 },
  size: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 14, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  sizeOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  sizeSample: { color: Colors.textPrimary, fontFamily: INTER.medium },
  sizeLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: INTER.medium },
  sizeTextOn: { color: Colors.background },
});

// En fino: los tamaños, en recuadros con borde fino; el elegido, con el borde en jade y el fondo apenas marcado
const fineStyles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  off: { opacity: 0.45 },
  sizes: { flexDirection: 'row', gap: 8, marginTop: 4 },
  size: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1, borderColor: FINE.line },
  sizeOn: { borderColor: FINE.jade, backgroundColor: ON_BG },
  sizeSample: { ...ff('regular'), color: FINE.mute },
  sizeLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  sizeTextOn: { color: FINE.ivory },
});
