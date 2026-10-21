import type { Calendario } from '@uadenet/api-types';

/** Respuesta de ejemplo de GET /calendario para octubre de 2026 */
export const calendarioOctubre: Calendario = {
  items: [
    {
      id: 'COMEDOR:b3f1c2e0-6a4d-4e1b-9c2f-1d7e8a5b3c01',
      categoria: 'COMEDOR',
      titulo: 'Turno de comedor',
      inicio: '2026-10-05T12:00:00-03:00',
      fin: '2026-10-05T12:45:00-03:00',
      todoElDia: false,
      lugar: 'Sede Monserrat',
    },
    {
      id: 'EVENTO:ev-9',
      categoria: 'EVENTO',
      titulo: 'Jornada de Desarrollo de Software',
      inicio: '2026-10-08T18:00:00-03:00',
      fin: '2026-10-08T21:00:00-03:00',
      todoElDia: false,
      lugar: 'Auditorio 2 — Monserrat',
    },
    {
      id: 'EXAMEN:turno-2026-10',
      categoria: 'EXAMEN',
      titulo: 'Mesa especial de octubre 2026',
      inicio: '2026-10-19T00:00:00-03:00',
      fin: '2026-10-23T00:00:00-03:00',
      todoElDia: true,
      lugar: null,
    },
  ],
  fuentes: [
    { categoria: 'COMEDOR', estado: 'OK' },
    { categoria: 'EVENTO', estado: 'OK' },
    { categoria: 'EXAMEN', estado: 'OK' },
  ],
};
