import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { pedirCore } from './http';

/**
 * Notificaciones de CORE (sección 8 de CORE_INTEGRACION.md y su OpenAPI publicado). Único lugar
 * del front que conoce la forma del ítem de CORE. El formato del `actionUrl` sigue pendiente
 * (docs/integraciones.md). El resto de la app usa `Notificacion`.
 */

export type TipoConocido =
  'TEACHER_EXAM_RESULT_PUBLISHED' | 'LIBRARY_PENALTY_APPLIED' | 'EVENT_REMINDER';

export interface Notificacion {
  id: string;
  /** Un tipo que no conocemos se muestra con la variante genérica */
  tipo: TipoConocido | (string & {});
  titulo: string;
  mensaje: string;
  actionUrl: string | null;
  leida: boolean;
  fecha: string;
}

/** Ítem de `GET /api/v1/notifications` y del evento del socket */
export interface NotificacionCore {
  id: string;
  type: string;
  title?: string | null;
  message?: string | null;
  actionUrl?: string | null;
  /** null mientras no se leyó */
  readAt?: string | null;
  createdAt: string;
}

export function aNotificacion(n: NotificacionCore): Notificacion {
  return {
    id: String(n.id),
    tipo: n.type,
    titulo: n.title ?? '',
    mensaje: n.message ?? '',
    actionUrl: n.actionUrl ?? null,
    leida: n.readAt != null,
    fecha: n.createdAt,
  };
}

interface Pagina {
  items: Notificacion[];
  siguiente: string | null;
}

export const CLAVE_LISTA = ['notificaciones', 'lista'] as const;
export const CLAVE_NO_LEIDAS = ['notificaciones', 'no-leidas'] as const;

const POR_PAGINA = 10;

export function useNotificaciones() {
  return useInfiniteQuery({
    queryKey: CLAVE_LISTA,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<Pagina> => {
      const query = new URLSearchParams({ limit: String(POR_PAGINA) });
      if (pageParam) query.set('cursor', pageParam);
      const { datos } = await pedirCore<{ items: NotificacionCore[]; nextCursor: string | null }>(
        `/api/v1/notifications?${query}`,
      );
      return { items: datos.items.map(aNotificacion), siguiente: datos.nextCursor };
    },
    getNextPageParam: (pagina) => pagina.siguiente,
  });
}

export function useNoLeidas() {
  return useQuery({
    queryKey: CLAVE_NO_LEIDAS,
    queryFn: async () =>
      (await pedirCore<{ count: number }>('/api/v1/notifications/unread-count')).datos.count,
  });
}

type Lista = InfiniteData<Pagina, string | null>;

const mapearLista = (lista: Lista | undefined, fn: (n: Notificacion) => Notificacion) =>
  lista && { ...lista, pages: lista.pages.map((p) => ({ ...p, items: p.items.map(fn) })) };

const estaEnLista = (lista: Lista | undefined, id: string) =>
  !!lista?.pages.some((p) => p.items.some((n) => n.id === id));

/**
 * Suma una notificación que llegó por el socket. Si ya estaba (llegó también por REST) no se
 * duplica. El contador sube de inmediato y después se confirma contra CORE.
 */
export function recibirNotificacion(queryClient: QueryClient, n: Notificacion) {
  const lista = queryClient.getQueryData<Lista>(CLAVE_LISTA);
  if (estaEnLista(lista, n.id)) return false;
  if (lista) {
    const [primera, ...resto] = lista.pages;
    queryClient.setQueryData<Lista>(CLAVE_LISTA, {
      ...lista,
      pages: [{ ...primera!, items: [n, ...primera!.items] }, ...resto],
    });
  }
  if (!n.leida) {
    queryClient.setQueryData<number>(CLAVE_NO_LEIDAS, (c) => (c ?? 0) + 1);
  }
  void queryClient.invalidateQueries({ queryKey: CLAVE_NO_LEIDAS });
  return true;
}

/** Vuelve a pedir listado y contador por REST (al conectar o reconectar el socket). */
export const resincronizar = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: ['notificaciones'] });

interface Previo {
  lista: Lista | undefined;
  noLeidas: number | undefined;
}

/**
 * Marcar como leídas: el cambio se ve de inmediato y, si CORE responde con error, se revierte
 * (el componente avisa con `onError`). No se reintenta sola.
 */
function useMarcar<T>(
  llamar: (arg: T) => Promise<unknown>,
  aplicar: (arg: T, previo: Previo) => { lista: Lista | undefined; noLeidas: number | undefined },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: llamar,
    retry: 0,
    onMutate: async (arg: T): Promise<Previo> => {
      await queryClient.cancelQueries({ queryKey: ['notificaciones'] });
      const previo = {
        lista: queryClient.getQueryData<Lista>(CLAVE_LISTA),
        noLeidas: queryClient.getQueryData<number>(CLAVE_NO_LEIDAS),
      };
      const nuevo = aplicar(arg, previo);
      queryClient.setQueryData(CLAVE_LISTA, nuevo.lista);
      queryClient.setQueryData(CLAVE_NO_LEIDAS, nuevo.noLeidas);
      return previo;
    },
    onError: (_error, _arg, previo) => {
      if (!previo) return;
      queryClient.setQueryData(CLAVE_LISTA, previo.lista);
      queryClient.setQueryData(CLAVE_NO_LEIDAS, previo.noLeidas);
    },
  });
}

export function useMarcarLeida() {
  return useMarcar(
    (n: Notificacion) =>
      pedirCore(`/api/v1/notifications/${encodeURIComponent(n.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      }),
    (n, previo) => ({
      lista: mapearLista(previo.lista, (x) => (x.id === n.id ? { ...x, leida: true } : x)),
      noLeidas:
        previo.noLeidas === undefined
          ? undefined
          : Math.max(0, previo.noLeidas - (n.leida ? 0 : 1)),
    }),
  );
}

export function useMarcarTodas() {
  return useMarcar(
    () => pedirCore('/api/v1/notifications/read-all', { method: 'POST' }),
    (_arg: void, previo) => ({
      lista: mapearLista(previo.lista, (x) => ({ ...x, leida: true })),
      noLeidas: previo.noLeidas === undefined ? undefined : 0,
    }),
  );
}
