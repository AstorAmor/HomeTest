import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ActionPlanList } from '@/components/ActionPlanList';
import { Colors } from '@/constants/colors';
import { currentReport } from '@/data/reportRepository';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

// "Full view" desde Today → Your plan: el action plan del último informe, con el
// porqué de cada acción y la proyección de su marcador.
export const ActionPlanScreen = () => {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Your action plan" showBack />
        <Text style={styles.intro}>
          Built from your blood test of {longDate(currentReport.test_date)} and your wearable data. Each action shows
          why it matters for you and where the marker could be at your next test.
        </Text>

        <ActionPlanList />

        <View style={styles.links}>
          <TouchableOpacity style={styles.link} onPress={() => router.push('/report-plan')}>
            <Ionicons name="stats-chart-outline" size={18} color={Colors.accent} />
            <Text style={styles.linkText}>Your habits and 6-month trends</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => router.push('/plans')}>
            <Ionicons name="time-outline" size={18} color={Colors.accent} />
            <Text style={styles.linkText}>Earlier plans</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => router.push('/talk-to-specialist')}>
            <Ionicons name="chatbubbles-outline" size={18} color={Colors.accent} />
            <Text style={styles.linkText}>Talk to a specialist about your plan</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 16 },
  links: { marginHorizontal: 20, marginTop: 8, gap: 8 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  linkText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
});
