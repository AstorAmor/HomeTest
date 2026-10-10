import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';

// Mapa ligero hecho con teselas (sin módulos nativos: funciona en el APK actual,
// Expo Go y web). Encaja todos los puntos al abrirse, se puede arrastrar y hacer zoom
// con los botones, y cada chincheta se puede tocar.
// Teselas: Esri "World Street Map" (en color, con nombres), sin clave. Atribución
// obligatoria. CARTO ya exige clave y los servidores de OpenStreetMap bloquean apps.
// Para producción: cuenta de ArcGIS Location Platform (nivel gratuito) u otro proveedor
// con clave (MapTiler, Stadia…), o react-native-maps en un APK nuevo.

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
}

interface TileMapProps {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
}

const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 16; // máximo del mapa base de Esri
// Mapa en color (calles, parques y agua) en vez del gris: al fundador el gris le parecía soso.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const layers = () => ['World_Street_Map'];
const tileUrl = (layer: string, z: number, x: number, y: number) => `${ESRI}/${layer}/MapServer/tile/${z}/${y}/${x}`;

// Proyección Web Mercator: coordenadas del "mundo" en píxeles a zoom 0.
const project = (lat: number, lng: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * TILE, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE };
};

export const TileMap = ({ points, selectedId, onSelect, height = 260 }: TileMapProps) => {
  const [width, setWidth] = useState(0);
  // Vista: centro en píxeles-mundo a zoom 0 y zoom (fraccionario)
  const [view, setView] = useState<{ cx: number; cy: number; z: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const start = useRef(view); // vista al empezar a arrastrar

  const projected = useMemo(() => points.map((p) => ({ ...p, ...project(p.lat, p.lng) })), [points]);

  const fit = () => {
    if (!width || !projected.length) return;
    const xs = projected.map((p) => p.x);
    const ys = projected.map((p) => p.y);
    const dx = Math.max(Math.max(...xs) - Math.min(...xs), 1e-6);
    const dy = Math.max(Math.max(...ys) - Math.min(...ys), 1e-6);
    const pad = 36;
    const z = Math.min(Math.log2((width - pad * 2) / dx), Math.log2((height - pad * 2) / dy), 15);
    setView({ cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, z });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fit, [width, projected]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = viewRef.current;
        },
        onPanResponderMove: (_, g) => {
          const s = start.current;
          if (!s) return;
          const k = 2 ** s.z;
          setView({ ...s, cx: s.cx - g.dx / k, cy: s.cy - g.dy / k });
        },
      }),
    [],
  );

  const zoomBy = (d: number) =>
    setView((v) => (v ? { ...v, z: Math.max(MIN_Z, Math.min(MAX_Z, v.z + d)) } : v));

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  let tiles: React.ReactNode[] = [];
  let pins: React.ReactNode[] = [];
  if (view && width) {
    const tz = Math.max(MIN_Z, Math.min(MAX_Z, Math.floor(view.z)));
    const k = 2 ** view.z; // píxeles de pantalla por píxel-mundo
    const size = TILE * 2 ** (view.z - tz); // tamaño en pantalla de una tesela del nivel tz
    const left = view.cx * k - width / 2; // píxel (a zoom view.z) en el borde izquierdo
    const top = view.cy * k - height / 2;
    const n = 2 ** tz;
    for (let tx = Math.floor(left / size); tx <= Math.floor((left + width) / size); tx++) {
      for (let ty = Math.floor(top / size); ty <= Math.floor((top + height) / size); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        for (const layer of layers()) {
          tiles.push(
            <Image
              key={`${layer}-${tz}-${tx}-${ty}`}
              source={{ uri: tileUrl(layer, tz, wx, ty) }}
              style={{
                position: 'absolute',
                // Redondeo + 1 px de solape para que no se vean juntas entre teselas
                left: Math.floor(tx * size - left),
                top: Math.floor(ty * size - top),
                width: Math.ceil(size) + 1,
                height: Math.ceil(size) + 1,
              }}
              cachePolicy="memory-disk"
              transition={0}
            />,
          );
        }
      }
    }
    pins = projected.map((p) => {
      const selected = p.id === selectedId;
      const x = p.x * k - left;
      const y = p.y * k - top;
      const s = selected ? 38 : 30;
      return (
        <TouchableOpacity
          key={p.id}
          onPress={() => onSelect?.(p.id)}
          hitSlop={8}
          style={{ position: 'absolute', left: x - s / 2, top: y - s + 2, zIndex: selected ? 2 : 1 }}
        >
          <Ionicons name="location" size={s} color={selected ? '#B8904F' : '#0E2A24'} />
        </TouchableOpacity>
      );
    });
  }

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout} {...pan.panHandlers}>
      {tiles}
      {pins}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrl} onPress={() => zoomBy(1)}>
          <Ionicons name="add" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={() => zoomBy(-1)}>
          <Ionicons name="remove" size={18} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.ctrl} onPress={fit}>
          <Ionicons name="scan-outline" size={16} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.attribution}>Esri, HERE, Garmin, © OpenStreetMap contributors</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  controls: { position: 'absolute', right: 10, top: 10, gap: 6 },
  ctrl: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(Colors.card, 0.92),
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontSize: 9,
    color: Colors.textSecondary,
    backgroundColor: withAlpha(Colors.card, 0.7),
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
