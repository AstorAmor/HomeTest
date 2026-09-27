import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Confetti } from '@/components/Confetti';
import { CosmicBackground } from '@/components/CosmicBackground';

// Momento "wow" al recibir resultados: rayo + GREAT JOB!! + confeti, y de ahí al informe.
export const ResultsReadyScreen = () => {
  const router = useRouter();
  const bolt = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(bolt, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(2)), useNativeDriver: false }),
      Animated.spring(text, { toValue: 1, friction: 5, useNativeDriver: false }),
    ]).start();
  }, [bolt, text]);

  const openReport = () => {
    router.replace('/(tabs)');
    router.push('/report-summary');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <CosmicBackground />
      <Confetti count={90} duration={3200} />
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.boltCircle,
            {
              opacity: bolt,
              transform: [
                { scale: bolt.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                { rotate: bolt.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
              ],
            },
          ]}
        >
          <Ionicons name="flash" size={64} color={Colors.amber} />
        </Animated.View>

        <Animated.Text
          style={[
            styles.greatJob,
            { opacity: text, transform: [{ scale: text.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        >
          GREAT JOB!!
        </Animated.Text>
        <Text style={styles.title}>Your results are in</Text>
        <Text style={styles.teaser}>
          Your cholesterol, glucose and inflammation markers have clearly improved over the last 6 months, right in
          step with better sleep and more movement.
        </Text>

        <TouchableOpacity style={styles.cta} onPress={openReport} activeOpacity={0.85}>
          <Text style={styles.ctaText}>View my report</Text>
          <Ionicons name="arrow-forward" size={18} color={Colors.background} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.secondary}>
          <Text style={styles.secondaryText}>Later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0F1A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  boltCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(240, 184, 77, 0.14)',
    borderWidth: 2,
    borderColor: 'rgba(240, 184, 77, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  greatJob: {
    color: Colors.amber,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 14,
  },
  teaser: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 36,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
  },
  ctaText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    paddingVertical: 14,
  },
  secondaryText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
