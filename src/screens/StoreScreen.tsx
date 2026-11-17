import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SecHead } from '@/components/fine/Fine';
import { FChip } from '@/components/fine/FineForm';
import { CATALOG, categoryIntro, categoryLabel, CatalogTest, localizeTest, PLANS, TestCategory } from '@/data/testCatalog';
import { TestCard } from '@/components/TestCard';
import { getMySubscription, listMyPaidProducts } from '@/data/orders';
import { t as tr } from '@/i18n';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { FINE, fine } from '@/theme/fine';

// Los niveles del catálogo, en el orden en que se piensan: lo que va con tu seguimiento, confirmar un
// resultado, objetivos concretos y lo que pida un médico
const GROUPS: TestCategory[] = ['followup', 'confirm', 'hormonal', 'digestive', 'sexual', 'other', 'genetic', 'doctor'];
const FILTERS: (TestCategory | 'all')[] = ['all', ...GROUPS];

// Tienda de pruebas: las suscripciones arriba y el catálogo agrupado por nivel, cada grupo con una línea
// que dice cuándo tiene sentido. "Pedir" lleva a /checkout (Revolut cuando esté configurado; si no, o si
// la prueba no tiene precio decidido, una solicitud simulada). Lo pagado se lee de la tabla orders.
// ?view=tests = catálogo de pruebas sin las suscripciones (desde "My subscription").
// ?category=genetic (u otro grupo) = abre con ese filtro, y ?open=<id> con esa ficha abierta (desde Aprende y
// Conoce tus raíces, junto con view=tests).
// En el lenguaje fino (src/theme/fine.ts) desde el 2026-11-17: las suscripciones en tarjetas casi transparentes con
// borde de oro, los filtros en chips con borde y cada grupo con su cabecera pequeña en versalitas y sus pruebas en
// filas con una línea fina (TestCard).
export const StoreScreen = () => {
  const router = useRouter();
  const { view, category, open } = useLocalSearchParams<{ view?: string; category?: string; open?: string }>();
  const testsOnly = view === 'tests';
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [filter, setFilter] = useState<TestCategory | 'all'>(GROUPS.includes(category as TestCategory) ? (category as TestCategory) : 'all');
  const [openId, setOpenId] = useState<string | null>(open ?? null);
  const [paid, setPaid] = useState<Set<string>>(new Set());

  useReloadOnFocus(
    useCallback(async () => {
      setPaid(new Set(await listMyPaidProducts()));
      setCurrentPlan((await getMySubscription())?.productId ?? null);
    }, []),
  );

  // Funciones y no componentes: un componente definido aquí dentro se montaría de nuevo en cada render
  const card = (t: CatalogTest, featured?: boolean) => (
    <TestCard
      key={t.id}
      test={t}
      featured={featured}
      open={openId === t.id}
      onToggle={() => setOpenId(openId === t.id ? null : t.id)}
      isPaid={paid.has(t.id)}
      isCurrent={t.perYear && currentPlan === t.id}
      hasPlan={!!currentPlan}
      onOrder={() => router.push({ pathname: '/checkout', params: { id: t.id } })}
    />
  );

  const group = (category: TestCategory, title: boolean) => {
    const intro = categoryIntro(category);
    return (
      <View key={category}>
        {title ? <SecHead title={categoryLabel(category)} /> : null}
        {!!intro && <Text style={[styles.intro, !title && styles.introAlone]}>{intro}</Text>}
        {CATALOG.filter((p) => p.category === category).map((p) => card(localizeTest(p)))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={testsOnly ? tr('Test catalogue') : tr('Tests & panels')} showBack />

        {!testsOnly && (
          <View style={styles.pad}>
            <SecHead title={tr('Subscriptions')} style={styles.firstSec} />
            {PLANS.filter((p) => !(currentPlan === 'premium' && p.id === 'membership')).map((p) => card(localizeTest(p), true))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={!testsOnly && styles.filtersGap}>
          {FILTERS.map((f) => (
            <FChip key={f} label={f === 'all' ? tr('All') : categoryLabel(f)} on={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>

        <View style={styles.pad}>
          {filter === 'all' ? GROUPS.map((g) => group(g, true)) : group(filter, false)}

          <Text style={styles.footnote}>
            {tr('Prices for individual tests are still to be confirmed. Payments are processed by Revolut; until they are switched on, ordering is simulated and nothing is charged.')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  pad: { paddingHorizontal: 20 },
  firstSec: { marginTop: 4, marginBottom: 12 },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 2 },
  filtersGap: { marginTop: 12 },
  // Cuándo tiene sentido cada grupo: nota apagada bajo su cabecera
  intro: { ...fine.note, marginTop: 0, marginBottom: 4 },
  introAlone: { marginTop: 16 },
  footnote: { ...fine.note, fontSize: 11.5, lineHeight: 16, color: FINE.mute, marginTop: 24 },
});
