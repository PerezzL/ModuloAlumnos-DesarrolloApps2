import type { OfertaInscripcion } from '@uadenet/api-types';

/** Oferta como la devuelve el BFF con las fixtures del CORE falso (1° cuatrimestre 2027). */
export const ofertaBase = (): OfertaInscripcion => ({
  periodo: { id: '2027-1', nombre: '1° cuatrimestre 2027' },
  inscripcionDesde: '2026-09-28T12:00:00.000Z',
  inscripcionHasta: '2026-12-19T02:59:59.000Z',
  inscripcionAbierta: true,
  filtradaPorPlan: true,
  materias: [
    {
      asignatura: {
        id: 'asig-ayed',
        codigo: '3.4.070',
        nombre: 'Algoritmos y Estructuras de Datos',
      },
      bloqueada: false,
      comisiones: [
        {
          cursoId: 'curso-ayed-a',
          nombre: 'A - Mañana',
          cupoMaximo: 40,
          inscriptosActivos: 40,
          estado: 'SIN_CUPO',
        },
        {
          cursoId: 'curso-ayed-b',
          nombre: 'B - Noche',
          cupoMaximo: 40,
          inscriptosActivos: 22,
          estado: 'CON_CUPO',
        },
      ],
    },
    {
      asignatura: { id: 'asig-so', codigo: '3.4.074', nombre: 'Sistemas Operativos' },
      bloqueada: false,
      comisiones: [
        {
          cursoId: 'curso-so-a',
          nombre: 'A - Noche',
          cupoMaximo: 45,
          inscriptosActivos: 10,
          estado: 'CON_CUPO',
        },
      ],
    },
  ],
});
