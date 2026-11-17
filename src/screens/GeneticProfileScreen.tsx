import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { Chev, FRow, Tag } from '@/components/fine/Fine';
import { FLink } from '@/components/fine/FineForm';
import { SecRow } from '@/components/fine/FineMeasure';
import { LineEmblem } from '@/components/fine/LineEmblem';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { familyHistoryStore } from '@/data/familyHistoryStore';
import { LEVEL_TEXT } from '@/logic/genetics';
import { FamilyHistoryDraft, FamilyHistoryRecord } from '@/types/familyHistory';
import { FINE, ff, fine } from '@/theme/fine';

// "Your genetic profile": de momento, "Know your roots" (antecedentes familiares) y un hueco para
// los resultados genéticos, que llegarán más adelante (p. ej. variantes en BRCA2). No inventamos
// resultados.
// Desde el 2026-11-17, en el lenguaje fino (src/theme/fine.ts), como «Conoce tus raíces»: sin tarjetas ni iconos en
// círculos de color. La doble hélice a línea junto a la entrada, cada parte con su cabecera pequeña de sección, el
// nivel con su etiqueta con borde (oro si conviene consultarlo) y las acciones en jade.
export const GeneticProfileScreen = () => {
  const router = useRouter();
  const [record, setRecord] = useDeepState<FamilyHistoryRecord | null>(null);
  const [draft, setDraft] = useDeepState<FamilyHistoryDraft | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [r, d] = await Promise.all([familyHistoryStore.getRecord(), familyHistoryStore.getDraft()]);
    setRecord(r);
    setDraft(d && d.stepKey !== 'intro' ? d : null);
    setLoaded(true);
  }, [setRecord, setDraft]);
  useReloadOnFocus(load);

  const level = record?.level;
  const concern = level === 'moderate' || level === 'high';
  const toCounsellor = () => router.push({ pathname: '/professionals', params: { role: 'geneticist' } });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your genetic profile')} showBack />

        <View style={styles.body}>
          {/* Un solo dibujo a línea, la doble hélice (antes, un icono sobre un círculo de oro relleno) */}
          <View style={styles.hero}>
            <LineEmblem icon="dna" size={44} />
            <Text style={styles.heroText}>
              {t('What runs in your family, and later what your genes say. Everything here is private to you.')}
            </Text>
          </View>

          {/* «Conoce tus raíces»: el (i) va en la cabecera, fuera de la fila que se pulsa (un botón no va dentro de otro) */}
          <SecRow title={t('Know your roots')} right={<InfoButton topic="family_history" size={17} color={FINE.mute} />} />
          <TouchableOpacity
            style={styles.roots}
            activeOpacity={0.7}
            accessibilityRole="button"
            onPress={() => router.push(record && !draft ? { pathname: '/know-your-roots', params: { view: 'result' } } : '/know-your-roots')}
          >
            <View style={styles.flex}>
              {!loaded ? null : draft ? (
                <>
                  <Text style={styles.p}>{t('You started it. Your answers are saved: continue at the same question.')}</Text>
                  <Text style={styles.cta}>{t('Continue')} ›</Text>
                </>
              ) : record && level ? (
                <>
                  <View style={styles.tagRow}>
                    <Tag
                      gold={concern}
                      label={level === 'population' ? t('Population risk') : level === 'low' ? t('Low risk') : level === 'moderate' ? t('Moderate risk') : t('High risk')}
                    />
                  </View>
                  <Text style={fine.rowTitle}>{LEVEL_TEXT[level].title}</Text>
                  <Text style={fine.rowSub}>
                    {t('Answered {date} · tap to see what to tell your doctor', {
                      date: new Date(record.completedAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }),
                    })}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.p}>
                    {t('The questions a genetic counsellor asks at a first visit: cancer and heart disease in your family. You find out whether it is worth talking to a professional, and what to tell them.')}
                  </Text>
                  <Text style={fine.rowSub}>{t('About 4–6 minutes · saved as you go')}</Text>
                  <Text style={styles.cta}>{t('Start')} ›</Text>
                </>
              )}
            </View>
            {loaded && record && level && !draft ? <Chev /> : null}
          </TouchableOpacity>
          {record && !draft && (
            <FLink label={t('Update my answers')} onPress={() => router.push({ pathname: '/know-your-roots', params: { edit: '1' } })} style={styles.update} />
          )}

          {/* Lo que llegará: la cabecera con su etiqueta apagada y el texto debajo, sin tarjeta */}
          <SecRow
            title={t('Your genetic results')}
            right={
              <View style={styles.soonTag}>
                <Text style={styles.soonText}>{t('Coming later')}</Text>
              </View>
            }
          />
          <Text style={styles.soon}>
            {t('When you do a genetic test with us, its results will appear here, explained in plain words and reviewed by a professional.')}
          </Text>

          <FRow title={t('Talk to a genetic counsellor')} onPress={toCounsellor} style={styles.pro} />

          <Text style={styles.privacy}>
            {t('Family history and genetic data are special-category health data. Only you see them, unless you choose to share them with a professional.')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroText: { flex: 1, ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20 },
  // La fila de «Conoce tus raíces», con su línea fina debajo
  roots: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 50, borderBottomWidth: 1, borderBottomColor: FINE.line },
  p: { ...ff('regular'), color: '#CFD6CF', fontSize: 14, lineHeight: 20 },
  cta: { ...ff('regular'), color: FINE.jade, fontSize: 14, marginTop: 8 },
  tagRow: { flexDirection: 'row', marginBottom: 8 },
  update: { alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 40 },
  soonTag: { ...fine.tag, borderColor: FINE.line },
  soonText: { ...fine.tagText, color: FINE.mute },
  soon: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, lineHeight: 19 },
  pro: { marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.line },
  privacy: { ...fine.note, marginTop: 18 },
});
