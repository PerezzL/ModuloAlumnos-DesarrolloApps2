import { Router, type Request, type Response } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { ALUMNO_DEMO } from './comun.js';

interface Nota {
  examId: string;
}

/**
 * Módulo 2. No hay contrato: rutas y respuestas son nuestra suposición (los schemas
 * `Asistencia` y `NotaResumen`/`NotaDetalle` de openapi.yaml). Cada nota se identifica por el
 * `examId` que llega en el `actionUrl` de la notificación de examen.
 */
export function moduloDocente() {
  const router = Router();
  const base = '/api/v1/cursos/:cursoId/alumnos/:alumnoId';

  /** Datos del curso para el alumno, o undefined si no hay */
  const delCurso = <T>(archivo: string, req: Request) => {
    if (req.params.alumnoId !== ALUMNO_DEMO) return undefined;
    const porCurso = fixture<Record<string, T>>(archivo);
    const cursoId = String(req.params.cursoId);
    return Object.hasOwn(porCurso, cursoId) ? porCurso[cursoId] : undefined;
  };
  const noInscripto = (res: Response) =>
    enviarProblema(res, 404, 'NOT_FOUND', 'El alumno no cursa ese curso');

  router.get(`${base}/asistencia`, (req, res) => {
    const asistencia = delCurso('teacher/asistencia.provisional.json', req);
    if (!asistencia) return noInscripto(res);
    res.json(asistencia);
  });

  router.get(`${base}/notas`, (req, res) => {
    const notas = delCurso<Nota[]>('teacher/notas.provisional.json', req);
    if (!notas) return noInscripto(res);
    res.json(notas);
  });

  router.get(`${base}/notas/:notaId`, (req, res) => {
    const nota = delCurso<Nota[]>('teacher/notas.provisional.json', req)?.find(
      (n) => n.examId === req.params.notaId,
    );
    if (!nota) return enviarProblema(res, 404, 'NOT_FOUND', 'Nota inexistente');
    res.json(nota);
  });

  return router;
}
