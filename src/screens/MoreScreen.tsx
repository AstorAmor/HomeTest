import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { t } from '@/i18n';


interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  iconFamily: 'ionicons' | 'material';
  icon: string;
  isProfile?: boolean;
}

// Orden pedido por el fundador: perfil y suscripción arriba; Settings (con apariencia, idioma,
// letra, permisos, Configure my experience y Notifications) y "How KUOVA works" al final.
const menuItems: MenuItem[] = [
  {
    id: 'profile',
    title: 'My Profile',
    subtitle: 'View and edit details',
    iconFamily: 'ionicons',
    icon: 'person-outline',
    isProfile: true,
  },
  {
    id: 'subscription',
    title: 'My subscription',
    subtitle: 'Your plan, renewal and next test',
    iconFamily: 'ionicons',
    icon: 'card-outline',
  },
  {
    id: 'professionals',
    title: 'Professionals',
    subtitle: 'Doctors, psychologists, dietitians, trainers and more',
    iconFamily: 'ionicons',
    icon: 'medkit-outline',
  },
  {
    id: 'sharing',
    title: 'Sharing & privacy',
    subtitle: 'Choose what each professional can see, and revoke it anytime',
    iconFamily: 'ionicons',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'track',
    title: 'Track your tests',
    subtitle: 'Shipping, logistics partner and result history',
    iconFamily: 'material',
    icon: 'van-utility',
  },
  {
    id: 'wearables',
    title: 'Wearables',
    subtitle: 'Connect Huawei, Xiaomi, Garmin, Oura and more',
    iconFamily: 'ionicons',
    icon: 'watch-outline',
  },
  {
    id: 'catalog',
    title: 'Biomarker Catalog',
    subtitle: '118 biomarkers, canonical knowledge base (dev)',
    iconFamily: 'ionicons',
    icon: 'library-outline',
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Appearance, language, text size, permissions and notifications',
    iconFamily: 'ionicons',
    icon: 'settings-outline',
  },
  {
    id: 'evidence',
    title: 'How KUOVA works',
    subtitle: 'How we calculate things, and the studies and guidelines behind them',
    iconFamily: 'ionicons',
    icon: 'information-circle-outline',
  },
];

// Solo para administradores de Kuova
const ADMIN_ITEM: MenuItem = {
  id: 'admin',
  title: 'Professionals review',
  subtitle: 'Verify professionals and approve their rates (admin)',
  iconFamily: 'ionicons',
  icon: 'ribbon-outline',
};

export const MoreScreen = () => {
  const { isAdmin } = useAuth();
  const router = useRouter();
  // El de administración va justo antes de Settings
  const settingsAt = menuItems.findIndex((m) => m.id === 'settings');
  const items = isAdmin ? [...menuItems.slice(0, settingsAt), ADMIN_ITEM, ...menuItems.slice(settingsAt)] : menuItems;

  const handlePress = (id: string) => {
    if (id === 'settings') return router.push('/settings');
    if (id === 'profile') return router.push('/profile');
    if (id === 'subscription') return router.push('/subscription');
    if (id === 'evidence') return router.push('/evidence');
    if (id === 'sharing') return router.push('/sharing');
    if (id === 'admin') return router.push('/admin');
    if (id === 'professionals') return router.push('/professionals');
    if (id === 'track') return router.push('/track-tests');
    if (id === 'catalog') return router.push('/catalogo');
    if (id === 'wearables') return router.push('/wearables');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('More')} />

        <View style={styles.list}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => handlePress(item.id)}
            >
              {item.isProfile ? (
                <UserAvatar size={52} />
              ) : (
                <View style={styles.iconWrap}>
                  {item.iconFamily === 'material' ? (
                    <MaterialCommunityIcons name={item.icon as any} size={26} color={Colors.accent} />
                  ) : (
                    <Ionicons name={item.icon as any} size={26} color={Colors.accent} />
                  )}
                </View>
              )}
              <View style={styles.textWrap}>
                <Text style={styles.itemTitle}>{t(item.title)}</Text>
                <Text style={styles.itemSubtitle}>{t(item.subtitle)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 32,
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  itemTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  itemSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
