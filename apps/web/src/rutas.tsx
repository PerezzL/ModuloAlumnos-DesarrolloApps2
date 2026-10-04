import type { RouteObject } from 'react-router';
import { RutaProtegida } from '@/componentes/RutaProtegida';
import { LayoutAutenticado } from '@/layouts/LayoutAutenticado';
import { Calendario } from '@/paginas/Calendario';
import { EnConstruccion } from '@/paginas/EnConstruccion';
import { Inicio } from '@/paginas/Inicio';
import { Login } from '@/paginas/Login';
import { NoEncontrada } from '@/paginas/NoEncontrada';
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
          { path: 'cuenta-corriente', element: <EnConstruccion titulo="Cuenta Corriente" /> },
          { path: 'notificaciones', element: <EnConstruccion titulo="Notificaciones" /> },
          { path: 'perfil', element: <Perfil /> },
          { path: '*', element: <NoEncontrada /> },
        ],
      },
    ],
  },
];
