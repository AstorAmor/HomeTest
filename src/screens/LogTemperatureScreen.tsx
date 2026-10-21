import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { WheelPicker } from '@/components/WheelPicker';
import { basalTemperatureRepository, thermometerRepository } from '@/data/temperatureRepository';
import { dayKey } from '@/data/bathroomRepository';
import { getLang, t } from '@/i18n';
import { logScreenStyles } from './LogBowelScreen';

// Ruedas, como el resto de mediciones: grados y centésimas de 5 en 5 (lo que da un termómetro basal
// de dos decimales). La basal va de 35 a 38 °C; con el termómetro, hasta 41 (fiebre).
const DEC = Array.from({ length: 20 }, (_, i) => String(i * 5).padStart(2, '0'));

// Temperatura basal: al despertar, antes de levantarse, siempre a la misma hora. Se parte de la
// última para que baste con mover un poco la rueda. Con ?mode=thermometer es una lectura suelta con
// el termómetro (cualquier hora, varias al día), que no se mezcla con la basal.
export const LogTemperatureScreen = () => {
  const router = useRouter();
  const thermometer = useLocalSearchParams<{ mode?: string }>().mode === 'thermometer';
  const minDeg = 35;
  const maxDeg = thermometer ? 41 : 38;
  const WHOLE = Array.from({ length: maxDeg - minDeg + 1 }, (_, i) => String(minDeg + i));
  const [whole, setWhole] = useState(1); // 36
  const [dec, setDec] = useState(10); // ,50
  const [wheelKey, setWheelKey] = useState(0); // recolocar las ruedas al cargar la última
  const [existingId, setExistingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const place = (v: number) => {
    const clamped = Math.min(maxDeg + 0.95, Math.max(minDeg, v));
    const w = Math.floor(clamped);
    setWhole(Math.min(WHOLE.length - 1, Math.max(0, w - minDeg)));
    setDec(Math.min(19, Math.round(((clamped - w) * 100) / 5)));
    setWheelKey((k) => k + 1);
  };

  useEffect(() => {
    if (thermometer) {
      thermometerRepository
        .getAll()
        .then((all) => place(all.length ? all.reduce((a, x) => (x.fecha > a.fecha ? x : a)).valor : 36.8))
        .catch(() => place(36.8));
      return;
    }
    basalTemperatureRepository.getAll().then((all) => {
      const today = all.find((x) => dayKey(new Date(x.fecha)) === dayKey(new Date()));
      if (today) {
        place(today.valor);
        setExistingId(today.id);
      } else if (all.length) {
        place(all.reduce((a, x) => (x.fecha > a.fecha ? x : a)).valor);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thermometer]);

  const value = Math.round((minDeg + whole + (dec * 5) / 100) * 100) / 100;

  const save = async () => {
    setSaving(true);
    try {
      if (thermometer) {
        const now = new Date().toISOString();
        await thermometerRepository.save({ id: `${Date.now()}`, valor: value, unidad: '°C', fecha: now, createdAt: now });
      } else if (existingId) await basalTemperatureRepository.update(existingId, { valor: value });
      else {
        const now = new Date().toISOString();
        await basalTemperatureRepository.save({ id: `${Date.now()}`, valor: value, unidad: '°C', fecha: now, createdAt: now });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()} accessibilityLabel={t('Close')}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, styles.circleButtonActive]} onPress={save} disabled={saving} accessibilityLabel={t('Save')}>
          <Ionicons name="checkmark" size={22} color={Colors.background} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="thermometer-outline" size={26} color={Colors.gold} />
          </View>
          <Text style={styles.title}>{thermometer ? t('Thermometer reading') : t('Morning temperature')}</Text>
          <Text style={styles.subtitle}>
            {thermometer
              ? t('Any time, for example when you feel unwell. It is saved with the time you take it.')
              : t('Take it as soon as you wake up, before getting out of bed, at about the same time each day.')}
          </Text>
        </View>

        <View style={styles.wheels} key={wheelKey}>
          <WheelPicker items={WHOLE} selectedIndex={whole} onChange={setWhole} width={84} />
          <Text style={styles.wheelComma}>{getLang() === 'en' ? '.' : ','}</Text>
          <WheelPicker items={DEC} selectedIndex={dec} onChange={setDec} width={70} />
          <Text style={styles.wheelUnit}>°C</Text>
        </View>

        <View style={styles.askCard}>
          <Text style={styles.askText}>
            {thermometer
              ? t('38 °C or more is a fever. Rest and drink fluids; see a doctor if it lasts more than 3 days, goes above 39.5 °C or comes with a stiff neck, a rash or trouble breathing.')
              : t('A digital basal thermometer (two decimals) works best. Illness, alcohol or a bad night can raise it: add a note in your check-in if so.')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  wheelComma: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800', marginHorizontal: 2 },
  wheelUnit: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700', marginLeft: 8 },
});
