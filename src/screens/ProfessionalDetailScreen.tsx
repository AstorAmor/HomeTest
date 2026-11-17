import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chev, SecHead } from '@/components/fine/Fine';
import { Monogram } from '@/components/fine/RoleEmblem';
import { useAuth } from '@/context/AuthContext';
import { mockProfessionals, ROLE_INFO } from '@/data/servicesMock';
import { listVerifiedProfessionals, roleLabel } from '@/data/sharing';
import { consult, isRealProfessional, ProCapabilities } from '@/data/consultations';
import { num, t } from '@/i18n';
import { formatPrice } from '@/data/testCatalog';
import { FINE, ff, fine } from '@/theme/fine';

interface ProView {
  id: string;
  name: string;
  roleTitle: string;
  specialty: string;
  bio: string;
  languages: string[];
  price: number | null;
  minutes: number;
  rating: number | null;
  reviews: number | null;
  online: boolean;
  photoUrl: string | null;
  city: string;
  real: boolean;
}

async function loadPro(id: string): Promise<ProView | null> {
  if (isRealProfessional(id)) {
    const p = (await listVerifiedProfessionals()).find((x) => x.id === id);
    if (!p) return null;
    return {
      id: p.id,
      name: p.displayName,
      roleTitle: roleLabel(p.role),
      specialty: p.specialty ?? roleLabel(p.role),
      bio: p.bio ?? '',
      languages: p.languages,
      price: p.hourlyRateEur,
      minutes: 30,
      rating: null,
      reviews: null,
      online: p.modalities.includes('online'),
      photoUrl: p.photoUrl,
      city: p.city ?? '',
      real: true,
    };
  }
  const m = mockProfessionals.find((p) => p.id === id) ?? mockProfessionals[0];
  return {
    id: m.id,
    name: m.name,
    roleTitle: ROLE_INFO[m.role].label.replace(/ves$/, 'fe').replace(/s$/, ''),
    specialty: m.specialty,
    bio: m.bio,
    languages: m.languages,
    price: m.pricePerSession,
    minutes: m.sessionMinutes,
    rating: m.rating || null, // 0 = aún sin valoraciones
    reviews: m.reviews || null,
    online: m.online,
    photoUrl: null,
    city: 'Madrid',
    real: false,
  };
}

// Ficha de un especialista para el paciente: videoconsulta, solicitud y chat
// (el chat solo si el especialista lo tiene habilitado).
// En la estética fina (fundador, 2026-11-16: lo de los especialistas «no alineado con la estética»): la inicial en un
// aro fino en lugar del círculo relleno, las cifras ligeras entre líneas finas sin iconos de color, la verificación
// como una marca a línea y las acciones en filas con su icono a línea (oro la consulta, que es de pago; jade el resto).
export const ProfessionalDetailScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pro, setPro] = useState<ProView | null>(null);
  const [caps, setCaps] = useState<ProCapabilities>({ video: true, requests: true, chat: false });

  useEffect(() => {
    loadPro(id).then(setPro).catch(() => setPro(null));
    consult.capabilities(id).then(setCaps).catch(() => undefined);
  }, [id]);

  if (!pro) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title={t('Specialist')} showBack backFallback="/professionals" />
      </SafeAreaView>
    );
  }

  const params = { pro: pro.id, name: pro.name };
  const openChat = async () => {
    const conv = await consult.conversationWith(pro.id, user?.nombre ?? t('Patient'));
    router.push({ pathname: '/chat', params: { conversation: conv, title: pro.name, side: 'patient' } });
  };

  // Las acciones que ofrece, en filas; la última sin línea debajo
  const actions: ActionProps[] = [
    ...(caps.video
      ? [
          {
            icon: 'videocam-outline',
            title: t('Book a video consultation'),
            sub: `${pro.minutes} min · ${pro.price ? formatPrice(pro.price) : t('price on request')} · ${t('pick a free slot')}`,
            gold: true,
            onPress: () => router.push({ pathname: '/consult-book', params }),
          },
        ]
      : []),
    ...(caps.requests
      ? [
          {
            icon: 'paper-plane-outline',
            title: t('Send a request'),
            sub: t('A question or a results review, answered in the app'),
            onPress: () => router.push({ pathname: '/consult-request', params }),
          },
        ]
      : []),
    ...(caps.chat ? [{ icon: 'chatbubbles-outline', title: t('Chat'), sub: t('Message them directly'), onPress: openChat }] : []),
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={pro.roleTitle} showBack />

        <View style={styles.pad}>
          <View style={styles.hero}>
            {pro.photoUrl ? <Image source={{ uri: pro.photoUrl }} style={styles.photo} contentFit="cover" /> : <Monogram name={pro.name} size={80} />}
            <Text style={styles.name} accessibilityRole="header">
              {pro.name}
            </Text>
            <Text style={styles.specialty}>{pro.specialty}</Text>
            {pro.real && (
              <View style={styles.verified}>
                <Ionicons name="shield-checkmark-outline" size={13} color={FINE.jade} />
                <Text style={styles.verifiedText}>{t('Verified by Kuova')}</Text>
              </View>
            )}
          </View>

          {/* Valoración, precio y modalidad: cifras ligeras entre dos líneas finas, sin iconos */}
          <View style={styles.stats}>
            {pro.rating !== null ? (
              <Stat value={num(pro.rating.toFixed(1))} label={pro.reviews ? t('{n} reviews', { n: pro.reviews }) : t('Rating')} />
            ) : (
              !pro.real && <Stat value="—" label={t('No reviews yet')} />
            )}
            <Stat value={pro.price ? formatPrice(pro.price) : '—'} label={`${pro.minutes} min`} />
            <Stat value={pro.online ? t('Online') : t('In person')} label={pro.city || t('Spain')} last />
          </View>

          {pro.bio ? (
            <>
              <SecHead title={t('About')} />
              <Text style={styles.bio}>{pro.bio}</Text>
            </>
          ) : null}
          {pro.languages.length > 0 && <Text style={fine.note}>{`${t('Languages')}: ${pro.languages.map((l) => t(l)).join(', ')}`}</Text>}

          <SecHead title={t('How can {name} help you?', { name: pro.name.split(' ').slice(0, 2).join(' ') })} />
          {actions.map((a, i) => (
            <Action key={a.title} {...a} last={i === actions.length - 1} />
          ))}
          {!caps.chat && (
            <View style={styles.chatOff}>
              <Ionicons name="chatbubbles-outline" size={15} color={FINE.mute} />
              <Text style={[fine.note, styles.chatOffText]}>{t("This specialist doesn't offer chat. Use a request instead.")}</Text>
            </View>
          )}
          {!pro.real && <Text style={[fine.note, styles.proto]}>{t('Example specialist: bookings and messages stay on your phone.')}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

type ActionProps = { icon: string; title: string; sub: string; onPress: () => void; gold?: boolean; last?: boolean };

// Una acción: su icono a línea en un aro fino (oro si es de pago), el título, la explicación y la flecha
const Action = ({ icon, title, sub, onPress, gold, last }: ActionProps) => {
  const c = gold ? FINE.gold : FINE.jade;
  return (
    <TouchableOpacity
      style={[fine.row, styles.action, last && styles.noLine]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
    >
      <View style={[styles.actionRing, { borderColor: gold ? FINE.goldLine : FINE.jadeLine }]}>
        <Ionicons name={icon as any} size={17} color={c} />
      </View>
      <View style={styles.flex}>
        <Text style={fine.rowTitle}>{title}</Text>
        <Text style={fine.rowSub}>{sub}</Text>
      </View>
      <Chev />
    </TouchableOpacity>
  );
};

const Stat = ({ value, label, last }: { value: string; label: string; last?: boolean }) => (
  <View style={[styles.stat, !last && styles.statLine]}>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  hero: { alignItems: 'center', paddingTop: 4, marginBottom: 20 },
  photo: { width: 80, height: 80, borderRadius: 40 },
  name: { ...ff('medium'), color: FINE.ivory, fontSize: 22, lineHeight: 28, letterSpacing: -0.2, marginTop: 14, textAlign: 'center' },
  specialty: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, marginTop: 3, textAlign: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  verifiedText: { ...ff('regular'), color: FINE.jade, fontSize: 12.5 },
  // Las tres cifras entre dos líneas finas, separadas por otra vertical
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: FINE.line, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  statLine: { borderRightWidth: 1, borderRightColor: FINE.line },
  statValue: { ...ff('light'), color: FINE.ivory, fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
  statLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  bio: { ...ff('regular'), color: FINE.ivory, fontSize: 14.5, lineHeight: 21 },
  action: { gap: 12, paddingVertical: 13 },
  actionRing: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noLine: { borderBottomWidth: 0 },
  chatOff: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  chatOffText: { flex: 1, marginTop: 0 },
  proto: { textAlign: 'center', marginTop: 22, paddingHorizontal: 10 },
});
