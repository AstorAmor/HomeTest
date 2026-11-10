import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '@/lib/supabase';

// La foto del fondo de pantalla de la tarjeta de emergencia: solo en este móvil (o este navegador), por
// usuario. No se sube a la nube: es una foto personal y solo hace falta para dibujar la imagen aquí.
// Se guarda ya recortada a 1080 × 2340 en JPEG (unos 300-600 KB en base64).
const key = () => `historial.cardPhoto.v1:${getCurrentUserId() ?? 'demo'}`;

export async function loadCardPhoto(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key());
  } catch {
    return null;
  }
}

export async function saveCardPhoto(dataUri: string | null): Promise<void> {
  try {
    if (dataUri) await AsyncStorage.setItem(key(), dataUri);
    else await AsyncStorage.removeItem(key());
  } catch (e) {
    console.warn('Card photo not saved', e);
  }
}
