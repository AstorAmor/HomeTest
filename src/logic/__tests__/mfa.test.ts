import { describe, expect, it } from 'vitest';
import { cleanTotpCode, groupSecret, isTotpCodeComplete, mfaGate, qrSvgFromDataUrl } from '@/logic/mfa';

describe('doble factor: qué pantalla toca al entrar', () => {
  it('con aal2 sigue, lo exija o no la cuenta', () => {
    expect(mfaGate({ required: true, currentLevel: 'aal2', nextLevel: 'aal2' })).toBeNull();
    expect(mfaGate({ required: false, currentLevel: 'aal2', nextLevel: 'aal2' })).toBeNull();
  });
  it('admin o profesional sin app de autenticación: darla de alta', () => {
    expect(mfaGate({ required: true, currentLevel: 'aal1', nextLevel: 'aal1' })).toBe('enroll');
  });
  it('con una app ya dada de alta: pedir el código (también al paciente que lo activó)', () => {
    expect(mfaGate({ required: true, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('verify');
    expect(mfaGate({ required: false, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('verify');
  });
  it('el paciente sin doble factor entra como siempre', () => {
    expect(mfaGate({ required: false, currentLevel: 'aal1', nextLevel: 'aal1' })).toBeNull();
    expect(mfaGate({ required: false, currentLevel: null, nextLevel: null })).toBeNull();
  });
});

describe('códigos y clave', () => {
  it('limpia espacios y guiones del código', () => {
    expect(cleanTotpCode('123 456')).toBe('123456');
    expect(cleanTotpCode('12-34-567')).toBe('123456');
    expect(isTotpCodeComplete('12345')).toBe(false);
    expect(isTotpCodeComplete(' 123456 ')).toBe(true);
  });
  it('agrupa la clave de 4 en 4', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
  });
  it('saca el SVG del QR, venga codificado o no', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1"/></svg>';
    expect(qrSvgFromDataUrl(`data:image/svg+xml;utf-8,${svg}`)).toBe(svg);
    expect(qrSvgFromDataUrl(`data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`)).toBe(svg);
    expect(qrSvgFromDataUrl('data:image/png;base64,AAAA')).toBeNull();
  });
});
