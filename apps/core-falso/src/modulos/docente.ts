import { Router, type Request, type Response } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { ALUMNO_DEMO } from './comun.js';

interface Resultado {
  courseId: string | number;
}

/**
 * Módulo 2, con las rutas por alumno de su OpenAPI (`teacher-service`). Los `courseId` de las
 * fixtures son los de las fixtures académicas: en el Módulo 2 son enteros, pero el id es el
 * mismo que en el Módulo 9.
 */
export function moduloDocente() {
  const router = Router();
  const base = '/api/v1/students/:studentId/courses/:courseId';

  /** Respuesta del curso para el alumno, o undefined si no cursa ahí */
  const delCurso = (archivo: string, req: Request) => {
    if (req.params.studentId !== ALUMNO_DEMO) return undefined;
    const porCurso = fixture<Record<string, unknown>>(archivo);
    const courseId = String(req.params.courseId);
    return Object.hasOwn(porCurso, courseId) ? porCurso[courseId] : undefined;
  };
  const noInscripto = (res: Response) =>
    enviarProblema(res, 404, 'NOT_FOUND', 'El alumno no cursa ese curso');

  router.get(`${base}/attendance`, (req, res) => {
    const asistencia = delCurso('teacher/attendance.json', req);
    if (!asistencia) return noInscripto(res);
    res.json(asistencia);
  });

  router.get(`${base}/grades`, (req, res) => {
    const notas = delCurso('teacher/grades.json', req);
    if (!notas) return noInscripto(res);
    res.json(notas);
  });

  /** Resultados de actas del alumno; `courseId` los filtra. Sin resultados, lista vacía. */
  router.get('/api/v1/students/:studentId/results', (req, res) => {
    const porAlumno = fixture<Record<string, Resultado[]>>('teacher/results.json');
    const { studentId } = req.params;
    const resultados = Object.hasOwn(porAlumno, studentId) ? porAlumno[studentId]! : [];
    const { courseId } = req.query;
    res.json(
      courseId === undefined
        ? resultados
        : resultados.filter((r) => String(r.courseId) === String(courseId)),
    );
  });

  return router;
}
