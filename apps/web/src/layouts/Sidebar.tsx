import {
  BookOpen,
  Calendar,
  GraduationCap,
  Bell,
  House,
  LogOut,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import logo from '@/assets/uade-logo.png';
import { usePerfil } from '@/api/consultas';
import { cn } from '@/lib/utils';
import { useSesion } from '@/sesion/SesionProvider';

export interface ItemNavegacion {
  ruta: string;
  titulo: string;
  icono: LucideIcon;
}

export const NAVEGACION: ItemNavegacion[] = [
  { ruta: '/', titulo: 'Inicio', icono: House },
  { ruta: '/mis-cursos', titulo: 'Mis Cursos', icono: GraduationCap },
  { ruta: '/academico', titulo: 'Académico', icono: BookOpen },
  { ruta: '/calendario', titulo: 'Calendario', icono: Calendar },
  { ruta: '/cuenta-corriente', titulo: 'Cuenta Corriente', icono: Wallet },
  { ruta: '/notificaciones', titulo: 'Notificaciones', icono: Bell },
  { ruta: '/perfil', titulo: 'Perfil', icono: User },
];

function iniciales(nombre?: string, apellido?: string, email?: string) {
  if (nombre || apellido) return `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase();
  return (email?.[0] ?? '?').toUpperCase();
}

function DatosAlumno() {
  const { estado } = useSesion();
  const { data: perfil, isError } = usePerfil();
  const email = estado.tipo === 'autenticado' ? estado.usuario.email : undefined;
  // Los datos de Backoffice son provisionales: si no llegan, se muestra el mail
  const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(' ') || email;

  return (
    <div className="flex items-center gap-3 border-b border-white/10 p-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-linear-135 from-primario to-primario-oscuro text-sm font-bold text-white ring-2 ring-white/20">
        {iniciales(perfil?.nombre, perfil?.apellido, email)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{nombre}</p>
        {perfil?.carrera && <p className="truncate text-[11px] text-white/50">{perfil.carrera}</p>}
        {isError && (
          <p role="status" className="truncate text-[11px] text-white/50">
            No pudimos cargar tus datos
          </p>
        )}
        {perfil?.legajo && (
          <p className="pt-1 text-[10px]">
            <span className="font-medium uppercase tracking-[0.25px] text-white/30">Legajo</span>{' '}
            <span className="font-semibold text-white/60">{perfil.legajo}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { sesion } = useSesion();
  const navigate = useNavigate();

  const cerrarSesion = async () => {
    await sesion.cerrarSesion();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-uade-navy">
      <div className="border-b border-white/10 p-5">
        <div className="flex w-[135px] items-center justify-center rounded-campo bg-white/95 px-3 py-2 shadow-[0_2px_12px_rgb(0_0_0/0.25)]">
          <img src={logo} alt="UADE" className="h-7 w-20 object-contain" />
        </div>
        <p className="pt-2 pl-0.5 text-[9px] font-semibold uppercase tracking-[0.9px] text-white/40">
          Portal del Estudiante
        </p>
      </div>

      <DatosAlumno />

      <nav
        aria-label="Principal"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4"
      >
        {NAVEGACION.map(({ ruta, titulo, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            end={ruta === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-3 rounded-item px-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/12 text-white'
                  : 'text-white/60 hover:bg-white/6 hover:text-white',
              )
            }
          >
            <Icono className="size-[17px]" aria-hidden />
            {titulo}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 pt-3 pb-4">
        <button
          type="button"
          onClick={cerrarSesion}
          className="flex h-10 w-full items-center gap-3 rounded-item px-3 text-sm font-medium text-white/50 transition-colors hover:bg-white/6 hover:text-white"
        >
          <LogOut className="size-4" aria-hidden />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
