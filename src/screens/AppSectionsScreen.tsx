import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionToggles } from '@/components/SectionToggles';
import { SecHead } from '@/components/fine/Fine';
import { FineMark } from '@/components/fine/FineMeasure';
import { appPrefs, isSectionVisible, PURPOSE_OPTIONS, SECTION_OPTIONS, useAppPrefs } from '@/data/appPrefs';
import { t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Tú → Configure my experience: para qué usa Kuova (una o varias cosas; aplica una configuración
// de secciones), qué partes ve y, desde cada una, su guía con vista previa. El fundador pidió
// (2026-10-30) que quede claro que esa respuesta define la experiencia: qué partes, tarjetas,
// opciones y avisos salen; por eso el aviso de arriba y el recuento que cambia al elegir.
// Desde el 2026-11-16, como «Tu experiencia» del prototipo: cada respuesta, una opción con borde fino (jade
// la elegida) y su marca redonda; las partes, en filas con línea fina y su interruptor. Sin el icono de cada
// respuesta desde el 2026-11-17 (el fundador, en Ajustes: «de repente tengo mil iconos»).
export const AppSectionsScreen = () => {
  const router = useRouter();
  const prefs = useAppPrefs();
  const shown = SECTION_OPTIONS.filter((o) => isSectionVisible(prefs, o.id)).length;
  const count = { n: shown, total: SECTION_OPTIONS.length };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Configure my experience')} showBack backFallback="/settings" />

        <View style={styles.body}>
          <SecHead title={t('What do you use Kuova for?')} style={styles.firstSec} />
          <Text style={styles.explain}>
            {t(
              'Your answer shapes your experience: it decides which parts, cards and options appear in Today, Plan, Analysis and the rest of the app, and which reminders you get. Pick one or more.',
            )}
          </Text>
          {PURPOSE_OPTIONS.map((o) => {
            const selected = prefs.purposes.includes(o.id);
            return (
              <TouchableOpacity
                key={o.id}
                style={[styles.purpose, selected && styles.purposeSelected]}
                onPress={() =>
                  appPrefs.setPurposes(selected ? prefs.purposes.filter((p) => p !== o.id) : [...prefs.purposes, o.id])
                }
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <View style={styles.flex}>
                  <Text style={fine.rowTitle}>{t(o.title)}</Text>
                  <Text style={fine.rowSub}>{t(o.subtitle)}</Text>
                </View>
                <FineMark on={selected} />
              </TouchableOpacity>
            );
          })}
          <Text style={styles.summary}>
            {prefs.purposes.length
              ? t('With your answer you see {n} of {total} parts of the app.', count)
              : t('No answer yet: you see {n} of {total} parts of the app.', count)}
          </Text>

          <SecHead title={t('What you see')} more={t('How each part works')} onMore={() => router.push('/feature-guide')} />
          <Text style={styles.hint}>
            {t('This comes from your answer above. Turn each part on or off as you like; if you change your answer, this list is set again.')}
          </Text>
          <SectionToggles isOn={(id) => isSectionVisible(prefs, id)} onToggle={(id, on) => appPrefs.setSectionVisible(id, on)} />
          <Text style={fine.note}>{t('Your results, tests, sharing and professionals are always there.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1 },
  firstSec: { marginTop: 8 },
  explain: { ...fine.note, marginTop: 0, marginBottom: 4 },
  // Cada respuesta, una opción con borde fino (prototipo, `.opt`); la elegida, con el borde en jade
  purpose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    minHeight: 64,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FINE.line,
    backgroundColor: FINE.tile,
  },
  purposeSelected: { borderColor: FINE.jade },
  summary: { ...ff('regular'), color: FINE.ivory, fontSize: 13, lineHeight: 18, marginTop: 12 },
  hint: { ...fine.note, marginTop: 0, marginBottom: 4 },
});
