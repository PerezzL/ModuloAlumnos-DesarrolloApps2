import { Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SaldoHeader } from '@/componentes/SaldoHeader';
import { Button } from '@/componentes/ui/button';
import { AvisosProvider } from '@/componentes/Avisos';
import { Campana } from '@/notificaciones/Campana';
import { useNotificacionesEnVivo } from '@/notificaciones/useNotificacionesEnVivo';
import { NAVEGACION, Sidebar } from './Sidebar';

function tituloDe(ruta: string) {
  if (ruta === '/') return 'Inicio';
  // El detalle de cursada tiene la ruta del contrato, fuera de /mis-cursos
  if (ruta.startsWith('/alumnos/cursos/')) return 'Mis Cursos';
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
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!menuAbierto) return;
    const alTecla = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAbierto(false);
    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [menuAbierto]);

  return (
    <div className="flex h-screen overflow-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-item focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Saltar al contenido
      </a>
      <Sidebar id="menu-principal" abierto={menuAbierto} cerrar={() => setMenuAbierto(false)} />
      {menuAbierto && (
        <div
          aria-hidden
          onClick={() => setMenuAbierto(false)}
          className="fixed inset-0 z-30 bg-uade-navy/40 lg:hidden"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-borde-suave bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="fantasma"
              size="icono"
              className="lg:hidden"
              aria-label="Abrir menú"
              aria-expanded={menuAbierto}
              aria-controls="menu-principal"
              onClick={() => setMenuAbierto(true)}
            >
              <Menu className="size-5" aria-hidden />
            </Button>
            <h1 className="truncate text-base font-semibold">{tituloDe(pathname)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SaldoHeader />
            <Campana />
          </div>
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 outline-none sm:p-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
