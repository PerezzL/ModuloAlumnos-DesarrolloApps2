import type { RouteObject } from 'react-router';
import { RutaProtegida } from '@/componentes/RutaProtegida';
import { LayoutAutenticado } from '@/layouts/LayoutAutenticado';
import { Calendario } from '@/paginas/Calendario';
import { CuentaCorriente } from '@/paginas/CuentaCorriente';
import { EnConstruccion } from '@/paginas/EnConstruccion';
import { Inicio } from '@/paginas/Inicio';
import { Login } from '@/paginas/Login';
import { NoEncontrada } from '@/paginas/NoEncontrada';
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
          { path: 'mis-cursos', element: <EnConstruccion titulo="Mis Cursos" /> },
          { path: 'academico', element: <EnConstruccion titulo="Académico" /> },
          { path: 'calendario', element: <Calendario /> },
          { path: 'cuenta-corriente', element: <CuentaCorriente /> },
          { path: 'notificaciones', element: <Notificaciones /> },
          // Detalle de nota (4.7): se arma en el bloque E. Ya existe para el deep link (H26)
          {
            path: 'cursadas/:cursoId/notas/:notaId',
            element: <EnConstruccion titulo="Detalle de la nota" />,
          },
          { path: 'perfil', element: <Perfil /> },
          { path: '*', element: <NoEncontrada /> },
        ],
      },
    ],
  },
];
