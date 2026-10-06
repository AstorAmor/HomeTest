import React from 'react';
import { View, StyleSheet } from 'react-native';

// Web: la sala de Daily integrada en la página (iframe). El navegador pide cámara y micro.
export const DailyCall = ({ joinUrl }: { joinUrl: string; onClose?: () => void; patientName?: string }) => (
  <View style={styles.wrap}>
    <iframe
      src={joinUrl}
      title="Video consultation"
      allow="camera; microphone; fullscreen; display-capture; autoplay; speaker-selection"
      style={{ border: 0, width: '100%', height: '100%', borderRadius: 12, background: '#0A1D19' }}
    />
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0A1D19', borderRadius: 12, overflow: 'hidden' },
});
