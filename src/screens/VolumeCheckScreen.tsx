import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { ClipPath, Defs, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Colors, withAlpha } from '@/constants/colors';
import { ChoiceChips } from '@/components/ChoiceChips';
import { WheelPicker } from '@/components/WheelPicker';
import { dayKey, entryForDay, noonOf, urineRepository } from '@/data/bathroomRepository';
import { dailyTotalNote } from '@/logic/bathroom';
import { UrineEntry, VOID_VOLUMES, VoidVolume } from '@/types/bathroom';
import { logScreenStyles } from './LogBowelScreen';
import { t } from '@/i18n';

// Volumen exacto en la rueda: de 50 a 1.000 ml de 10 en 10; el total de 24 h, de 300 a 5.000 de 50 en 50
const ML = Array.from({ length: 96 }, (_, i) => 50 + i * 10);
const DAY_ML = Array.from({ length: 95 }, (_, i) => 300 + i * 50);

// La cantidad aproximada que corresponde a unos ml exactos (para los avisos y las cuentas)
const nearestVolume = (ml: number): VoidVolume => (ml <= 180 ? 'quarter' : ml <= 310 ? 'half' : ml <= 440 ? 'three_quarters' : 'full');

// Vaso de precipitados graduado (hasta 600 ml) que se llena hasta lo elegido
const BEAKER_MAX = 600;
const Beaker = ({ ml }: { ml: number | null }) => {
  const top = 22;
  const bottom = 168;
  const y = (v: number) => bottom - (Math.min(v, BEAKER_MAX) / BEAKER_MAX) * (bottom - top);
  const ticks = Array.from({ length: 11 }, (_, i) => (i + 1) * 50);
  return (
    <Svg width={120} height={180} viewBox="0 0 120 180">
      <Defs>
        <ClipPath id="beakerInside">
          <Path d="M24 14 V160 Q24 170 34 170 H86 Q96 170 96 160 V14 Z" />
        </ClipPath>
      </Defs>
      {ml != null && (
        <Rect x={20} y={y(ml)} width={80} height={bottom + 4 - y(ml)} fill={withAlpha('#EDD35C', 0.55)} clipPath="url(#beakerInside)" />
      )}
      {/* Contorno con el pico arriba a la izquierda */}
      <Path
        d="M16 10 L24 16 V160 Q24 170 34 170 H86 Q96 170 96 160 V10"
        stroke={Colors.textSecondary}
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {ticks.map((v) => (
        <Line key={v} x1={v % 100 === 0 ? 70 : 80} x2={96} y1={y(v)} y2={y(v)} stroke={Colors.textMuted} strokeWidth={v % 100 === 0 ? 1.5 : 1} />
      ))}
      {ticks
        .filter((v) => v % 100 === 0)
        .map((v) => (
          <SvgText key={`l${v}`} x={66} y={y(v) + 3.5} fontSize={10} fill={Colors.textSecondary} textAnchor="end">
            {v}
          </SvgText>
        ))}
      <SvgText x={60} y={top - 6} fontSize={9} fill={Colors.textMuted} textAnchor="middle">
        ml
      </SvgText>
    </Svg>
  );
};

// "Medición rápida de volumen" (desde Hidratación o desde el apunte de la orina): instrucciones,
// cuánto llenó (un cuarto, la mitad… de una botella de 500 ml o en el vaso graduado) y, si se
// sabe, el volumen exacto con la rueda. Se guarda en el apunte de ese día.
export const VolumeCheckScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const day = params.day ?? dayKey(new Date());
  const [existing, setExisting] = useState<UrineEntry | null>(null);
  const [level, setLevel] = useState<VoidVolume | undefined>();
  const [exact, setExact] = useState(false);
  const [ml, setMl] = useState(250);
  const [usual, setUsual] = useState<UrineEntry['volumeUsual']>();
  const [showDay, setShowDay] = useState(false);
  const [dayMl, setDayMl] = useState(1500);
  const [wheelKey, setWheelKey] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    urineRepository.getAll().then((all) => {
      const e = entryForDay(all, day);
      if (!e) return;
      setExisting(e);
      setLevel(e.voidVolume);
      setUsual(e.volumeUsual);
      if (e.voidMl) {
        setExact(true);
        setMl(e.voidMl);
      }
      if (e.dailyTotalMl) {
        setShowDay(true);
        setDayMl(e.dailyTotalMl);
      }
      setWheelKey((k) => k + 1);
    });
  }, [day]);

  const shownMl = exact ? ml : level ? VOID_VOLUMES.find((v) => v.id === level)!.ml : null;
  const canSave = !!level || exact || showDay;

  const save = async () => {
    setSaving(true);
    const values: Partial<UrineEntry> = {
      voidVolume: exact ? nearestVolume(ml) : level,
      voidMl: exact ? ml : undefined,
      volumeUsual: exact || level ? usual : undefined,
      dailyTotalMl: showDay ? dayMl : undefined,
    };
    try {
      if (existing) await urineRepository.update(existing.id, values);
      else await urineRepository.save({ id: `${Date.now()}`, fecha: noonOf(day), createdAt: new Date().toISOString(), ...values });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circleButton, canSave && styles.circleButtonActive]} onPress={save} disabled={!canSave || saving}>
          <Ionicons name="checkmark" size={22} color={canSave ? Colors.background : Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="beaker-outline" size={26} color={Colors.gold} />
          </View>
          <Text style={[styles.title, { textAlign: 'center' }]}>{t('Quick volume check')}</Text>
          <Text style={styles.subtitle}>{t('Once every few months: it gives an idea of how much you pass each time.')}</Text>
        </View>

        <View style={styles.askCard}>
          <Text style={styles.askTitle}>{t('How to do it')}</Text>
          {[
            t('Next time you go, pee into a measuring jug or an empty 500 ml bottle.'),
            t('Leave it on a flat surface and look at the level.'),
            t('Mark it here. If you can read the exact ml, add them below.'),
          ].map((s, i) => (
            <View key={s} style={styles.step}>
              <Text style={styles.stepNumber}>{i + 1}</Text>
              <Text style={[styles.askText, { flex: 1 }]}>{s}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.label}>{t('How full was it?')}</Text>
        <View style={styles.beakerRow}>
          <Beaker ml={shownMl} />
          <View style={styles.levels}>
            {[...VOID_VOLUMES].reverse().map((v) => {
              const on = !exact && level === v.id;
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.level, on && styles.levelOn]}
                  onPress={() => {
                    setExact(false);
                    setLevel(v.id);
                  }}
                >
                  <Text style={[styles.levelText, on && styles.levelTextOn]}>{t(v.label)}</Text>
                  <Text style={styles.levelMl}>≈ {v.ml} ml</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.exactToggle} onPress={() => setExact((e) => !e)} activeOpacity={0.85}>
          <Ionicons name={exact ? 'checkbox' : 'square-outline'} size={22} color={exact ? Colors.accent : Colors.textMuted} />
          <Text style={styles.exactText}>{t('I know the exact amount')}</Text>
        </TouchableOpacity>
        {exact && (
          <View style={styles.wheelRow} key={`ml${wheelKey}`}>
            <WheelPicker items={ML.map(String)} selectedIndex={Math.max(0, ML.indexOf(ml))} onChange={(i) => setMl(ML[i])} width={110} />
            <Text style={styles.wheelUnit}>ml</Text>
          </View>
        )}

        {(level || exact) && (
          <>
            <Text style={styles.label}>{t('Is that about what you usually pass?')}</Text>
            <ChoiceChips
              options={[
                { id: 'yes', label: t('Yes') },
                { id: 'no', label: t('No') },
                { id: 'unsure', label: t('Not sure') },
              ]}
              value={usual}
              onChange={(v) => setUsual(v as UrineEntry['volumeUsual'])}
              center
            />
            {usual === 'no' && <Text style={[styles.askText, styles.centerText]}>{t('Try again another day. Most adults pass about 200–400 ml each time.')}</Text>}
          </>
        )}

        <TouchableOpacity style={[styles.exactToggle, { marginTop: 26 }]} onPress={() => setShowDay((v) => !v)} activeOpacity={0.85}>
          <Ionicons name={showDay ? 'checkbox' : 'square-outline'} size={22} color={showDay ? Colors.accent : Colors.textMuted} />
          <View style={{ flex: 1 }}>
            <Text style={styles.exactText}>{t('I measured a whole day')}</Text>
            <Text style={styles.askText}>{t('Pharmacies sell 24-hour urine containers. Collect everything for a day and write the total.')}</Text>
          </View>
        </TouchableOpacity>
        {showDay && (
          <>
            <View style={styles.wheelRow} key={`day${wheelKey}`}>
              <WheelPicker items={DAY_ML.map(String)} selectedIndex={Math.max(0, DAY_ML.indexOf(dayMl))} onChange={(i) => setDayMl(DAY_ML[i])} width={110} />
              <Text style={styles.wheelUnit}>{t('ml in 24 h')}</Text>
            </View>
            <Text style={[styles.askText, styles.centerText]}>{dailyTotalNote(dayMl).body}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  ...logScreenStyles,
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentSoft,
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  beakerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  levels: { flex: 1, gap: 8 },
  level: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  levelOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  levelText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  levelTextOn: { color: Colors.textPrimary },
  levelMl: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  exactToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  exactText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  wheelUnit: { color: Colors.textSecondary, fontSize: 15, fontWeight: '700' },
  centerText: { textAlign: 'center', marginTop: 8 },
});
