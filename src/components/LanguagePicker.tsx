import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { getLang, Lang, LANGUAGES, saveLanguage } from '@/i18n';
import { reloadKeepingPlace } from '@/theme/appearance';

// Idioma en la primera pantalla (entrar / crear cuenta), 2026-11-10: así se elige antes de ver nada en el
// idioma equivocado. Los nombres van en su propio idioma («Español», «English») para que se reconozcan
// estés en el que estés. Lo mismo que Ajustes → Idioma: guarda y recarga la app con un fundido.

const SHORT: Partial<Record<Lang, string>> = { es: 'Español', en: 'English' };

export function LanguagePicker() {
  const current = getLang();
  const ready = LANGUAGES.filter((l) => l.ready);
  if (ready.length < 2) return null;

  const choose = async (id: Lang) => {
    if (id === current) return;
    await saveLanguage(id);
    await reloadKeepingPlace(Colors.background);
  };

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      <Ionicons name="globe-outline" size={15} color={Colors.textSecondary} />
      {ready.map((l) => {
        const on = l.id === current;
        return (
          <TouchableOpacity
            key={l.id}
            onPress={() => choose(l.id)}
            style={[styles.pill, on && styles.pillOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={l.name}
            hitSlop={6}>
            <Text style={[styles.text, on && styles.textOn]}>{SHORT[l.id] ?? l.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 6, marginBottom: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  pillOn: { borderColor: withAlpha(Colors.accent, 0.6), backgroundColor: withAlpha(Colors.accent, 0.12) },
  text: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  textOn: { color: Colors.textPrimary },
});
