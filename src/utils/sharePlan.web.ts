import { PlanDoc, planToHtml } from './planPdf';

// Web: el navegador no puede adjuntar un fichero generado a WhatsApp o al correo, así
// que se abre el diálogo de impresión con el plan maquetado (el mismo HTML que el PDF
// del móvil) y desde ahí se guarda como PDF. Se imprime en un iframe oculto para no
// sacar la pantalla de la app en el papel.

export const planShareSupport = () => ({ sendPdf: false, print: true });

export async function printPlan(doc: PlanDoc): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    throw new Error('Could not open the print preview.');
  }
  win.document.open();
  win.document.write(planToHtml(doc));
  win.document.close();
  // Deja que el iframe pinte (SVG incluidos) antes de imprimir
  await new Promise((resolve) => setTimeout(resolve, 300));
  win.focus();
  win.print();
  setTimeout(() => iframe.remove(), 60_000);
}

export const sharePlanPdf = printPlan;
