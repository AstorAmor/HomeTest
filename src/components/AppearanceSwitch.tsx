import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';
import { AppearancePref, getAppearancePref, setAppearancePref } from '@/theme/appearance';

const OPTIONS: { id: AppearancePref; label: string; icon: string }[] = [
  { id: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
  { id: 'light', label: 'Light', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', icon: 'moon-outline' },
];

// Selector de tema (Auto / Light / Dark). Al cambiar, la app se recarga en `returnTo`
// sin cerrar la sesión.
export const AppearanceSwitch = ({ returnTo }: { returnTo: string }) => {
  const [value, setValue] = useState<AppearancePref>('system');
  useEffect(() => {
    getAppearancePref().then(setValue);
  }, []);

  return (
    <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel="Appearance">
      {OPTIONS.map((o) => {
        const on = value === o.id;
        return (
          <TouchableOpacity
            key={o.id}
            style={[styles.item, on && styles.itemOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (on) return;
              setValue(o.id);
              setAppearancePref(o.id, returnTo);
            }}
          >
            <Ionicons name={o.icon as any} size={16} color={on ? Colors.background : Colors.textSecondary} />
            <Text style={[styles.text, on && { color: Colors.background }]}>{t(o.label)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 4,
  },
  item: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 10 },
  itemOn: { backgroundColor: Colors.accent },
  text: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
