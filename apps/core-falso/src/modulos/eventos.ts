import { Router } from 'express';
import { fixture } from '../fixtures.js';
import { enviarProblema } from '../problema.js';
import { esDemo } from './comun.js';

interface Evento {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  yaInscripto: boolean;
}

/**
 * Módulo 6. Filtra por solapamiento de fechas y ordena por inicio, como el servicio real.
 * `yaInscripto` de la fixture es el del alumno demo; para los demás es false.
 */
export function moduloEventos() {
  const router = Router();

  const eventos = (demo: boolean) =>
    fixture<Evento[]>('events/eventos.json').map((e) => (demo ? e : { ...e, yaInscripto: false }));

  router.get('/api/v1/eventos', (req, res) => {
    const desde = typeof req.query.desde === 'string' ? Date.parse(req.query.desde) : -Infinity;
    const hasta = typeof req.query.hasta === 'string' ? Date.parse(req.query.hasta) : Infinity;
    if (Number.isNaN(desde) || Number.isNaN(hasta)) {
      return enviarProblema(res, 400, 'VALIDATION_ERROR', 'desde y hasta deben ser ISO 8601');
    }
    res.json(
      eventos(esDemo(req))
        .filter((e) => Date.parse(e.fechaInicio) <= hasta && Date.parse(e.fechaFin) >= desde)
        .sort((a, b) => Date.parse(a.fechaInicio) - Date.parse(b.fechaInicio)),
    );
  });

  router.get('/api/v1/eventos/:id', (req, res) => {
    const evento = eventos(esDemo(req)).find((e) => e.id === req.params.id);
    if (!evento) return enviarProblema(res, 404, 'NOT_FOUND', 'Evento inexistente');
    res.json(evento);
  });

  return router;
}
