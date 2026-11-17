import React, { useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { DeliverySetting, deliverySettings, manualSteps, oemFamily, openByDefault } from '@/logic/deliveryHelp';
import { openDeliverySetting, sendTestReminder } from '@/data/phoneReminders';
import { FLink } from '@/components/fine/FineForm';
import { settingsStyles } from '@/components/settings/SettingsParts';
import { FINE, ff, fine } from '@/theme/fine';

// «Para que los avisos lleguen» (2026-11-09): en Ajustes → Notificaciones, debajo de «En el móvil», solo
// en Android y con los avisos activados. Algunos móviles (sobre todo Xiaomi, Redmi y POCO) cierran Kuova
// en segundo plano o retrasan sus avisos: aquí se enseña cada ajuste con un botón y un aviso de prueba.
// La lógica de qué pasos tocan está en src/logic/deliveryHelp.ts.
// Desde el 2026-11-17, en el lenguaje fino de Ajustes: una fila que se despliega, cada ajuste en una fila con línea
// fina y «Abrir» con borde jade a la derecha (sin iconos ni tarjeta), y las acciones como enlaces en jade.

const SETTING_TEXT: Record<DeliverySetting, { title: string; body: string }> = {
  exact_alarms: { title: 'Alarms & reminders', body: 'So the workout rest and your doses ring on time.' },
  battery: { title: 'Battery', body: 'Find Kuova and choose «Unrestricted» or «Don’t optimise».' },
  lock_screen: { title: 'Lock screen', body: 'In Kuova’s notifications, allow them on the lock screen.' },
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
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[fine.row, styles.head, !open && settingsStyles.noLine]}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <Text style={[fine.rowTitle, styles.flex]}>{t('For your reminders to arrive')}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={FINE.mute} />
      </TouchableOpacity>

      {open && (
        <>
          <Text style={styles.text}>
            {t('Some phones close Kuova in the background or delay its notifications to save battery. Check this once:')}
          </Text>

          {info.settings.map((s) => (
            <View key={s} style={fine.row}>
              <View style={styles.flex}>
                <Text style={fine.rowTitle}>{t(SETTING_TEXT[s].title)}</Text>
                <Text style={fine.rowSub}>{t(SETTING_TEXT[s].body)}</Text>
              </View>
              <TouchableOpacity
                style={styles.openButton}
                onPress={() => openDeliverySetting(s)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`${t('Open')}: ${t(SETTING_TEXT[s].title)}`}>
                <Text style={styles.openText}>{t('Open')}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {info.manual.length > 0 && info.family !== 'other' && (
            <View style={styles.manual}>
              <Text style={fine.rowTitle}>{t(MANUAL_TITLE[info.family])}</Text>
              {info.manual.map((step, i) => (
                <Text key={step} style={fine.rowSub}>
                  {i + 1}. {t(step)}
                </Text>
              ))}
              <FLink label={t('Open Kuova’s settings')} onPress={() => Linking.openSettings()} style={settingsStyles.linkLeft} />
            </View>
          )}

          <FLink
            label={t('Send a test notification in 1 minute')}
            onPress={sendTest}
            busy={test === 'sending'}
            style={settingsStyles.linkLeft}
          />
          {test === 'scheduled' && (
            <Text style={styles.text}>
              {t('Done. Lock your phone and wait a minute. If it does not arrive, or arrives late, check the steps above.')}
            </Text>
          )}
          {test === 'no_permission' && <Text style={styles.text}>{t('Kuova notifications are off in your phone settings.')}</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, borderTopWidth: 1, borderTopColor: FINE.line },
  head: { gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  text: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  // «Abrir»: pequeño, con borde jade
  openButton: { borderWidth: 1, borderColor: FINE.jadeLine, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, minHeight: 30, justifyContent: 'center' },
  openText: { ...ff('regular'), color: FINE.jade, fontSize: 12.5 },
  manual: { paddingTop: 12, gap: 3 },
});
