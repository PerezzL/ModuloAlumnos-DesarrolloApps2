import { Bell } from 'lucide-react';
import { Outlet, useLocation } from 'react-router';
import { SaldoHeader } from '@/componentes/SaldoHeader';
import { Button } from '@/componentes/ui/button';
import { NAVEGACION, Sidebar } from './Sidebar';

function tituloDe(ruta: string) {
  if (ruta === '/') return 'Inicio';
  return NAVEGACION.find((i) => i.ruta !== '/' && ruta.startsWith(i.ruta))?.titulo ?? '';
}

/** Sidebar fija y barra superior con el título y la campana (Figma, docs/pantallas.md). */
export function LayoutAutenticado() {
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-borde-suave bg-white px-6">
          <h1 className="text-base font-semibold">{tituloDe(pathname)}</h1>
          <div className="flex items-center gap-2">
            <SaldoHeader />
            {/* El centro de notificaciones se arma en el bloque C */}
            <Button variant="fantasma" size="icono" aria-label="Notificaciones">
              <Bell className="size-[18px]" aria-hidden />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
