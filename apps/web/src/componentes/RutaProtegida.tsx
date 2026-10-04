import { Navigate, Outlet, useLocation } from 'react-router';
import { useSesion } from '@/sesion/SesionProvider';
import { Cargando } from './Cargando';

/**
 * Toda pantalla salvo el login exige sesión. Sin sesión lleva al login guardando la ruta
 * pedida, para volver ahí después (lo usan los deep links de notificaciones).
 */
export function RutaProtegida() {
  const { estado } = useSesion();
  const location = useLocation();

  if (estado.tipo === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Cargando texto="Recuperando tu sesión…" />
      </div>
    );
  }
  if (estado.tipo === 'anonimo') {
    return <Navigate to="/login" replace state={{ desde: location }} />;
  }
  return <Outlet />;
}
