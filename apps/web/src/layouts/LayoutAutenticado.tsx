import { Outlet, useLocation } from 'react-router';
import { SaldoHeader } from '@/componentes/SaldoHeader';
import { AvisosProvider } from '@/componentes/Avisos';
import { Campana } from '@/notificaciones/Campana';
import { useNotificacionesEnVivo } from '@/notificaciones/useNotificacionesEnVivo';
import { NAVEGACION, Sidebar } from './Sidebar';

function tituloDe(ruta: string) {
  if (ruta === '/') return 'Inicio';
  return NAVEGACION.find((i) => i.ruta !== '/' && ruta.startsWith(i.ruta))?.titulo ?? '';
}

/** Sidebar fija y barra superior con el título y la campana (Figma, docs/pantallas.md). */
export function LayoutAutenticado() {
  return (
    <AvisosProvider>
      <Contenido />
    </AvisosProvider>
  );
}

function Contenido() {
  useNotificacionesEnVivo();
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-borde-suave bg-white px-6">
          <h1 className="text-base font-semibold">{tituloDe(pathname)}</h1>
          <div className="flex items-center gap-2">
            <SaldoHeader />
            <Campana />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
