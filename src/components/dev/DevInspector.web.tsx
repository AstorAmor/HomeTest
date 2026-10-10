import { useEffect } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { TABS } from '@/components/BottomTabBar';
import { WEB_SHELL_ON } from '@/web/webMode';

// Modo "Señalar" (solo web): una barra flotante para tocar cualquier cosa de la app, escribir qué
// quieres cambiar y copiar todas las notas para pegárselas a Claude. Nunca bloquea la app: tras
// elegir un elemento todo vuelve a funcionar, y las notas se guardan aunque cierres las ventanas. Cada nota lleva la pantalla,
// el componente de React que lo pinta (p. ej. "CheckInScreen › MoodOrb"), el icono, el texto, los
// colores y el tamaño, así se encuentra en el código sin adivinar.
// Se ve en el servidor local y, desde 2026-10-10, en las webs publicadas por defecto (para
// recoger comentarios). ?inspect=0 lo quita en ese navegador y ?inspect=1 lo vuelve a poner.
// Todo es DOM directo: no toca el árbol de React Native ni la navegación.

const NOTES_KEY = 'kuova.inspector.notes';
// El portal del médico tiene su propia lista de notas (se revisa aparte, sobre todo en el ordenador)
const PORTAL_NOTES_KEY = 'kuova.inspector.notes.portal';
const ON_KEY = 'kuova.inspector';

// ¿Estamos en el portal del especialista? (/pro, /pro-…, o chat/vídeo abiertos desde el portal)
const isPortal = () => /^\/pro(-|\/|$)/.test(location.pathname) || new URLSearchParams(location.search).get('side') === 'pro';
const notesKey = () => (isPortal() ? PORTAL_NOTES_KEY : NOTES_KEY);
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

// Pantalla legible: las pestañas de abajo comparten la ruta "/", así que se añade cuál es
function screenLabel(): string {
  const path = `${location.pathname}${location.search}`;
  if (location.pathname === '/' || location.pathname === '/(tabs)') {
    const n = Number(new URLSearchParams(location.search).get('tab') ?? 0) || 0;
    return `${path} (pestaña ${TABS[n]?.label ?? TABS[0].label})`;
  }
  return path;
}

function readNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(notesKey()) ?? '[]');
  } catch {
    return [];
  }
}
function writeNotes(notes: Note[]) {
  try {
    localStorage.setItem(notesKey(), JSON.stringify(notes));
  } catch {
    // sin almacenamiento (modo privado): las notas viven mientras la página esté abierta
  }
}

function enabled(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('inspect');
    // Activo por defecto (se enseña la app para recoger comentarios); ?inspect=0 lo quita en ese navegador
    if (q === '1') localStorage.setItem(ON_KEY, '1');
    if (q === '0') localStorage.setItem(ON_KEY, '0');
    return __DEV__ || localStorage.getItem(ON_KEY) !== '0';
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

// Flujo pensado para no bloquear nunca la app:
// 1. "🎯 Señalar" → el siguiente toque elige un elemento (solo ese toque se lo queda el inspector).
// 2. Sale una tarjeta para comentar junto al elemento. Mientras está abierta, la app sigue
//    funcionando: puedes hacer scroll, pulsar, navegar…
// 3. "Guardar" (o cerrar con texto escrito) guarda la nota; cerrar nunca pierde lo escrito.
// 4. "💬 Notas" abre o cierra la lista cuando quieras: editar, borrar una, copiar todas.
//    Cerrar la lista no borra nada (se guarda en este navegador).
function mount(): () => void {
  const root = el('div', { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483646' });
  root.setAttribute('data-kuova-inspector', '');
  document.body.appendChild(root);
  const narrow = () => window.innerWidth < 640;

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

  const card = (extra: Partial<CSSStyleDeclaration>) =>
    el('div', {
      position: 'fixed',
      background: '#fff',
      color: INK,
      borderRadius: '16px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      padding: '14px',
      font: '13px/1.45 system-ui, sans-serif',
      pointerEvents: 'auto',
      display: 'none',
      boxSizing: 'border-box',
      ...extra,
    });

  // Barra flotante: Señalar · Notas · minimizar (por encima de la barra de pestañas de la app)
  const dock = el('div', {
    position: 'fixed',
    left: '12px',
    bottom: '96px',
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    pointerEvents: 'auto',
  });
  const pickBtn = button('');
  const notesBtn = button('');
  const minBtn = button('–');
  [pickBtn, notesBtn, minBtn].forEach((b) => (b.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'));
  minBtn.title = 'Minimizar';
  dock.append(pickBtn, notesBtn, minBtn);
  const bubble = button('🎯');
  Object.assign(bubble.style, {
    position: 'fixed',
    left: '12px',
    bottom: '96px',
    minWidth: '40px',
    height: '40px',
    padding: '0 10px',
    display: 'none',
    pointerEvents: 'auto',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
  });
  bubble.title = 'Modo Señalar';
  // Vistas de escritorio con menú lateral (web del paciente y portal del médico) frente a la app.
  const placeDock = () => {
    const wide = window.innerWidth >= 900;
    const portal = wide && /^\/pro(-|$|\/)/.test(window.location.pathname);
    const shell = wide && WEB_SHELL_ON && !portal;
    // Web del paciente: arriba a la derecha; portal: abajo, junto a su menú (arriba tiene botones);
    // vista de app: abajo a la izquierda, por encima de las pestañas
    const pos = shell
      ? { left: 'auto', bottom: 'auto', right: '20px', top: '14px' }
      : { left: portal ? '248px' : '12px', bottom: portal ? '16px' : '96px', right: 'auto', top: 'auto' };
    Object.assign(dock.style, pos);
    Object.assign(bubble.style, pos);
    Object.assign(
      toast.style,
      shell ? { left: 'auto', bottom: 'auto', right: '20px', top: '60px' } : { ...pos, bottom: portal ? '62px' : '142px' },
    );
  };
  const toast = el('div', {
    position: 'fixed',
    left: '12px',
    bottom: '142px',
    background: INK,
    color: '#FAF7EF',
    font: '600 12px system-ui, sans-serif',
    padding: '8px 12px',
    borderRadius: '10px',
    pointerEvents: 'none',
    display: 'none',
  });
  placeDock();
  window.addEventListener('resize', placeDock);
  const dockTimer = setInterval(placeDock, 800);
  root.append(dock, bubble, toast);

  const composer = card({ width: 'min(360px, calc(100vw - 24px))' });
  const drawer = card({ right: '12px', bottom: '12px', width: 'min(400px, calc(100vw - 24px))', maxHeight: '70vh', overflowY: 'auto' });
  composer.setAttribute('data-kuova-composer', '');
  drawer.setAttribute('data-kuova-drawer', '');
  root.append(composer, drawer);

  let picking = false;
  let selected: HTMLElement | null = null;
  let draft = '';
  let drawerOpen = false;
  let minimized = false;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const inUi = (t: EventTarget | null) => t instanceof Node && root.contains(t);

  const showToast = (text: string) => {
    toast.textContent = text;
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.style.display = 'none'), 2200);
  };

  const place = (target: HTMLElement | null) => {
    if (!target || !target.isConnected) {
      box.style.display = tag.style.display = 'none';
      return;
    }
    const r = target.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    tag.textContent = componentChain(target).split(' › ').pop() ?? '';
    Object.assign(tag.style, { display: 'block', left: `${Math.max(4, r.left)}px`, top: `${Math.max(4, r.top - 22)}px` });
  };

  // La tarjeta de comentar va junto al elemento (debajo o encima); en pantallas estrechas, abajo
  const placeComposer = () => {
    if (composer.style.display === 'none') return;
    if (narrow() || !selected?.isConnected) {
      Object.assign(composer.style, { left: '12px', right: 'auto', top: 'auto', bottom: '12px' });
      return;
    }
    const r = selected.getBoundingClientRect();
    const h = composer.offsetHeight || 260;
    const w = composer.offsetWidth || 360;
    const below = r.bottom + 10 + h < window.innerHeight;
    const top = below ? r.bottom + 10 : Math.max(12, r.top - 10 - h);
    const left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
    Object.assign(composer.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
  };

  const renderDock = () => {
    const n = readNotes().length;
    // Portal en escritorio: no hay pestañas abajo; la barra va abajo, a la derecha de la barra lateral (230 px)
    const desk = isPortal() && window.innerWidth >= 900;
    const left = desk ? '246px' : '12px';
    Object.assign(dock.style, { left, bottom: desk ? '16px' : '96px' });
    Object.assign(bubble.style, { left, bottom: desk ? '16px' : '96px' });
    Object.assign(toast.style, { left, bottom: desk ? '62px' : '142px' });
    pickBtn.textContent = picking ? '✕ Cancelar (Esc)' : '🎯 Señalar';
    pickBtn.style.background = picking ? GOLD : '#fff';
    notesBtn.textContent = `💬 Notas${n ? ` · ${n}` : ''}`;
    notesBtn.style.background = drawerOpen ? '#F3EBDD' : '#fff';
    dock.style.display = minimized ? 'none' : 'flex';
    bubble.style.display = minimized ? 'block' : 'none';
    bubble.textContent = n ? `🎯 ${n}` : '🎯';
  };

  const saveSelected = () => {
    if (!selected || !draft.trim()) return false;
    writeNotes([
      ...readNotes(),
      {
        route: screenLabel(),
        chain: componentChain(selected),
        details: describe(selected),
        note: draft.trim(),
        at: new Date().toISOString(),
      },
    ]);
    return true;
  };

  // Cerrar la tarjeta: si había texto, se guarda como nota (nunca se pierde lo escrito)
  const closeComposer = () => {
    const saved = saveSelected();
    selected = null;
    draft = '';
    composer.style.display = 'none';
    place(null);
    if (saved) showToast(`Nota guardada · ${readNotes().length} en total`);
    renderDock();
    if (drawerOpen) renderDrawer();
  };

  const renderComposer = () => {
    composer.replaceChildren();
    if (!selected) {
      composer.style.display = 'none';
      return;
    }
    const head = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' });
    head.append(el('strong', { fontSize: '14px' }, 'Comentar este elemento'));
    const close = button('✕');
    close.title = 'Cerrar (lo escrito se guarda)';
    close.onclick = closeComposer;
    head.appendChild(close);
    composer.appendChild(head);
    composer.appendChild(el('div', { marginTop: '6px', fontWeight: '600', wordBreak: 'break-word' }, componentChain(selected)));
    composer.appendChild(el('div', { color: '#5B6662', fontSize: '12px', marginTop: '2px' }, describe(selected)));
    composer.appendChild(el('div', { color: '#5B6662', fontSize: '12px' }, `Pantalla: ${screenLabel()}`));

    const parent = button('↑ Coger lo que lo contiene');
    Object.assign(parent.style, { marginTop: '8px', padding: '6px 10px', fontSize: '12px' });
    parent.onclick = () => {
      if (selected?.parentElement && selected.parentElement !== document.body) {
        selected = selected.parentElement;
        place(selected);
        renderComposer();
      }
    };
    composer.appendChild(parent);

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
    area.value = draft;
    area.oninput = () => (draft = area.value);
    area.onkeydown = (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) closeComposer();
    };
    composer.appendChild(area);

    const row = el('div', { display: 'flex', gap: '8px', marginTop: '8px' });
    const save = button('Guardar nota', true);
    save.style.flex = '1';
    save.onclick = () => {
      if (!draft.trim()) return area.focus();
      closeComposer();
    };
    const discard = button('Descartar');
    discard.onclick = () => {
      draft = '';
      closeComposer();
    };
    row.append(save, discard);
    composer.appendChild(row);
    composer.appendChild(
      el('div', { color: '#8A938F', fontSize: '11px', marginTop: '6px' }, 'La app sigue funcionando con esto abierto. Cerrar con ✕ guarda lo escrito.')
    );
    composer.style.display = 'block';
    placeComposer();
    setTimeout(() => {
      placeComposer();
      area.focus();
    }, 0);
  };

  const renderDrawer = () => {
    drawer.replaceChildren();
    drawer.style.display = drawerOpen ? 'block' : 'none';
    if (!drawerOpen) return;
    const notes = readNotes();
    const head = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px' });
    head.append(el('strong', { fontSize: '14px' }, `${isPortal() ? 'Notas · portal del médico' : 'Notas'} (${notes.length})`));
    const close = button('✕');
    close.title = 'Cerrar (las notas se quedan guardadas)';
    close.onclick = () => {
      drawerOpen = false;
      renderDrawer();
      renderDock();
    };
    head.appendChild(close);
    drawer.appendChild(head);
    if (!notes.length) {
      drawer.appendChild(el('div', { color: '#5B6662' }, 'Aún no hay notas. Pulsa 🎯 Señalar y toca algo de la app.'));
      return;
    }
    notes.forEach((n, i) => {
      const item = el('div', { borderTop: i ? '1px solid rgba(14,42,36,0.1)' : 'none', padding: '8px 0' });
      const top = el('div', { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' });
      top.append(el('span', { fontWeight: '700', fontSize: '12px', wordBreak: 'break-word' }, `${i + 1}. ${n.route} · ${n.chain.split(' › ').pop()}`));
      const del = el('button', { border: 'none', background: 'none', color: '#B3402F', cursor: 'pointer', font: '600 12px system-ui, sans-serif' }, 'Borrar');
      del.onclick = () => {
        writeNotes(readNotes().filter((_, j) => j !== i));
        renderDrawer();
        renderDock();
      };
      top.appendChild(del);
      item.appendChild(top);
      const text = el('textarea', {
        display: 'block',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '44px',
        marginTop: '4px',
        padding: '6px 8px',
        borderRadius: '8px',
        border: '1px solid rgba(14,42,36,0.15)',
        font: '13px/1.4 system-ui, sans-serif',
        resize: 'vertical',
      }) as HTMLTextAreaElement;
      text.value = n.note;
      // Editar una nota se guarda al momento
      text.oninput = () => {
        const all = readNotes();
        if (all[i]) {
          all[i] = { ...all[i], note: text.value };
          writeNotes(all);
        }
      };
      item.appendChild(text);
      drawer.appendChild(item);
    });
    const foot = el('div', { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' });
    const copy = button('Copiar todas', true);
    copy.onclick = async () => {
      await navigator.clipboard.writeText(formatNotes(readNotes().filter((x) => x.note.trim())));
      copy.textContent = '¡Copiadas! Pégalas en el chat';
      setTimeout(() => (copy.textContent = 'Copiar todas'), 2500);
    };
    const clear = button('Borrar todas');
    clear.onclick = () => {
      if (confirm('¿Borrar todas las notas?')) {
        writeNotes([]);
        renderDrawer();
        renderDock();
      }
    };
    // Descargar como .md: para mandar las notas por correo (p. ej. al asesor médico)
    const download = button('Descargar .md');
    download.onclick = () => {
      const blob = new Blob([formatNotes(readNotes().filter((x) => x.note.trim()))], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `notas-${isPortal() ? 'portal-medico' : 'app'}-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    foot.append(copy, download, clear);
    drawer.appendChild(foot);
  };

  const setPicking = (on: boolean) => {
    picking = on;
    if (!on && !selected) place(null);
    renderDock();
  };

  // Solo mientras se señala, el toque no llega a la app (no navega ni pulsa botones). El elemento
  // se elige al levantar el dedo o el ratón; el "click" que llega justo después también se descarta.
  // En cuanto se elige, la app vuelve a funcionar con normalidad.
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
    if (selected && draft.trim()) saveSelected(); // si había otra a medias, se guarda
    selected = t;
    draft = '';
    swallowUntil = Date.now() + 700;
    setPicking(false);
    place(t);
    renderComposer();
  };
  const hover = (e: PointerEvent) => {
    if (!picking || inUi(e.target)) return;
    place(document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (picking) setPicking(false);
    else if (selected) closeComposer();
  };
  const follow = () => {
    place(selected);
    placeComposer();
  };
  // Al cambiar el ancho, el portal pasa de barra lateral a pestañas abajo: recolocar la barra
  const onResize = () => {
    follow();
    renderDock();
  };

  const opts = { capture: true, passive: false } as AddEventListenerOptions;
  const swallowed = ['pointerdown', 'mousedown', 'touchstart', 'mouseup', 'touchend', 'click'] as const;
  swallowed.forEach((t) => window.addEventListener(t, swallow, opts));
  window.addEventListener('pointerup', pick, opts);
  window.addEventListener('pointermove', hover, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('scroll', follow, true);
  window.addEventListener('resize', onResize);

  pickBtn.onclick = () => setPicking(!picking);
  notesBtn.onclick = () => {
    drawerOpen = !drawerOpen;
    renderDrawer();
    renderDock();
  };
  minBtn.onclick = () => {
    minimized = true;
    setPicking(false);
  };
  bubble.onclick = () => {
    minimized = false;
    renderDock();
  };
  renderDock();

  // Al cambiar de pantalla (app ↔ portal) cambian la lista de notas y el sitio de la barra
  let lastPath = location.pathname + location.search;
  const routeTimer = setInterval(() => {
    const now = location.pathname + location.search;
    if (now === lastPath) return;
    lastPath = now;
    renderDock();
    if (drawerOpen) renderDrawer();
  }, 800);

  return () => {
    clearInterval(routeTimer);
    swallowed.forEach((t) => window.removeEventListener(t, swallow, opts));
    window.removeEventListener('pointerup', pick, opts);
    window.removeEventListener('pointermove', hover, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('scroll', follow, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('resize', placeDock);
    clearInterval(dockTimer);
    clearTimeout(toastTimer);
    root.remove();
  };
}

function formatNotes(notes: Note[]): string {
  const day = new Date().toLocaleDateString('es-ES');
  return [
    `${isPortal() ? 'Notas sobre el portal del médico' : 'Notas sobre la app'} (modo Señalar) · ${day}`,
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
