import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface Alumno {
  /** Id opaco del alumno (claim `sub`). No parsear ni asumir formato. */
  id: string;
  email?: string;
}

export interface RequestConAlumno extends Request {
  alumno?: Alumno;
}

/**
 * Inyecta el alumno autenticado. Es la única fuente del id del alumno: nunca se toma de
 * path, query ni body.
 */
export const AlumnoActual = createParamDecorator((_dato: unknown, ctx: ExecutionContext) => {
  const alumno = ctx.switchToHttp().getRequest<RequestConAlumno>().alumno;
  if (!alumno) throw new Error('AlumnoActual usado en un endpoint público');
  return alumno;
});
