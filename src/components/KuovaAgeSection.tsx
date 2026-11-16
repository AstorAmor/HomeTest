// Edad KUOVA en Análisis (antes, lo primero de Mis datos; 2026-11-16): la cifra de la última analítica completa
// o, sin ella, lo que falta (cobertura de los 9). Sin la insignia grande: la cifra fina del prototipo.
import { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SecHead } from '@/components/fine/Fine';
import { FINE, ff, fine } from '@/theme/fine';
import { TourTarget } from '@/components/tour/TourTarget';
import type { TourScroll } from '@/components/tour/tourStore';
import { KuovaAgeDots, kuovaAgeLockedHint } from '@/components/KuovaAgeBadge';
import { KuovaAge, kuovaAge, kuovaAgeFromUploads, KuovaAgeResult, realChange } from '@/logic/kuovaAge';
import { labUploadRepository } from '@/data/labUploads';
import { profileRepository } from '@/data/profileRepository';
import { rememberKuovaAge } from '@/data/kuovaAgeCache';
import { baselineReport, currentReport } from '@/data/reportRepository';
import { showSamples } from '@/data/dataMode';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { num, t } from '@/i18n';

export function KuovaAgeSection({ tourScroll }: { tourScroll?: TourScroll }) {
  const router = useRouter();
  // Edad KUOVA de la cuenta real: con sus analíticas subidas y su fecha de nacimiento (o qué falta)
  const [kres, setKres] = useDeepState<KuovaAgeResult | null>(null);
  useReloadOnFocus(
    useCallback(async () => {
      const [uploads, prof] = await Promise.all([labUploadRepository.getAll().catch(() => []), profileRepository.get().catch(() => null)]);
      const age = kuovaAgeFromUploads(uploads, prof?.dateOfBirth);
      rememberKuovaAge(age);
      setKres(age);
    }, [setKres]),
  );
  const open = () => router.push('/biological-age');

  if (showSamples()) {
    if (!currentReport.summary.phenoage.available) return null;
    return (
      <TourTarget id="analysis.age" scroll={tourScroll}>
        <KuovaAgeHero
          sample
          k={kuovaAge(currentReport.summary.phenoage)}
          previous={baselineReport.summary.phenoage.available ? kuovaAge(baselineReport.summary.phenoage) : null}
          onPress={open}
        />
      </TourTarget>
    );
  }
  if (!kres) return null;
  if (kres.status === 'ok')
    return (
      <TourTarget id="analysis.age" scroll={tourScroll}>
        <KuovaAgeHero k={kres.k} previous={kres.previous} onPress={open} />
      </TourTarget>
    );
  // Cuenta real sin Edad KUOVA todavía: sin cifra, los 9 puntos de lo que hay y en pequeño qué falta (valores,
  // fecha de nacimiento…); al tocarla, el detalle con los 9
  return (
    <TourTarget id="analysis.age" scroll={tourScroll}>
      <View style={styles.wrap}>
        <SecHead title={t('Your KUOVA age')} />
        <TouchableOpacity onPress={open} activeOpacity={0.8}>
          <KuovaAgeDots c={kres.coverage} />
          <Text style={[fine.note, { marginTop: 10 }]}>{kuovaAgeLockedHint(kres)}</Text>
        </TouchableOpacity>
        {kres.status === 'missing' && (
          <TouchableOpacity onPress={() => router.push('/store')} hitSlop={8} style={{ marginTop: 8 }}>
            <Text style={fine.link}>{t('Get the full blood test')} ›</Text>
          </TouchableOpacity>
        )}
      </View>
    </TourTarget>
  );
}

// Como el prototipo: la cifra grande y ligera y, al lado, cuánto más joven (o mayor) y el cambio desde la
// analítica anterior solo si supera el margen. Al tocarla, el detalle.
const KuovaAgeHero = ({ k, previous, sample = false, onPress }: { k: KuovaAge; previous: KuovaAge | null; sample?: boolean; onPress: () => void }) => {
  const change = previous ? realChange(k, previous) : null;
  return (
    <View style={styles.wrap}>
      <SecHead title={sample ? `${t('Your KUOVA age')} · ${t('sample')}` : t('Your KUOVA age')} more={t('See what moves it')} onMore={onPress} />
      <TouchableOpacity style={styles.hero} onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
        <Text style={styles.age}>{num(k.age.toFixed(1))}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.diff, k.diff < 0 && { color: FINE.gold }]}>
            {t(k.diff >= 0 ? '{years} younger' : '{years} older', { years: t(Math.abs(k.diff) === 1 ? '{n} year' : '{n} years', { n: num(Math.abs(k.diff).toFixed(1)) }) })}
          </Text>
          <Text style={styles.meta}>
            {t('± {n} years', { n: num(k.margin.toFixed(1)) })}
            {previous
              ? ` · ${
                  change == null
                    ? t('no real change since your previous test')
                    : t('{n} since your previous test', { n: `${change > 0 ? '+' : '−'}${num(Math.abs(change).toFixed(1))}` })
                }`
              : ''}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  age: { ...fine.num, fontSize: 54, lineHeight: 60, letterSpacing: -1 },
  diff: { ...ff('regular'), color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  meta: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
});
