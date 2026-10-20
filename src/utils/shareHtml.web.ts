// Web: el navegador no puede adjuntar un PDF generado, así que se abre el diálogo de imprimir con el HTML
// maquetado (desde ahí se guarda como PDF), en un iframe oculto, como el PDF del plan (sharePlan.web.ts).

export async function shareHtmlPdf(o: { html: string; fileName: string; fallbackText: string; dialogTitle: string }): Promise<void> {
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
  win.document.write(o.html);
  win.document.close();
  await new Promise((resolve) => setTimeout(resolve, 300));
  win.focus();
  win.print();
  setTimeout(() => iframe.remove(), 60_000);
}
