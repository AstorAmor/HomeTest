import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { mockPatient } from '@/data/mockData';
import { buildPlanDoc } from '@/utils/planPdf';
import { planShareSupport, printPlan, sharePlanPdf } from '@/utils/sharePlan';

type Action = 'send' | 'print';

// Botón "Share or print" del plan personalizado: PDF por WhatsApp/correo/al médico
// (menú de compartir del sistema), imprimir o guardar como PDF, o dar acceso a un
// profesional de Kuova desde la app.
export const SharePlanButton = () => {
  const router = useRouter();
  const { user, authMode } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const support = planShareSupport();

  const run = async (action: Action) => {
    setError(null);
    setBusy(action);
    // Mismo criterio que UserAvatar: el nombre de ejemplo solo en modo demo
    const name = authMode === 'demo' ? user?.nombre || mockPatient.nombre : user?.nombre || user?.email || '';
    const doc = buildPlanDoc(name);
    try {
      // En el móvil, el menú de compartir / imprimir del sistema no se puede abrir
      // encima del Modal: se cierra primero y se espera a que acabe la animación.
      if (Platform.OS !== 'web') {
        setOpen(false);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      if (action === 'send') await sharePlanPdf(doc);
      else await printPlan(doc);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setOpen(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setOpen(true)} activeOpacity={0.85}>
        <Ionicons name="share-outline" size={18} color={Colors.accent} />
        <Text style={styles.buttonText}>Share or print</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Share your plan</Text>
          <Text style={styles.sheetText}>
            A clean PDF with your actions, why they matter and what we expect to improve.
          </Text>

          {support.sendPdf && (
            <Option
              icon="paper-plane-outline"
              title="Send as PDF"
              subtitle="WhatsApp, email, your doctor…"
              loading={busy === 'send'}
              onPress={() => run('send')}
            />
          )}
          {support.print && (
            <Option
              icon={Platform.OS === 'web' ? 'download-outline' : 'print-outline'}
              title={Platform.OS === 'web' ? 'Save as PDF or print' : 'Print'}
              subtitle={Platform.OS === 'web' ? 'Choose "Save as PDF" to attach it anywhere' : 'Or save it as a PDF'}
              loading={busy === 'print'}
              onPress={() => run('print')}
            />
          )}
          <Option
            icon="medkit-outline"
            title="Share with a Kuova professional"
            subtitle="Give them access to your plan in the app"
            onPress={() => {
              setOpen(false);
              router.push({ pathname: '/share-new', params: { scope: 'plan' } });
            }}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </Modal>
    </>
  );
};

const Option = ({
  icon,
  title,
  subtitle,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  loading?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.option} onPress={onPress} disabled={loading} activeOpacity={0.85}>
    <Ionicons name={icon} size={22} color={Colors.accent} />
    <View style={{ flex: 1 }}>
      <Text style={styles.optionTitle}>{title}</Text>
      <Text style={styles.optionSubtitle}>{subtitle}</Text>
    </View>
    {loading ? (
      <ActivityIndicator size="small" color={Colors.accent} />
    ) : (
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  buttonText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.backgroundElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
    marginBottom: 8,
  },
  sheetTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  sheetText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
  },
  optionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  optionSubtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 4 },
});
