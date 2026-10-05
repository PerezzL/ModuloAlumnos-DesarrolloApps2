import type { RouteObject } from 'react-router';
import { RutaProtegida } from '@/componentes/RutaProtegida';
import { LayoutAutenticado } from '@/layouts/LayoutAutenticado';
import { Calendario } from '@/paginas/Calendario';
import { CompraDetalle } from '@/paginas/CompraDetalle';
import { Compras } from '@/paginas/Compras';
import { CuentaCorriente } from '@/paginas/CuentaCorriente';
import { CursadaDetalle } from '@/paginas/CursadaDetalle';
import { Historial } from '@/paginas/Historial';
import { Inscripcion } from '@/paginas/Inscripcion';
import { Inicio } from '@/paginas/Inicio';
import { Login } from '@/paginas/Login';
import { NoEncontrada } from '@/paginas/NoEncontrada';
import { NotaDetalle } from '@/paginas/NotaDetalle';
import { Notificaciones } from '@/paginas/Notificaciones';
import { Perfil } from '@/paginas/Perfil';

export const rutas: RouteObject[] = [
  { path: '/login', element: <Login /> },
  {
    element: <RutaProtegida />,
    children: [
      {
        element: <LayoutAutenticado />,
        children: [
          { index: true, element: <Inicio /> },
          { path: 'mis-cursos', element: <Historial /> },
          { path: 'academico', element: <Inscripcion /> },
          { path: 'calendario', element: <Calendario /> },
          { path: 'cuenta-corriente', element: <CuentaCorriente /> },
          { path: 'compras', element: <Compras /> },
          { path: 'compras/:orderId', element: <CompraDetalle /> },
          { path: 'notificaciones', element: <Notificaciones /> },
          // Detalle de nota (4.7): destino de la notificación de examen y del detalle de cursada
          { path: 'cursadas/:cursoId/notas/:notaId', element: <NotaDetalle /> },
          // Detalle de cursada (4.5), con la ruta del contrato `/alumnos/cursos/{cursoId}`
          { path: 'alumnos/cursos/:cursoId', element: <CursadaDetalle /> },
          { path: 'perfil', element: <Perfil /> },
          { path: '*', element: <NoEncontrada /> },
        ],
      },
    ],
  },
];
