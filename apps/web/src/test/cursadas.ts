import type { CursadaDetalle, CursadaResumen, NotaDetalle } from '@uadenet/api-types';

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

/** Detalle de Desarrollo de Aplicaciones I como lo devuelve el BFF */
export const cursadaDetalleBase = (): CursadaDetalle => ({
  ...cursadasBase()[0]!,
  comision: 'A - Noche',
  asistencia: {
    clasesDictadas: 3,
    presentes: 2,
    ausentes: 1,
    porcentaje: 66.67,
    limiteInasistencias: 4,
    inasistenciasRestantes: 3,
    clases: [
      { fecha: '2026-08-12', presente: true },
      { fecha: '2026-08-19', presente: false },
      { fecha: '2026-08-26', presente: true },
    ],
  },
  notas: [
    {
      notaId: 'exam-desa1-p1',
      instancia: 'PARCIAL',
      titulo: '1er parcial',
      fecha: '2026-09-23',
      nota: 4,
      resultado: 'DESAPROBADO',
    },
    {
      notaId: 'exam-desa1-r1',
      instancia: 'RECUPERATORIO',
      titulo: 'Recuperatorio 1er parcial',
      fecha: '2026-10-28',
      nota: null,
    },
  ],
  fuentesConError: [],
});

/** Detalle del 1er parcial de Desarrollo de Aplicaciones I como lo devuelve el BFF */
export const notaDetalleBase = (): NotaDetalle => ({
  ...cursadaDetalleBase().notas![0]!,
  cursoId: 'curso-desa1',
  asignatura: { id: 'asig-desa1', nombre: 'Desarrollo de Aplicaciones I' },
  comision: 'A - Noche',
  docente: 'Lic. Martín Sosa',
  observaciones: 'Revisar normalización.',
});
