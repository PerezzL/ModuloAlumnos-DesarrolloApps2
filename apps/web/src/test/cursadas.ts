import type { CursadaResumen } from '@uadenet/api-types';

/** Historial como lo devuelve el BFF con las fixtures del CORE falso */
export const cursadasBase = (): CursadaResumen[] => [
  {
    cursoId: 'curso-desa1',
    asignatura: { id: 'asig-desa1', nombre: 'Desarrollo de Aplicaciones I' },
    periodo: { id: '2026-2', nombre: '2° cuatrimestre 2026' },
    notaFinal: null,
    estado: 'CURSANDO',
    enCurso: true,
  },
  {
    cursoId: 'curso-prog2',
    asignatura: { id: 'asig-prog2', nombre: 'Programación II' },
    periodo: { id: '2026-1', nombre: '1° cuatrimestre 2026' },
    notaFinal: null,
    estado: 'REGULAR',
    enCurso: false,
  },
  {
    cursoId: 'curso-ayed',
    asignatura: { id: 'asig-ayed', nombre: 'Algoritmos y Estructuras de Datos' },
    periodo: { id: '2025-2', nombre: '2° cuatrimestre 2025' },
    notaFinal: null,
    estado: 'LIBRE',
    enCurso: false,
  },
  {
    cursoId: 'curso-prog1',
    asignatura: { id: 'asig-prog1', nombre: 'Programación I' },
    periodo: { id: '2025-2', nombre: '2° cuatrimestre 2025' },
    notaFinal: 8,
    estado: 'APROBADO',
    enCurso: false,
  },
];
