import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FLink } from '@/components/fine/FineForm';
import { measureStyles } from '@/components/fine/FineMeasure';
import { settingsStyles } from '@/components/settings/SettingsParts';
import { EVIDENCE, EvidenceBlock, EvidenceTopic } from '@/data/evidence';
import { READINESS_BANDS, READINESS_WEIGHTS, type ReadinessPart } from '@/wearables/seriesLogic';
import { t as tr } from '@/i18n';
import { TAB, tabHref } from '@/constants/tabs';
import { FINE, ff, fine } from '@/theme/fine';

// More → How KUOVA works, o el (i) de cada sitio (?topic=…): cómo calculamos cada cosa y las
// fuentes. Lo que aún revisa el equipo médico lo dice claramente.
// Desde el 2026-11-17, en el lenguaje fino (fundador: «cómo calculamos lo del readiness tampoco…»): sin tarjetas. Con
// un tema (?topic=…), la página de ese tema: su nombre, la frase de resumen y, debajo, sus párrafos o sus bloques con
// la etiqueta pequeña en mayúsculas apagada (como «Cómo funciona cada parte»). Con todos, una fila con línea fina por
// tema que se abre debajo. Las fuentes, en jade si llevan enlace; «En revisión por nuestro equipo médico», apagado.
export const EvidenceScreen = () => {
  const params = useLocalSearchParams<{ topic?: string }>();
  const [open, setOpen] = useState<Set<string>>(new Set(params.topic ? [params.topic] : []));
  const first = EVIDENCE.find((t) => t.id === params.topic);
  const [showAll, setShowAll] = useState(!first);
  const single = !!first && !showAll;
  const ordered = !first ? EVIDENCE : [first, ...EVIDENCE.filter((t) => t !== first)];

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Una fila por tema: el nombre y la frase; al tocarla se abre debajo (fuera del botón: dentro van enlaces)
  const renderRow = (t: EvidenceTopic) => {
    const isOpen = open.has(t.id);
    return (
      <View key={t.id} style={styles.topic}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => toggle(t.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={`${tr(t.title)}. ${tr(t.summary)}`}
        >
          <View style={styles.flex}>
            <Text style={fine.rowTitle}>{tr(t.title)}</Text>
            <Text style={fine.rowSub}>{tr(t.summary)}</Text>
          </View>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.openBody}>
            <TopicBody topic={t} />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={single ? tr('How we calculate it') : tr('How KUOVA works')} showBack backFallback={tabHref(TAB.you)} />
        <View style={settingsStyles.body}>
          {single && first ? (
            <>
              <Text style={styles.pageTitle} accessibilityRole="header">
                {tr(first.title)}
              </Text>
              <Text style={styles.pageLead}>{tr(first.summary)}</Text>
              <TopicBody topic={first} />
              <FLink label={tr('See how everything else works')} onPress={() => setShowAll(true)} style={[settingsStyles.linkLeft, styles.allLink]} />
            </>
          ) : (
            <>
              <Text style={styles.intro}>
                {tr('How we calculate what you see, and the studies and guidelines behind it. Look for the (i) next to a number or a suggestion to jump straight to its explanation.')}
              </Text>
              <View style={styles.list}>{ordered.map(renderRow)}</View>
            </>
          )}
          <Text style={styles.footer}>
            {tr('Kuova helps you understand your health and does not replace your doctor. If something worries you, talk to a professional.')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Lo de dentro de un tema: párrafos, bloques con su etiqueta, si está en revisión y las fuentes
function TopicBody({ topic: t }: { topic: EvidenceTopic }) {
  return (
    <View style={styles.body}>
      {t.body.map((p) => (
        <Text key={p} style={measureStyles.p}>
          {tr(p)}
        </Text>
      ))}
      {t.blocks?.map((b) => <Block key={b.label} block={b} />)}
      {t.status === 'pending' && <Text style={styles.pending}>{tr('Being reviewed by our medical team')}</Text>}
      {t.sources.length > 0 && (
        <View style={styles.sources}>
          <Text style={fine.kicker}>{tr('Sources')}</Text>
          {t.sources.map((s) =>
            s.url ? (
              <TouchableOpacity key={s.label} onPress={() => WebBrowser.openBrowserAsync(s.url!)} activeOpacity={0.7} accessibilityRole="link" style={styles.source}>
                <Text style={styles.sourceLink}>{tr(s.label)}</Text>
              </TouchableOpacity>
            ) : (
              <Text key={s.label} style={[styles.source, styles.sourceText]}>
                {tr(s.label)}
              </Text>
            ),
          )}
        </View>
      )}
    </View>
  );
}

// Un bloque: la etiqueta pequeña en mayúsculas, su dibujo si lo lleva y el texto
function Block({ block: b }: { block: EvidenceBlock }) {
  return (
    <View style={styles.block}>
      <Text style={fine.kicker}>{tr(b.label)}</Text>
      {b.figure === 'readinessWeights' && <ReadinessWeights />}
      {b.figure === 'readinessBands' && <ReadinessBands />}
      {b.text ? <Text style={measureStyles.p}>{tr(b.text)}</Text> : null}
    </View>
  );
}

// El peso de cada parte de «Tu estado de hoy»: su nombre, el porcentaje y una línea fina de ese largo, con los mismos
// números que usa la fórmula
const PARTS: [ReadinessPart, string][] = [
  ['sleep', 'Sleep'],
  ['hrv', 'HRV'],
  ['restingHr', 'Resting heart rate'],
];
function ReadinessWeights() {
  return (
    <View style={styles.figure}>
      {PARTS.map(([k, label]) => {
        const w = READINESS_WEIGHTS[k];
        return (
          <View key={k} style={styles.weight} accessible accessibilityLabel={`${tr(label)}: ${Math.round(w * 100)} %`}>
            <View style={styles.weightHead}>
              <Text style={styles.weightName}>{tr(label)}</Text>
              <Text style={styles.weightPct}>{Math.round(w * 100)} %</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${w * 100}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Desde qué cifra va cada frase de Hoy, en filas con línea fina
function ReadinessBands() {
  const rows: [string, string][] = [
    [`${READINESS_BANDS.ready}–100`, 'High'],
    [`${READINESS_BANDS.steady}–${READINESS_BANDS.ready - 1}`, 'Moderate'],
    [`0–${READINESS_BANDS.steady - 1}`, 'Low'],
  ];
  return (
    <View style={styles.figure}>
      {rows.map(([range, label], i) => (
        <View key={label} style={[styles.band, i === rows.length - 1 && styles.bandLast]}>
          <Text style={styles.bandRange}>{range}</Text>
          <Text style={styles.bandLabel}>{tr(label)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  intro: { ...fine.lead, fontSize: 13.5, lineHeight: 19, marginTop: 0, marginBottom: 6 },
  // Con un tema: su nombre y la frase de resumen, como cabecera de la página
  pageTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 20, lineHeight: 26, marginTop: 4 },
  pageLead: { ...fine.lead, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 6 },
  allLink: { marginTop: 18 },
  // Con todos: una fila por tema con línea fina; abierto, lo de dentro debajo, con su línea al final
  list: { borderTopWidth: 1, borderTopColor: FINE.line },
  topic: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minHeight: 56 },
  openBody: { paddingBottom: 18 },
  body: { gap: 14, marginTop: 8 },
  block: { gap: 5 },
  pending: { ...fine.note, marginTop: 0 },
  sources: { gap: 8 },
  source: { alignSelf: 'stretch' },
  sourceLink: { ...ff('regular'), color: FINE.jade, fontSize: 13, lineHeight: 18 },
  sourceText: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 18 },
  footer: { ...fine.note, fontSize: 11.5, lineHeight: 16, marginTop: 28 },
  // Los dibujos de «Tu estado de hoy»
  figure: { marginTop: 2, marginBottom: 4 },
  weight: { paddingVertical: 6 },
  weightHead: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  weightName: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14 },
  weightPct: { ...ff('regular'), color: FINE.mute, fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 2, borderRadius: 1, backgroundColor: FINE.line },
  fill: { height: 2, borderRadius: 1, backgroundColor: FINE.jade },
  band: { flexDirection: 'row', alignItems: 'baseline', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: FINE.line },
  bandLast: { borderBottomWidth: 0 },
  bandRange: { ...ff('regular'), width: 64, color: FINE.mute, fontSize: 13, fontVariant: ['tabular-nums'] },
  bandLabel: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14 },
});
