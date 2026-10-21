import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable, Platform, useWindowDimensions } from 'react-native';
import { Colors } from '@/constants/colors';
import { getTarget, onTourStart, RegisteredTarget, setTourActive, takeTourPending, TOUR_STEPS } from './tourStore';
import { t } from '@/i18n';

// El tutorial en marcha: oscurece la pantalla menos el elemento de cada paso (cuatro franjas alrededor),
// con un bocadillo encima o debajo. Tocar el elemento o «Siguiente» pasa al siguiente; «Saltar» lo
// cierra. Cambia de pestaña él solo y baja hasta el elemento si está más abajo. Va dentro de las
// pestañas (MainTabsScreen), que le dan `goToTab`.

type Rect = { x: number; y: number; width: number; height: number };

const PAD = 6;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const measure = (target: RegisteredTarget) =>
  new Promise<Rect | null>((resolve) => {
    const v = target.view.current;
    if (!v) return resolve(null);
    // inset: el margen lateral de la tarjeta que envuelve (el View ocupa todo el ancho)
    const i = target.inset ?? 0;
    v.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x: x + i, y, width: width - i * 2, height } : null));
  });

async function bringIntoView(target: RegisteredTarget, screenH: number) {
  const v = target.view.current as unknown as { scrollIntoView?: (o: object) => void; getBoundingClientRect?: () => { height: number } } | null;
  if (Platform.OS === 'web') {
    // Sin «smooth»: con la ventana del tutorial abierta el navegador no llegaba a bajar. Lo que es muy
    // alto (la tarjeta de «Tu estado de hoy») se alinea por arriba para que se vea entero lo posible.
    const tall = (v?.getBoundingClientRect?.().height ?? 0) > screenH * 0.5;
    v?.scrollIntoView?.({ block: tall ? 'start' : 'center' });
    return;
  }
  const scroll = target.scroll?.ref.current;
  const inner = target.scroll?.innerViewRef.current;
  if (!scroll || !inner || !target.view.current) return;
  await new Promise<void>((resolve) =>
    target.view.current!.measureLayout(
      inner as any,
      (_x, y) => {
        scroll.scrollTo({ y: Math.max(0, y - screenH * 0.18), animated: true });
        resolve();
      },
      () => resolve(),
    ),
  );
}

// En la web, el contenedor con scroll más cercano (el ScrollView de la pantalla)
function scrollBackToTop(target: RegisteredTarget) {
  if (Platform.OS !== 'web') {
    target.scroll?.ref.current?.scrollTo({ y: 0, animated: false });
    return;
  }
  let el = (target.view.current as unknown as HTMLElement | null)?.parentElement ?? null;
  while (el) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
      el.scrollTop = 0;
      return;
    }
    el = el.parentElement;
  }
}

export const TourOverlay = ({ goToTab, enabled = true }: { goToTab: (tab: number) => void; enabled?: boolean }) => {
  const { width: W, height: H } = useWindowDimensions();
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef(0); // para que un paso que aún se está preparando no pise al siguiente
  // Lo que ha hecho bajar en la pestaña en la que está: al irse de ella (o al acabar) vuelve arriba
  const scrolled = useRef(new Set<RegisteredTarget>());
  const tabNow = useRef<number | null>(null);
  const current = useRef<RegisteredTarget | null>(null); // el del paso a la vista, para volver a medirlo
  const resetScrolled = () => {
    scrolled.current.forEach(scrollBackToTop);
    scrolled.current.clear();
  };

  const end = useCallback(() => {
    run.current++;
    setIndex(null);
    setRect(null);
    // Antes de cambiar de pestaña: en la web, una pantalla oculta ya no se deja mover
    resetScrolled();
    tabNow.current = null;
    current.current = null;
    goToTab(0);
    setTourActive(false);
  }, [goToTab]);

  const go = useCallback(
    async (from: number) => {
      const me = ++run.current;
      setTourActive(true);
      for (let i = from; i < TOUR_STEPS.length; i++) {
        const step = TOUR_STEPS[i];
        setBusy(true);
        setRect(null);
        current.current = null;
        setIndex(i);
        if (tabNow.current !== step.tab) resetScrolled();
        tabNow.current = step.tab;
        goToTab(step.tab);
        await wait(450);
        if (me !== run.current) return;
        const target = getTarget(step.target);
        if (!target) continue; // sección apagada: al siguiente
        if (target.scroll) scrolled.current.add(target);
        await bringIntoView(target, H);
        await wait(Platform.OS === 'web' ? 450 : 380);
        if (me !== run.current) return;
        const r = await measure(target);
        if (me !== run.current) return;
        // Fuera de la pantalla (no se pudo bajar hasta él): el bocadillo solo, en el centro
        setRect(r && r.y + r.height > 0 && r.y < H ? r : null);
        current.current = target;
        setBusy(false);
        return;
      }
      end();
    },
    [goToTab, H, end],
  );

  // Si algo de la pantalla carga tarde y lo mueve, el hueco lo sigue
  useEffect(() => {
    if (index === null || busy) return;
    const id = setInterval(async () => {
      const target = current.current;
      if (!target) return;
      const r = await measure(target);
      if (!r || r.y + r.height <= 0 || r.y >= H) return;
      setRect((old) => (old && Math.abs(old.x - r.x) < 1 && Math.abs(old.y - r.y) < 1 && Math.abs(old.height - r.height) < 1 ? old : r));
    }, 500);
    return () => clearInterval(id);
  }, [index, busy, H]);

  useEffect(() => {
    if (!enabled) return;
    const off = onTourStart(() => go(0));
    takeTourPending().then((pending) => {
      if (!pending) return;
      // Ya cuenta como en marcha: que los avisos de bienvenida no salgan en ese medio segundo
      setTourActive(true);
      setTimeout(() => go(0), 900);
    });
    return off;
  }, [enabled, go]);

  if (index === null) return null;
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;
  const next = () => (last ? end() : go(index + 1));

  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 } : null;
  // Bocadillo debajo del hueco si cabe; si no, encima
  const below = hole ? hole.y + hole.h / 2 < H / 2 : true;
  const bubblePos = hole ? (below ? { top: hole.y + hole.h + 12 } : { bottom: H - hole.y + 12 }) : { top: H * 0.32 };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={end}>
      <View style={StyleSheet.absoluteFill}>
        {hole ? (
          <>
            <View style={[styles.shade, { top: 0, left: 0, right: 0, height: Math.max(0, hole.y) }]} />
            <View style={[styles.shade, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.shade, { top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h }]} />
            <View style={[styles.shade, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
            <Pressable
              onPress={next}
              style={[styles.hole, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]}
              accessibilityLabel={t(step.title)}
            />
          </>
        ) : (
          <View style={[styles.shade, StyleSheet.absoluteFill]} />
        )}
        {!busy && (
          <View style={[styles.bubble, { left: 16, width: Math.min(W - 32, 420) }, bubblePos]}>
            <Text style={styles.counter}>{t('{a} of {b}', { a: index + 1, b: TOUR_STEPS.length })}</Text>
            <Text style={styles.title}>{t(step.title)}</Text>
            <Text style={styles.text}>{t(step.text)}</Text>
            <View style={styles.buttons}>
              <TouchableOpacity onPress={end} hitSlop={8}>
                <Text style={styles.skip}>{last ? '' : t('Skip')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.next} onPress={next}>
                <Text style={styles.nextText}>{last ? t('Done') : t('Next')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  shade: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.62)' },
  hole: { position: 'absolute', borderRadius: 14, borderWidth: 2, borderColor: Colors.accent },
  bubble: {
    position: 'absolute',
    backgroundColor: Colors.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    gap: 6,
  },
  counter: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  text: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  skip: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  next: { backgroundColor: Colors.accent, borderRadius: 20, paddingHorizontal: 22, paddingVertical: 10 },
  nextText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});
