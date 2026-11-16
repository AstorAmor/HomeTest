import React, { useCallback, useMemo, useState } from 'react';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { startTour } from '@/components/tour/tourStore';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useFirstName } from '@/components/UserAvatar';
import { SpecialistCarousel } from '@/components/SpecialistCarousel';
import { Chev, FRow, SecHead, TabHead } from '@/components/fine/Fine';
import { LEARNING_TOPICS } from '@/data/learning';
import { useAuth } from '@/context/AuthContext';
import { useSections } from '@/data/appPrefs';
import { getMyAccess, tierName, type Access } from '@/data/access';
import { useHistorial } from '@/hooks/useHistorial';
import { historialSummary } from '@/logic/historial';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { FINE, fine } from '@/theme/fine';
import { t } from '@/i18n';

// Pestaña Tú (antes Más; 2026-11-16, borradores/app-estructura/ESPECIFICACION.md §6). Arriba, quién eres y tu
// suscripción; debajo, por grupos: tu ficha (perfil, alergias, grupo, vacunas, historia clínica, tarjeta de
// emergencia y perfil genético), compartir, conexiones, aprende (el carrusel que estaba en Hoy) y ajustes.
// Entrenamientos y Menús se fueron a Plan; seguir tus pruebas, a Análisis. Con el lenguaje fino del prototipo
// (src/theme/fine.ts): filas con línea, sin iconos de color.

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  to?: Href;
}

const SHARING: MenuItem[] = [
  { id: 'professionals', title: 'Professionals', subtitle: 'Doctors, psychologists, dietitians, trainers and more', to: '/professionals' },
  { id: 'sharing', title: 'Sharing & privacy', subtitle: 'Choose what each professional can see, and revoke it anytime', to: '/sharing' },
];

const CONNECTIONS: MenuItem[] = [
  { id: 'wearables', title: 'Wearables', subtitle: 'Connect Huawei, Xiaomi, Garmin, Oura and more', to: '/wearables' },
  // Las notificaciones se ajustan aquí (ya no hay aviso en Hoy); también siguen en Ajustes
  { id: 'notifications', title: 'Notifications', subtitle: 'What we send you, and mute anything you do not want', to: '/notifications' },
];

const SETTINGS: MenuItem[] = [
  // Lo que ves en la app: el tutorial lo señala aquí
  { id: 'experience', title: 'Configure my experience', subtitle: 'What you use Kuova for sets what you see and which options appear', to: '/app-sections' },
  { id: 'settings', title: 'Settings', subtitle: 'Language, text size, permissions and notifications', to: '/settings' },
  { id: 'evidence', title: 'How KUOVA works', subtitle: 'How we calculate things, and the studies and guidelines behind them', to: '/evidence' },
  { id: 'tutorial', title: 'Tutorial', subtitle: 'A quick tour of the main parts of the app' },
  { id: 'catalog', title: 'Biomarker Catalog', subtitle: '118 biomarkers, canonical knowledge base (dev)', to: '/catalogo' },
];

// Solo para administradores de Kuova
const ADMIN_ITEMS: MenuItem[] = [
  { id: 'admin', title: 'Professionals review', subtitle: 'Verify professionals and approve their rates (admin)', to: '/admin' },
  { id: 'admin-plans', title: 'Subscriptions (admin)', subtitle: 'What each level includes, invitation codes and who has access', to: '/admin-plans' },
];

// Solo para cuentas de Soporte KUOVA
const SUPPORT_ITEMS: MenuItem[] = [
  { id: 'support', title: 'Support access', subtitle: 'Users who gave support permission. Every access is recorded with its reason', to: '/support' },
];

export const MoreScreen = () => {
  const { isAdmin, isSupportAgent } = useAuth();
  const router = useRouter();
  const tourScroll = useMemo(makeTourScroll, []);
  const show = useSections();
  const firstName = useFirstName();
  const { h } = useHistorial();
  const [access, setAccess] = useState<Access | null>(null);
  useReloadOnFocus(
    useCallback(async () => {
      setAccess(await getMyAccess().catch(() => null));
    }, []),
  );

  const open = (item: MenuItem) => {
    if (item.id === 'tutorial') return startTour();
    if (item.to) router.push(item.to);
  };

  const rows = (items: MenuItem[]) =>
    items.map((item, i) => (
      <TourTarget key={item.id} id={`more.${item.id}`} scroll={tourScroll}>
        <FRow title={t(item.title)} sub={item.subtitle ? t(item.subtitle) : undefined} onPress={() => open(item)} last={i === items.length - 1} />
      </TourTarget>
    ));

  const paid = access && access.tier !== 'free';
  // Tu ficha: las partes del historial con su valor a la derecha (si no la has quitado en Configura tu experiencia)
  const s = h && show('history') ? historialSummary(h) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          {/* Quién eres y tu suscripción (el próximo análisis llega en la fase 3) */}
          <TabHead
            title={firstName || t('You')}
            lead={!access ? t('My subscription') : paid ? t('Subscription {tier}', { tier: tierName(access.tier) }) : t('Free account')}
          />
          <TourTarget id="more.subscription" scroll={tourScroll}>
            <TouchableOpacity style={styles.subLine} onPress={() => router.push('/subscription')} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.subLineText}>{paid ? t('My subscription') : t('Subscribe')}</Text>
              <Chev />
            </TouchableOpacity>
          </TourTarget>

          <SecHead title={t('Your record')} />
          <TourTarget id="more.profile" scroll={tourScroll}>
            <FRow title={t('My Profile')} sub={t('View and edit details')} onPress={() => router.push('/profile')} />
          </TourTarget>
          {s && (
            <>
              <FRow title={t('Allergies')} value={s.allergies} onPress={() => router.push('/historial-alergias')} />
              <FRow title={t('Blood group')} value={s.bloodGroup} onPress={() => router.push('/historial-grupo')} />
              <FRow title={t('Vaccines')} value={String(s.vaccineCount)} onPress={() => router.push('/historial-vacunas')} />
              <FRow title={t('Medical history')} value={s.events} onPress={() => router.push('/historial-lista')} />
            </>
          )}
          <TourTarget id="more.emergency" scroll={tourScroll}>
            <FRow title={t('My emergency card')} sub={t('With a QR code')} onPress={() => router.push('/emergency-card' as Href)} />
          </TourTarget>
          <TourTarget id="more.genetics" scroll={tourScroll}>
            <FRow title={t('Your genetic profile')} sub={t('Know your roots: what runs in your family')} onPress={() => router.push('/genetic-profile')} last />
          </TourTarget>

          <SecHead title={t('Sharing')} />
          {rows(SHARING)}

          <SecHead title={t('Connections')} />
          {rows(CONNECTIONS)}
        </View>

        {show('learning') && (
          <>
            <SecHead title={t('Learn')} style={styles.padM} />
            <TourTarget id="you.learning" scroll={tourScroll}>
              <SpecialistCarousel
                loop
                items={LEARNING_TOPICS.filter((x) => x.featured)}
                onSelect={(x) => router.push({ pathname: '/learn', params: { topic: x.id } })}
                more={{ label: t('More'), subtitle: t('All topics'), onPress: () => router.push('/learn-all') }}
              />
            </TourTarget>
          </>
        )}

        <View style={styles.pad}>
          <SecHead title={t('Settings')} />
          {rows([...SETTINGS, ...(isAdmin ? ADMIN_ITEMS : []), ...(isSupportAgent ? SUPPORT_ITEMS : [])])}
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
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  padM: { marginHorizontal: 20 },
  // La línea jade de debajo del nombre (como «Próximo análisis · 26 mar» del prototipo)
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    minHeight: 44,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: FINE.line,
  },
  subLineText: { ...fine.link, flex: 1 },
});
