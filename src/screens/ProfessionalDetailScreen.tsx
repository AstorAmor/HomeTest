import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Colors, withAlpha } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { mockProfessionals, ROLE_INFO } from '@/data/servicesMock';
import { listVerifiedProfessionals, roleLabel } from '@/data/sharing';
import { consult, isRealProfessional, ProCapabilities } from '@/data/consultations';
import { t } from '@/i18n';
import { formatPrice } from '@/data/testCatalog';

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
    rating: m.rating,
    reviews: m.reviews,
    online: m.online,
    photoUrl: null,
    city: 'Madrid',
    real: false,
  };
}

// Ficha de un especialista para el paciente: videoconsulta, solicitud y chat
// (el chat solo si el especialista lo tiene habilitado).
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
        <ScreenHeader title={t('Specialist')} showBack />
      </SafeAreaView>
    );
  }

  const params = { pro: pro.id, name: pro.name };
  const openChat = async () => {
    const conv = await consult.conversationWith(pro.id, user?.nombre ?? t('Patient'));
    router.push({ pathname: '/chat', params: { conversation: conv, title: pro.name, side: 'patient' } });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={pro.roleTitle} showBack />

        <View style={styles.hero}>
          {pro.photoUrl ? (
            <Image source={{ uri: pro.photoUrl }} style={styles.photo} contentFit="cover" />
          ) : (
            <Avatar nombre={pro.name.replace(/^Dra?\.\s*/, '')} size={84} />
          )}
          <Text style={styles.name}>{pro.name}</Text>
          <Text style={styles.specialty}>{pro.specialty}</Text>
          {pro.real && (
            <View style={styles.verified}>
              <Ionicons name="shield-checkmark" size={13} color={Colors.ok} />
              <Text style={styles.verifiedText}>{t('Verified by Kuova')}</Text>
            </View>
          )}
          <View style={styles.statsRow}>
            {pro.rating !== null && <Stat icon="star" color={Colors.amber} value={pro.rating.toFixed(1)} label={`${pro.reviews} reviews`} />}
            <Stat icon="cash-outline" color={Colors.accent} value={pro.price ? formatPrice(pro.price) : '—'} label={`${pro.minutes} min`} />
            <Stat icon={pro.online ? 'videocam-outline' : 'location-outline'} color={Colors.violet} value={pro.online ? t('Online') : t('In person')} label={pro.city || t('Spain')} />
          </View>
        </View>

        {pro.bio ? (
          <>
            <Text style={styles.sectionTitle}>{t('About')}</Text>
            <Text style={styles.bio}>{pro.bio}</Text>
          </>
        ) : null}
        {pro.languages.length > 0 && <Text style={styles.languages}>Speaks {pro.languages.join(' and ')}</Text>}

        <Text style={styles.sectionTitle}>{t('How can {name} help you?', { name: pro.name.split(' ').slice(0, 2).join(' ') })}</Text>
        <View style={styles.actions}>
          {caps.video && (
            <Action
              icon="videocam"
              title={t('Book a video consultation')}
              sub={`${pro.minutes} min · ${pro.price ? formatPrice(pro.price) : t('price on request')} · ${t('pick a free slot')}`}
              primary
              onPress={() => router.push({ pathname: '/consult-book', params })}
            />
          )}
          {caps.requests && (
            <Action icon="paper-plane-outline" title={t('Send a request')} sub={t('A question or a results review, answered in the app')} onPress={() => router.push({ pathname: '/consult-request', params })} />
          )}
          {caps.chat ? (
            <Action icon="chatbubbles-outline" title={t('Chat')} sub={t('Message them directly')} onPress={openChat} />
          ) : (
            <View style={styles.chatOff}>
              <Ionicons name="chatbubbles-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.chatOffText}>{t("This specialist doesn't offer chat. Use a request instead.")}</Text>
            </View>
          )}
        </View>
        {!pro.real && <Text style={styles.proto}>{t('Example specialist: bookings and messages stay on your phone.')}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const Action = ({ icon, title, sub, onPress, primary }: { icon: string; title: string; sub: string; onPress: () => void; primary?: boolean }) => (
  <TouchableOpacity style={[styles.action, primary && styles.actionPrimary]} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.actionIcon, primary && { backgroundColor: withAlpha(Colors.background, 0.2) }]}>
      <Ionicons name={icon as any} size={20} color={primary ? Colors.background : Colors.accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.actionTitle, primary && { color: Colors.background }]}>{title}</Text>
      <Text style={[styles.actionSub, primary && { color: Colors.background, opacity: 0.85 }]}>{sub}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={primary ? Colors.background : Colors.textMuted} />
  </TouchableOpacity>
);

const Stat = ({ icon, color, value, label }: { icon: string; color: string; value: string; label: string }) => (
  <View style={styles.stat}>
    <Ionicons name={icon as any} size={18} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  hero: { alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  photo: { width: 84, height: 84, borderRadius: 42 },
  name: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 12 },
  specialty: { color: Colors.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  verifiedText: { color: Colors.ok, fontSize: 12, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignSelf: 'stretch', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, paddingVertical: 14, marginTop: 18 },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 8, marginTop: 8 },
  bio: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, paddingHorizontal: 20 },
  languages: { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 20, marginTop: 6, marginBottom: 16 },
  actions: { paddingHorizontal: 20, gap: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14 },
  actionPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  actionSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  chatOff: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  chatOffText: { color: Colors.textMuted, fontSize: 12, flex: 1 },
  proto: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 16, paddingHorizontal: 30 },
});
