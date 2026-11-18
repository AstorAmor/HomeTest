import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FeaturePreview } from '@/components/FeaturePreview';
import { SecHead } from '@/components/fine/Fine';
import { FLink } from '@/components/fine/FineForm';
import { measureStyles } from '@/components/fine/FineMeasure';
import { SwitchRow, settingsStyles } from '@/components/settings/SettingsParts';
import { AppSection, appPrefs, isSectionVisible, SECTION_OPTIONS, useAppPrefs } from '@/data/appPrefs';
import { FEATURE_GUIDE } from '@/data/featureGuide';
import { t } from '@/i18n';
import { FINE, fine } from '@/theme/fine';

// Guía de cada parte de la app: para qué sirve, qué haces tú, qué recibes, qué avisos manda y
// una vista previa. ?id=<sección> abre una; sin id, todas.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: sin tarjetas ni iconos; con todas, cada parte con su cabecera
// pequeña; cada bloque con su etiqueta en mayúsculas apagada, el interruptor en una fila con línea fina y «Cómo lo
// calculamos» como enlace en jade.
export const FeatureGuideScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const prefs = useAppPrefs();
  const one = SECTION_OPTIONS.find((o) => o.id === params.id);
  const list = one ? [one] : SECTION_OPTIONS;

  const block = (label: string, text: string) => (
    <View style={styles.block}>
      <Text style={fine.kicker}>{t(label)}</Text>
      <Text style={measureStyles.p}>{t(text)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={one ? t(one.title) : t('How each part works')} showBack backFallback="/app-sections" />
        <View style={settingsStyles.body}>
          {list.map((o, i) => {
            const g = FEATURE_GUIDE[o.id as AppSection];
            const on = isSectionVisible(prefs, o.id);
            return (
              <View key={o.id} style={styles.part}>
                {!one && <SecHead title={t(o.title)} style={i === 0 ? settingsStyles.firstSec : undefined} />}
                <FeaturePreview section={o.id} />
                {block('What it is for', g.what)}
                {block('What you do', g.youDo)}
                {block('What you get', g.youGet)}
                {g.notifications && block('Notifications', `${t(g.notifications)} ${t('You can mute any of them.')}`)}
                <SwitchRow
                  title={on ? t('On in your app') : t('Off in your app')}
                  value={on}
                  onValueChange={(v) => appPrefs.setSectionVisible(o.id, v)}
                  style={styles.switchRow}
                  last={!g.evidenceTopic}
                />
                {g.evidenceTopic && (
                  <FLink
                    label={t('How we calculate it')}
                    onPress={() => router.push({ pathname: '/evidence', params: { topic: g.evidenceTopic! } })}
                    style={settingsStyles.linkLeft}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  part: { gap: 12 },
  block: { gap: 3 },
  // El interruptor, con una línea fina encima
  switchRow: { borderTopWidth: 1, borderTopColor: FINE.line },
});
