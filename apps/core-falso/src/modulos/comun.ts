import type { Request } from 'express';
import { USUARIOS } from '../usuarios.js';

/** Las fixtures son de este alumno (v.moreno); los demás no tienen datos. */
export const ALUMNO_DEMO = USUARIOS[0]!.id;

/** Alumno que inyectó el Gateway */
export const usuarioDe = (req: Request) => req.header('x-user-id') ?? '';

export const esDemo = (req: Request) => usuarioDe(req) === ALUMNO_DEMO;

/** Entero positivo de la query, con valor por defecto y tope */
export function entero(valor: unknown, porDefecto: number, maximo = Infinity) {
  const n = Number(valor);
  return typeof valor === 'string' && Number.isInteger(n) && n > 0
    ? Math.min(n, maximo)
    : porDefecto;
}
