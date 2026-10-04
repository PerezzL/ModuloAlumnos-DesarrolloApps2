/** Error de validación de la query; el router lo traduce a 400 VALIDATION_ERROR */
export class QueryInvalida extends Error {}

/**
 * Paginación de CORE: `?cursor=<opaco>&limit=20`, máximo 100, respuesta
 * `{ items, nextCursor }`. El cursor del CORE falso es el desplazamiento en base64url.
 */
export function paginar<T>(todos: T[], cursor: unknown, limit: unknown) {
  const tope = limit === undefined ? 20 : Number(limit);
  if (!Number.isInteger(tope) || tope < 1 || tope > 100) {
    throw new QueryInvalida('limit debe ser un entero entre 1 y 100');
  }
  let desde = 0;
  if (cursor !== undefined) {
    desde = Number(Buffer.from(String(cursor), 'base64url').toString());
    if (!Number.isInteger(desde) || desde < 0) throw new QueryInvalida('cursor inválido');
  }
  const hasta = desde + tope;
  return {
    items: todos.slice(desde, hasta),
    nextCursor: hasta < todos.length ? Buffer.from(String(hasta)).toString('base64url') : null,
  };
}
