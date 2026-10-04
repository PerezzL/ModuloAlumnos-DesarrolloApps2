import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { establecerSesion, sesionActual, type EstadoSesion, type Sesion } from './sesion';

const ContextoSesion = createContext<Sesion | null>(null);

export function SesionProvider({
  sesion = sesionActual(),
  children,
}: {
  sesion?: Sesion;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  establecerSesion(sesion);

  useEffect(() => {
    if (sesion.obtenerEstado().tipo === 'cargando') void sesion.iniciar();
  }, [sesion]);

  // Al terminar la sesión no puede quedar ningún dato del alumno en caché
  useEffect(
    () =>
      sesion.suscribir((estado) => {
        if (estado.tipo === 'anonimo') queryClient.clear();
      }),
    [sesion, queryClient],
  );

  return <ContextoSesion.Provider value={sesion}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): { estado: EstadoSesion; sesion: Sesion } {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error('useSesion fuera de SesionProvider');
  const estado = useSyncExternalStore(sesion.suscribir, sesion.obtenerEstado);
  return { estado, sesion };
}
