import React, { useMemo } from 'react';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { startTour } from '@/components/tour/tourStore';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useSections } from '@/data/appPrefs';
import { useFeature } from '@/data/access';
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
  // Entrenamientos (plan y registro) y plan de comidas: van con «Plan personalizado» (fundador, 2026-11-05)
  {
    id: 'workouts',
    title: 'Workouts',
    subtitle: 'Your training plan and the log of what you do',
    iconFamily: 'ionicons',
    icon: 'barbell-outline',
  },
  {
    id: 'diet',
    title: 'Meal plan',
    subtitle: 'Your weekly menu, made from your data',
    iconFamily: 'ionicons',
    icon: 'restaurant-outline',
  },
  // Tarjeta de emergencia: lo que elijas del historial de Mis datos, con su QR
  {
    id: 'emergency',
    title: 'My emergency card',
    subtitle: 'What whoever helps you should know in an emergency, with a QR code',
    iconFamily: 'ionicons',
    icon: 'qr-code-outline',
  },
  // Lo que ves en la app (también en Ajustes): el tutorial lo señala aquí
  {
    id: 'experience',
    title: 'Configure my experience',
    subtitle: 'What you use Kuova for sets what you see and which options appear',
    iconFamily: 'ionicons',
    icon: 'options-outline',
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
  // Las notificaciones se ajustan aquí (ya no hay aviso en Hoy); también siguen en Settings
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'What we send you, and mute anything you do not want',
    iconFamily: 'ionicons',
    icon: 'notifications-outline',
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
  {
    id: 'tutorial',
    title: 'Tutorial',
    subtitle: 'A quick tour of the main parts of the app',
    iconFamily: 'ionicons',
    icon: 'school-outline',
  },
];

// Solo para administradores de Kuova
const ADMIN_ITEMS: MenuItem[] = [
  {
    id: 'admin',
    title: 'Professionals review',
    subtitle: 'Verify professionals and approve their rates (admin)',
    iconFamily: 'ionicons',
    icon: 'ribbon-outline',
  },
  {
    id: 'admin-plans',
    title: 'Subscriptions (admin)',
    subtitle: 'What each level includes, invitation codes and who has access',
    iconFamily: 'ionicons',
    icon: 'key-outline',
  },
];

// Solo para cuentas de Soporte KUOVA
const SUPPORT_ITEMS: MenuItem[] = [
  {
    id: 'support',
    title: 'Support access',
    subtitle: 'Users who gave support permission. Every access is recorded with its reason',
    iconFamily: 'ionicons',
    icon: 'help-buoy-outline',
  },
];

export const MoreScreen = () => {
  const { isAdmin, isSupportAgent } = useAuth();
  const router = useRouter();
  const tourScroll = useMemo(makeTourScroll, []);
  // Los de administración y soporte van justo antes de Settings
  const settingsAt = menuItems.findIndex((m) => m.id === 'settings');
  const extra = [...(isAdmin ? ADMIN_ITEMS : []), ...(isSupportAgent ? SUPPORT_ITEMS : [])];
  const show = useSections();
  // En modo gratis, Entrenamientos y Plan de comidas llevan candado (se abren con suscripción o código)
  const workoutsOk = useFeature('workouts');
  const dietOk = useFeature('diet_menu'); // DIET_FEATURE (sin cargar el catálogo de recetas aquí)
  const locked = (id: string) => (id === 'workouts' && workoutsOk === false) || (id === 'diet' && dietOk === false);
  const items = [...menuItems.slice(0, settingsAt), ...extra, ...menuItems.slice(settingsAt)].filter(
    (m) => !['workouts', 'diet'].includes(m.id) || show('plan'),
  );

  const handlePress = (id: string) => {
    if (id === 'settings') return router.push('/settings');
    if (id === 'emergency') return router.push('/emergency-card' as any);
    if (id === 'workouts') return router.push('/workouts');
    if (id === 'diet') return router.push('/diet');
    if (id === 'notifications') return router.push('/notifications');
    if (id === 'experience') return router.push('/app-sections');
    if (id === 'profile') return router.push('/profile');
    if (id === 'subscription') return router.push('/subscription');
    if (id === 'evidence') return router.push('/evidence');
    if (id === 'sharing') return router.push('/sharing');
    if (id === 'admin') return router.push('/admin');
    if (id === 'admin-plans') return router.push('/admin-plans');
    if (id === 'support') return router.push('/support');
    if (id === 'professionals') return router.push('/professionals');
    if (id === 'track') return router.push('/track-tests');
    if (id === 'catalog') return router.push('/catalogo');
    if (id === 'wearables') return router.push('/wearables');
    if (id === 'tutorial') return startTour();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('More')} />

        <View style={styles.list}>
          {items.map((item) => (
            <TourTarget key={item.id} id={`more.${item.id}`} scroll={tourScroll}>
            <TouchableOpacity
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
              {locked(item.id) ? (
                <Ionicons name="lock-closed-outline" size={19} color={Colors.gold} accessibilityLabel={t('Comes with a subscription')} />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
              )}
            </TouchableOpacity>
            </TourTarget>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // deja ver el fondo ambiental de las pestañas
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
