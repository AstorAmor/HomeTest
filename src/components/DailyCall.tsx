import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { OnDark } from '@/constants/colors';

// Móvil: la sala de Daily se abre en la ventana segura del navegador integrado (Chrome
// Custom Tabs / Safari) por encima de la app. Al colgar, se vuelve a la pantalla.
// Siguiente paso: SDK nativo de Daily (@daily-co/react-native-daily-js) con APK nuevo.
export const DailyCall = ({ joinUrl, onClose, patientName }: { joinUrl: string; onClose?: () => void; patientName?: string }) => {
  const [opened, setOpened] = useState(false);

  const open = async () => {
    setOpened(true);
    await WebBrowser.openBrowserAsync(joinUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: '#0D0F1A',
      controlsColor: '#FFFFFF',
      showTitle: false,
      enableBarCollapsing: true,
    });
  };

  useEffect(() => {
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinUrl]);

  return (
    <View style={styles.wrap}>
      <Ionicons name="videocam" size={44} color={OnDark.text} />
      <Text style={styles.title}>{opened ? 'Video consultation in progress' : 'Opening the video…'}</Text>
      {patientName ? <Text style={styles.sub}>{patientName}</Text> : null}
      <TouchableOpacity style={styles.btn} onPress={open}>
        <Ionicons name="enter-outline" size={18} color="#111" />
        <Text style={styles.btnText}>{opened ? 'Back to the call' : 'Join video'}</Text>
      </TouchableOpacity>
      {onClose && (
        <TouchableOpacity style={styles.end} onPress={onClose}>
          <Ionicons name="call" size={20} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.endText}>End consultation</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: OnDark.background, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  title: { color: OnDark.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  sub: { color: OnDark.textSecondary, fontSize: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  btnText: { color: '#111', fontSize: 15, fontWeight: '800' },
  end: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E5484D', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11 },
  endText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
