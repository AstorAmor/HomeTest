import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { CATALOG, categoryLabel, CatalogTest, localizeTest, PLANS, TestCategory } from '@/data/testCatalog';
import { TestCard } from '@/components/TestCard';
import { getMySubscription, listMyPaidProducts } from '@/data/orders';
import { t as tr } from '@/i18n';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const FILTERS: (TestCategory | 'all')[] = ['all', 'blood', 'hormonal', 'preventive', 'digestive', 'sexual', 'consultation'];

// Tienda de tests. "Order"/"Join" lleva a /checkout (Revolut cuando esté configurado;
// si no, pago simulado). Lo pagado se lee de la tabla orders (la escribe el webhook).
// ?view=tests = catálogo de pruebas sin las suscripciones (desde "My subscription").
export const StoreScreen = () => {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const testsOnly = view === 'tests';
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [filter, setFilter] = useState<TestCategory | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [paid, setPaid] = useState<Set<string>>(new Set());

  useReloadOnFocus(
    useCallback(async () => {
      setPaid(new Set(await listMyPaidProducts()));
      setCurrentPlan((await getMySubscription())?.productId ?? null);
    }, []),
  );

  const list = (filter === 'all' ? CATALOG : CATALOG.filter((t) => t.category === filter)).map(localizeTest);

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

        {list.map((t) => (
          <Card key={t.id} t={t} />
        ))}

        <Text style={styles.footnote}>
          {tr('Prices include medical review of your results. Payments are processed by Revolut; until they are switched on, checkout is simulated and nothing is charged.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filter: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  filterOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextOn: { color: Colors.background },
  footnote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', paddingHorizontal: 30, marginTop: 10 },
});
