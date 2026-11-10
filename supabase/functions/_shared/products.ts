// Catálogo de precios que usa el SERVIDOR para cobrar (Revolut). La app envía solo
// el id del producto; el importe sale siempre de aquí.
// Generado a partir de src/data/testCatalog.ts; si cambias un precio, cámbialo en
// los dos sitios (npm run check:prices avisa si no coinciden).
// Desde el 2026-11-08 la tienda enseña el catálogo real de paneles y las pruebas sueltas
// aún no tienen precio de venta decidido: no están aquí, así que el servidor no las cobra
// (la app simula la solicitud). Cuando haya precio, se añaden aquí y en la app.
// Desde el 2026-11-09 tampoco las suscripciones (el fundador quita su precio de la app): sin productos,
// create-checkout responde «Unknown product» a todo. Eran membership 36500 y premium 70000 céntimos/año.

export interface Product {
  name: string;
  amountCents: number;
  interval?: 'year'; // planes anuales: suscripción que se renueva cada año
}

export const PRODUCTS: Record<string, Product> = {};
