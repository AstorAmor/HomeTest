import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { CATALOG, CATEGORY_LABEL, CatalogTest, formatPrice, PLANS, TestCategory, testIcon } from '@/data/testCatalog';
import { listMyPaidProducts } from '@/data/orders';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const FILTERS: (TestCategory | 'all')[] = ['all', 'blood', 'hormonal', 'preventive', 'digestive', 'sexual', 'consultation'];

// Tienda de tests. "Order"/"Join" lleva a /checkout (Stripe cuando esté configurado;
// si no, pago simulado). Lo pagado se lee de la tabla orders (la escribe el webhook).
export const StoreScreen = () => {
  const router = useRouter();
  const [filter, setFilter] = useState<TestCategory | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [paid, setPaid] = useState<Set<string>>(new Set());

  useReloadOnFocus(
    useCallback(async () => {
      setPaid(new Set(await listMyPaidProducts()));
    }, []),
  );

  const list = filter === 'all' ? CATALOG : CATALOG.filter((t) => t.category === filter);

  const Card = ({ t, featured }: { t: CatalogTest; featured?: boolean }) => {
    const open = openId === t.id || featured;
    const isPaid = paid.has(t.id);
    return (
      <TouchableOpacity
        style={[styles.card, featured && styles.featured]}
        activeOpacity={0.9}
        onPress={() => !featured && setOpenId(openId === t.id ? null : t.id)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.catIcon, featured && { backgroundColor: 'rgba(240, 184, 77, 0.18)' }]}>
            <MaterialCommunityIcons name={testIcon(t) as any} size={18} color={featured ? Colors.amber : Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t.name}</Text>
            <Text style={styles.desc} numberOfLines={open ? undefined : 2}>
              {t.description}
            </Text>
          </View>
          <View style={styles.priceBox}>
            <Text style={styles.price}>{formatPrice(t.price)}</Text>
            {t.perYear && <Text style={styles.priceUnit}>/year</Text>}
          </View>
        </View>

        {open && (
          <View style={styles.details}>
            <Text style={styles.detailLabel}>What's included</Text>
            {t.includes.map((i) => (
              <View key={i} style={styles.includeRow}>
                <Ionicons name="checkmark" size={14} color={Colors.accent} />
                <Text style={styles.includeText}>{i}</Text>
              </View>
            ))}
            <View style={styles.metaRow}>
              <Ionicons name="flask-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.meta}>Sample: {t.sample}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.meta}>{t.delivery}</Text>
            </View>
            {t.discreet && (
              <View style={styles.metaRow}>
                <Ionicons name="lock-closed-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.meta}>Results only visible to you. Not shared unless you choose to.</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.order, isPaid && styles.orderDone]}
              disabled={isPaid && t.perYear}
              onPress={() => router.push({ pathname: '/checkout', params: { id: t.id } })}
            >
              <Text style={[styles.orderText, isPaid && { color: Colors.accent }]}>
                {isPaid && t.perYear
                  ? 'Active · thanks for being a member'
                  : `${t.perYear ? 'Join' : isPaid ? 'Order again' : 'Order'} · ${formatPrice(t.price)}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Tests & panels" showBack />

        {PLANS.map((p) => (
          <Card key={p.id} t={p} featured />
        ))}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} style={[styles.filter, filter === f && styles.filterOn]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>
                {f === 'all' ? 'All' : CATEGORY_LABEL[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {list.map((t) => (
          <Card key={t.id} t={t} />
        ))}

        <Text style={styles.footnote}>
          Prices include medical review of your results. Card payments are processed by Stripe; until payments are switched on, checkout is simulated and nothing is charged.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  featured: { borderColor: 'rgba(240, 184, 77, 0.55)', marginBottom: 16 },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  catIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentSoft, justifyContent: 'center', alignItems: 'center' },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  desc: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  price: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  priceUnit: { color: Colors.textMuted, fontSize: 11 },
  details: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.divider, gap: 6 },
  detailLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  includeText: { color: Colors.textPrimary, fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 4 },
  meta: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, flex: 1 },
  order: { backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 11, alignItems: 'center', marginTop: 8 },
  orderDone: { backgroundColor: Colors.accentSoft },
  orderText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  filters: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  filter: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  filterOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextOn: { color: Colors.background },
  footnote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', paddingHorizontal: 30, marginTop: 10 },
});
