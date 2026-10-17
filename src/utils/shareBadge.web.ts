import { CARD_H, CARD_W } from '@/components/badges/BadgeShareCard';
import type { BadgeShare } from './shareBadge';

// Web: el <svg> de la tarjeta se pinta en un canvas → PNG. En el móvil (Chrome Android, Safari iOS)
// se abre el menú de compartir con la imagen (Instagram, WhatsApp, TikTok…); en el ordenador, donde
// no se pueden compartir archivos, se descarga la imagen.
export type { BadgeShare };

const toPng = (svgEl: SVGSVGElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(CARD_W));
    clone.setAttribute('height', String(CARD_H));
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = CARD_W;
      canvas.height = CARD_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas'));
      ctx.drawImage(img, 0, 0, CARD_W, CARD_H);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Could not draw the badge'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  });

export async function shareBadge({ domId, fileName, message }: BadgeShare): Promise<void> {
  const svgEl = document.getElementById(domId)?.querySelector('svg');
  if (!svgEl) return;
  const blob = await toPng(svgEl);
  const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: message });
    } catch {
      // Cancelado por el usuario
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
