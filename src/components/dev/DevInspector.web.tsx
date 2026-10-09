import { useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Modo "Señalar" (solo web): un botón flotante para tocar cualquier cosa de la app, escribir qué
// quieres cambiar y copiar todas las notas para pegárselas a Claude. Cada nota lleva la pantalla,
// el componente de React que lo pinta (p. ej. "CheckInScreen › MoodOrb"), el icono, el texto, los
// colores y el tamaño, así se encuentra en el código sin adivinar.
// Se ve en el servidor local (npm run web) y en cualquier web de la app abriendo una vez la
// dirección con ?inspect=1 (se recuerda en ese navegador; ?inspect=0 lo quita).
// Todo es DOM directo: no toca el árbol de React Native ni la navegación.

const NOTES_KEY = 'kuova.inspector.notes';
const ON_KEY = 'kuova.inspector';
const GOLD = '#C9A36B';
const INK = '#0E2A24';

interface Note {
  route: string;
  chain: string;
  details: string;
  note: string;
  at: string;
}

// Nombres internos de React Native Web, la navegación y los SVG: no dicen nada del código propio
const INTERNAL =
  /^(View|Text|TextInput|ScrollView|ScrollViewBase|FlatList|VirtualizedList|CellRenderer|Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Image|ImageBackground|SafeAreaView|SafeAreaProvider|Svg|G|Path|Rect|Circle|Line|Defs|LinearGradient|RadialGradient|Stop|Ellipse|Polygon|Polyline|ClipPath|Mask|Shape|Icon|Suspense|Fragment|Route|Screen|Navigator|NativeStack.*|Stack.*|Scene.*|Header.*|Animated.*|.*Provider|.*Context|.*Boundary|ExpoRoot|ContextNavigator|Layout|GestureHandlerRootView|ThemeProvider|DebugContainer|MaybeScreen.*|ResourceSavingView|Background|KeyboardAvoidingView|Modal|ActivityIndicator|Switch|RefreshControl|StatusBar|BlurView|WrappedScreenComponent|Root|App|Content|.*\(.*\))$/;

const reverseGlyphs = (map: Record<string, number>) => {
  const out = new Map<number, string>();
  for (const [name, code] of Object.entries(map)) if (!out.has(code)) out.set(code, name);
  return out;
};
let GLYPHS: { family: RegExp; names: Map<number, string>; set: string }[] | null = null;
const glyphs = () =>
  (GLYPHS ??= [
    { family: /ionicons/i, names: reverseGlyphs(Ionicons.glyphMap as Record<string, number>), set: 'Ionicons' },
    {
      family: /material.?community/i,
      names: reverseGlyphs(MaterialCommunityIcons.glyphMap as Record<string, number>),
      set: 'MaterialCommunityIcons',
    },
  ]);

function fiberOf(el: Element | null): any {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const k = Object.keys(n).find((key) => key.startsWith('__reactFiber$'));
    if (k) return (n as any)[k];
  }
  return null;
}

const nameOf = (type: any): string | null => {
  if (!type || typeof type === 'string') return null;
  return type.displayName || type.name || type.render?.displayName || type.render?.name || type.type?.displayName || type.type?.name || null;
};

// Quién pinta este elemento: la cadena de "dueños" de React (el componente cuyo JSX lo contiene,
// el que pinta a ese...), de fuera hacia dentro, sin los componentes internos
function componentChain(el: Element): string {
  const fiber = fiberOf(el);
  const names: string[] = [];
  let f = fiber;
  // Primero el componente más cercano que no sea un elemento básico
  while (f && names.length === 0) {
    const n = nameOf(f.type);
    if (n && !INTERNAL.test(n)) names.push(n);
    f = f.return;
  }
  let o = fiber?._debugOwner;
  while (o && names.length < 7) {
    const n = nameOf(o.type);
    if (n && !INTERNAL.test(n) && names[names.length - 1] !== n) names.push(n);
    o = o._debugOwner;
  }
  // De fuera hacia dentro, y solo los 4 más cercanos: basta para encontrarlo en el código
  return names.reverse().slice(-4).join(' › ') || el.tagName.toLowerCase();
}

// "rgb(201, 163, 107)" → "#C9A36B"; con transparencia, "#C9A36B al 15 %"
const hex = (rgb: string) => {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m || (m[3] !== undefined && Number(m[3]) === 0)) return null;
  const code = '#' + m.slice(0, 3).map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return m[3] !== undefined && Number(m[3]) < 1 ? `${code} al ${Math.round(Number(m[3]) * 100)} %` : code;
};

function background(el: Element): string | null {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = hex(getComputedStyle(n).backgroundColor);
    if (c) return c;
  }
  return null;
}

function describe(el: HTMLElement): string {
  const parts: string[] = [];
  const style = getComputedStyle(el);
  const text = (el.innerText || '').trim();
  const code = text.length === 1 ? text.codePointAt(0) : undefined;
  const iconSet = code ? glyphs().find((g) => g.family.test(style.fontFamily) && g.names.has(code)) : undefined;
  if (iconSet && code) parts.push(`icono ${iconSet.set} "${iconSet.names.get(code)}"`);
  else if (text) parts.push(`texto "${text.replace(/\s+/g, ' ').slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
  else if (el.closest('svg')) parts.push('dibujo SVG');
  const color = hex(style.color);
  const bg = background(el);
  if (color && (text || iconSet)) parts.push(`color ${color}`);
  if (bg) parts.push(`fondo ${bg}`);
  const r = el.getBoundingClientRect();
  parts.push(`${Math.round(r.width)}×${Math.round(r.height)} px`);
  return parts.join(' · ');
}

function readNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeNotes(notes: Note[]) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    // sin almacenamiento (modo privado): las notas viven mientras la página esté abierta
  }
}

function enabled(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('inspect');
    if (q === '1') localStorage.setItem(ON_KEY, '1');
    if (q === '0') localStorage.removeItem(ON_KEY);
    return __DEV__ || localStorage.getItem(ON_KEY) === '1';
  } catch {
    return __DEV__;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration>, text?: string) {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  if (text) e.textContent = text;
  return e;
}

const button = (text: string, primary = false) =>
  el(
    'button',
    {
      font: '600 13px system-ui, sans-serif',
      padding: '8px 12px',
      borderRadius: '999px',
      border: primary ? 'none' : '1px solid rgba(14,42,36,0.2)',
      background: primary ? INK : '#fff',
      color: primary ? '#FAF7EF' : INK,
      cursor: 'pointer',
    },
    text
  );

function mount(): () => void {
  const root = el('div', { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483646' });
  root.setAttribute('data-kuova-inspector', '');
  document.body.appendChild(root);

  const box = el('div', {
    position: 'fixed',
    border: `2px solid ${GOLD}`,
    background: 'rgba(201,163,107,0.14)',
    borderRadius: '4px',
    pointerEvents: 'none',
    display: 'none',
  });
  const tag = el('div', {
    position: 'fixed',
    background: INK,
    color: '#FAF7EF',
    font: '600 11px system-ui, sans-serif',
    padding: '3px 6px',
    borderRadius: '4px',
    pointerEvents: 'none',
    display: 'none',
    maxWidth: '80vw',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  root.append(box, tag);

  const toggle = button('');
  Object.assign(toggle.style, {
    position: 'fixed',
    left: '12px',
    bottom: '12px',
    pointerEvents: 'auto',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  });
  root.appendChild(toggle);

  const panel = el('div', {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    width: 'min(380px, calc(100vw - 24px))',
    background: '#fff',
    color: INK,
    borderRadius: '16px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
    padding: '14px',
    font: '13px/1.45 system-ui, sans-serif',
    pointerEvents: 'auto',
    display: 'none',
  });
  root.appendChild(panel);

  let picking = false;
  let selected: HTMLElement | null = null;

  const inUi = (t: EventTarget | null) => t instanceof Node && root.contains(t);

  const place = (target: HTMLElement | null) => {
    if (!target) {
      box.style.display = tag.style.display = 'none';
      return;
    }
    const r = target.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    tag.textContent = componentChain(target).split(' › ').pop() ?? '';
    Object.assign(tag.style, { display: 'block', left: `${Math.max(4, r.left)}px`, top: `${Math.max(4, r.top - 22)}px` });
  };

  const renderToggle = () => {
    const n = readNotes().length;
    toggle.textContent = picking ? '✓ Señalando… (Esc para salir)' : `🎯 Señalar${n ? ` · ${n} nota${n > 1 ? 's' : ''}` : ''}`;
    toggle.style.background = picking ? GOLD : '#fff';
  };

  const renderPanel = () => {
    panel.replaceChildren();
    const notes = readNotes();
    if (selected) {
      const head = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' });
      head.append(el('strong', { fontSize: '14px' }, 'Elemento seleccionado'));
      const close = button('✕');
      close.onclick = () => {
        selected = null;
        place(null);
        renderPanel();
      };
      head.appendChild(close);
      panel.appendChild(head);
      panel.appendChild(el('div', { marginTop: '6px', fontWeight: '600', wordBreak: 'break-word' }, componentChain(selected)));
      panel.appendChild(el('div', { color: '#5B6662', fontSize: '12px', marginTop: '2px' }, describe(selected)));
      panel.appendChild(el('div', { color: '#5B6662', fontSize: '12px' }, `Pantalla: ${location.pathname}${location.search}`));

      const parent = button('↑ Coger lo que lo contiene');
      Object.assign(parent.style, { marginTop: '8px', padding: '6px 10px', fontSize: '12px' });
      parent.onclick = () => {
        if (selected?.parentElement && selected.parentElement !== document.body) {
          selected = selected.parentElement;
          place(selected);
          renderPanel();
        }
      };
      panel.appendChild(parent);

      const area = el('textarea', {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '70px',
        marginTop: '10px',
        padding: '8px 10px',
        borderRadius: '10px',
        border: '1px solid rgba(14,42,36,0.2)',
        font: '13px/1.4 system-ui, sans-serif',
        resize: 'vertical',
      }) as HTMLTextAreaElement;
      area.placeholder = '¿Qué quieres cambiar? (color, forma, tamaño, quitarlo, moverlo a…)';
      panel.appendChild(area);
      setTimeout(() => area.focus(), 0);

      const save = button('Guardar nota', true);
      Object.assign(save.style, { marginTop: '8px', width: '100%' });
      save.onclick = () => {
        if (!selected || !area.value.trim()) return area.focus();
        writeNotes([
          ...readNotes(),
          {
            route: `${location.pathname}${location.search}`,
            chain: componentChain(selected),
            details: describe(selected),
            note: area.value.trim(),
            at: new Date().toISOString(),
          },
        ]);
        selected = null;
        place(null);
        setPicking(true); // sigue señalando: lo normal es marcar varias cosas seguidas
      };
      panel.appendChild(save);
    }

    if (notes.length) {
      const foot = el('div', {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: selected ? '12px' : '0',
        paddingTop: selected ? '10px' : '0',
        borderTop: selected ? '1px solid rgba(14,42,36,0.1)' : 'none',
      });
      foot.append(el('span', { flex: '1', color: '#5B6662' }, `${notes.length} nota${notes.length > 1 ? 's' : ''} guardada${notes.length > 1 ? 's' : ''}`));
      const copy = button('Copiar todas', true);
      copy.onclick = async () => {
        await navigator.clipboard.writeText(formatNotes(readNotes()));
        copy.textContent = '¡Copiadas! Pégalas en el chat';
        setTimeout(() => (copy.textContent = 'Copiar todas'), 2500);
      };
      const clear = button('Borrar');
      clear.onclick = () => {
        if (confirm('¿Borrar todas las notas?')) {
          writeNotes([]);
          renderPanel();
          renderToggle();
        }
      };
      foot.append(copy, clear);
      panel.appendChild(foot);
    }
    panel.style.display = selected || (notes.length && !picking) ? 'block' : 'none';
    renderToggle();
  };

  const setPicking = (on: boolean) => {
    picking = on;
    if (!on && !selected) place(null);
    renderPanel();
  };

  // Mientras se señala, ningún toque llega a la app (no navega ni pulsa botones). El elemento se
  // elige al levantar el dedo o el ratón; el "click" que llega justo después también se descarta.
  let swallowUntil = 0;
  const swallow = (e: Event) => {
    if ((!picking && Date.now() > swallowUntil) || inUi(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const pick = (e: PointerEvent) => {
    if (!picking || inUi(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const t = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) ?? (e.target as HTMLElement);
    if (inUi(t)) return;
    selected = t;
    picking = false;
    swallowUntil = Date.now() + 700;
    place(t);
    renderPanel();
  };
  const hover = (e: PointerEvent) => {
    if (!picking || inUi(e.target)) return;
    place(document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && picking) setPicking(false);
  };
  const follow = () => place(selected);

  const opts = { capture: true, passive: false } as AddEventListenerOptions;
  const swallowed = ['pointerdown', 'mousedown', 'touchstart', 'mouseup', 'touchend', 'click'] as const;
  swallowed.forEach((t) => window.addEventListener(t, swallow, opts));
  window.addEventListener('pointerup', pick, opts);
  window.addEventListener('pointermove', hover, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('scroll', follow, true);
  window.addEventListener('resize', follow);

  toggle.onclick = () => {
    selected = null;
    setPicking(!picking);
  };
  renderPanel();

  return () => {
    swallowed.forEach((t) => window.removeEventListener(t, swallow, opts));
    window.removeEventListener('pointerup', pick, opts);
    window.removeEventListener('pointermove', hover, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('scroll', follow, true);
    window.removeEventListener('resize', follow);
    root.remove();
  };
}

function formatNotes(notes: Note[]): string {
  const day = new Date().toLocaleDateString('es-ES');
  return [
    `Notas sobre la app (modo Señalar) · ${day}`,
    '',
    ...notes.map((n, i) =>
      [`${i + 1}. Pantalla ${n.route}`, `   Elemento: ${n.chain}`, `   Detalles: ${n.details}`, `   Cambio: ${n.note}`].join('\n')
    ),
  ].join('\n\n');
}

export function DevInspector() {
  useEffect(() => (enabled() ? mount() : undefined), []);
  return null;
}
