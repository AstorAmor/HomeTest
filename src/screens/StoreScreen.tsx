import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { CATALOG, categoryIntro, categoryLabel, CatalogTest, localizeTest, PLANS, TestCategory } from '@/data/testCatalog';
import { TestCard } from '@/components/TestCard';
import { getMySubscription, listMyPaidProducts } from '@/data/orders';
import { t as tr } from '@/i18n';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

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

  const Card = ({ t, featured }: { t: CatalogTest; featured?: boolean }) => (
    <TestCard
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

  const Group = ({ category, title }: { category: TestCategory; title: boolean }) => {
    const intro = categoryIntro(category);
    return (
      <View style={styles.group}>
        {title && <Text style={styles.groupTitle}>{categoryLabel(category)}</Text>}
        {!!intro && <Text style={styles.groupIntro}>{intro}</Text>}
        {CATALOG.filter((p) => p.category === category).map((p) => (
          <Card key={p.id} t={localizeTest(p)} />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={testsOnly ? tr('Test catalogue') : tr('Tests & panels')} showBack />

        {!testsOnly &&
          PLANS.filter((p) => !(currentPlan === 'premium' && p.id === 'membership')).map((p) => (
            <Card key={p.id} t={localizeTest(p)} featured />
          ))}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} style={[styles.filter, filter === f && styles.filterOn]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>
                {f === 'all' ? tr('All') : categoryLabel(f)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filter === 'all' ? GROUPS.map((g) => <Group key={g} category={g} title />) : <Group category={filter} title={false} />}

        <Text style={styles.footnote}>
          {tr('Prices for individual tests are still to be confirmed. Payments are processed by Revolut; until they are switched on, ordering is simulated and nothing is charged.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filter: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  filterOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextOn: { color: Colors.background },
  group: { marginBottom: 8 },
  groupTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginHorizontal: 20, marginTop: 10 },
  groupIntro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginHorizontal: 20, marginTop: 4, marginBottom: 10 },
  footnote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', paddingHorizontal: 30, marginTop: 10 },
});
