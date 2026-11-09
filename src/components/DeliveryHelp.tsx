import React, { useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { Colors, withAlpha } from '@/constants/colors';
import { DeliverySetting, deliverySettings, manualSteps, oemFamily, openByDefault } from '@/logic/deliveryHelp';
import { openDeliverySetting, sendTestReminder } from '@/data/phoneReminders';

// «Para que los avisos lleguen» (2026-11-09): en Ajustes → Notificaciones, debajo de «En el móvil», solo
// en Android y con los avisos activados. Algunos móviles (sobre todo Xiaomi, Redmi y POCO) cierran Kuova
// en segundo plano o retrasan sus avisos: aquí se enseña cada ajuste con un botón y un aviso de prueba.
// La lógica de qué pasos tocan está en src/logic/deliveryHelp.ts.

const SETTING_TEXT: Record<DeliverySetting, { title: string; body: string; icon: keyof typeof Ionicons.glyphMap }> = {
  exact_alarms: { title: 'Alarms & reminders', body: 'So the workout rest and your doses ring on time.', icon: 'alarm-outline' },
  battery: { title: 'Battery', body: 'Find Kuova and choose «Unrestricted» or «Don’t optimise».', icon: 'battery-half-outline' },
  lock_screen: { title: 'Lock screen', body: 'In Kuova’s notifications, allow them on the lock screen.', icon: 'lock-closed-outline' },
};

const MANUAL_TITLE = { xiaomi: 'On Xiaomi, Redmi and POCO, also in Kuova’s settings:', samsung: 'On Samsung, also in Kuova’s settings:' } as const;

export function DeliveryHelp() {
  const info = useMemo(() => {
    const c = Platform.constants as { Manufacturer?: string; Brand?: string };
    const family = oemFamily(c.Manufacturer, c.Brand);
    return { family, settings: deliverySettings(Number(Platform.Version) || 0), manual: manualSteps(family) };
  }, []);
  const [open, setOpen] = useState(openByDefault(info.family));
  const [test, setTest] = useState<'idle' | 'sending' | 'scheduled' | 'no_permission'>('idle');

  if (Platform.OS !== 'android') return null;

  const sendTest = async () => {
    setTest('sending');
    const r = await sendTestReminder().catch(() => 'unsupported' as const);
    setTest(r === 'scheduled' ? 'scheduled' : r === 'no_permission' ? 'no_permission' : 'idle');
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.head}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <Ionicons name="notifications-circle-outline" size={18} color={Colors.textPrimary} />
        <Text style={styles.title}>{t('For your reminders to arrive')}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <>
          <Text style={styles.body}>
            {t('Some phones close Kuova in the background or delay its notifications to save battery. Check this once:')}
          </Text>

          {info.settings.map((s) => (
            <View key={s} style={styles.row}>
              <Ionicons name={SETTING_TEXT[s].icon} size={18} color={Colors.textSecondary} style={styles.rowIcon} />
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t(SETTING_TEXT[s].title)}</Text>
                <Text style={styles.body}>{t(SETTING_TEXT[s].body)}</Text>
              </View>
              <TouchableOpacity style={styles.openButton} onPress={() => openDeliverySetting(s)} activeOpacity={0.85}>
                <Text style={styles.openText}>{t('Open')}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {info.manual.length > 0 && info.family !== 'other' && (
            <View style={styles.manual}>
              <Text style={styles.rowTitle}>{t(MANUAL_TITLE[info.family])}</Text>
              {info.manual.map((step, i) => (
                <Text key={step} style={styles.body}>
                  {i + 1}. {t(step)}
                </Text>
              ))}
              <TouchableOpacity style={[styles.openButton, styles.manualButton]} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
                <Text style={styles.openText}>{t('Open Kuova’s settings')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.testButton}
            onPress={sendTest}
            disabled={test === 'sending'}
            activeOpacity={0.85}>
            <Ionicons name="paper-plane-outline" size={15} color={Colors.background} />
            <Text style={styles.testText}>{t('Send a test notification in 1 minute')}</Text>
          </TouchableOpacity>
          {test === 'scheduled' && (
            <Text style={styles.note}>
              {t('Done. Lock your phone and wait a minute. If it does not arrive, or arrives late, check the steps above.')}
            </Text>
          )}
          {test === 'no_permission' && <Text style={styles.note}>{t('Kuova notifications are off in your phone settings.')}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  body: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowIcon: { alignSelf: 'flex-start', marginTop: 1 },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  openButton: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  openText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  manualButton: { alignSelf: 'flex-start', marginTop: 6 },
  manual: {
    backgroundColor: withAlpha(Colors.accent, 0.08),
    borderRadius: 12,
    padding: 10,
    gap: 3,
    marginTop: 2,
  },
  testButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 6,
  },
  testText: { color: Colors.background, fontSize: 13, fontWeight: '700' },
  note: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
});
