// Catálogo de precios que usa el SERVIDOR para cobrar (Revolut). La app envía solo
// el id del producto; el importe sale siempre de aquí.
// Generado a partir de src/data/testCatalog.ts; si cambias un precio, cámbialo en
// los dos sitios (npm run check:prices avisa si no coinciden).

export interface Product {
  name: string;
  amountCents: number;
  interval?: 'year'; // planes anuales: suscripción que se renueva cada año
}

export const PRODUCTS: Record<string, Product> = {
  membership: { name: 'HomeTest Basic subscription', amountCents: 36500, interval: 'year' },
  premium: { name: 'HomeTest Premium subscription', amountCents: 70000, interval: 'year' },
  essential: { name: 'Essential blood test', amountCents: 12499 },
  weight: { name: 'Weight management', amountCents: 8900 },
  performance: { name: 'Sports performance', amountCents: 9999 },
  vitamin_d: { name: 'Vitamin D', amountCents: 3999 },
  vitamin_b: { name: 'B vitamins', amountCents: 5999 },
  vitamins: { name: 'Essential vitamins', amountCents: 6999 },
  cycle_hormones: { name: 'Hormonal cycle tracking', amountCents: 13999 },
  cortisol: { name: 'Cortisol', amountCents: 4999 },
  stress: { name: 'Stress', amountCents: 7999 },
  fertility_f: { name: 'Female fertility', amountCents: 9499 },
  thyroid: { name: 'Thyroid function', amountCents: 4499 },
  thyroid_adv: { name: 'Advanced thyroid function', amountCents: 12499 },
  amh: { name: 'Ovarian reserve (AMH)', amountCents: 7499 },
  testosterone: { name: 'Testosterone', amountCents: 5499 },
  t1d_antibodies: { name: 'Type 1 diabetes antibodies', amountCents: 18900 },
  cardio: { name: 'Cardiovascular check', amountCents: 7999 },
  diabetes: { name: 'Diabetes', amountCents: 7499 },
  psa: { name: 'Prostate cancer screening', amountCents: 5499 },
  lpa: { name: 'Cardiovascular risk: Lp(a)', amountCents: 6999 },
  coeliac: { name: 'Coeliac disease', amountCents: 6999 },
  fructose: { name: 'Fructose intolerance', amountCents: 5900 },
  lactose: { name: 'Lactose intolerance', amountCents: 5900 },
  lactose_fructose: { name: 'Lactose and fructose', amountCents: 9900 },
  sibo: { name: 'SIBO', amountCents: 6800 },
  digestive_pack: { name: 'Digestive pack', amountCents: 15300 },
  sti_4: { name: '4 STI test', amountCents: 8999 },
  sti_7: { name: '7 STI test', amountCents: 11999 },
  sti_11: { name: '11 STI test', amountCents: 14999 },
  consult_digestive: { name: 'Digestive and intolerance consultation', amountCents: 9800 },
  consult_sti: { name: 'STI medical consultation', amountCents: 5000 },
};
