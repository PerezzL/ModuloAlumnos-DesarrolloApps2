import { ListaNotificaciones } from '@/notificaciones/ListaNotificaciones';

/** Centro de notificaciones (4.6), en página completa. */
export function Notificaciones() {
  return (
    <section className="max-w-3xl rounded-campo border border-borde-suave bg-white p-4">
      <ListaNotificaciones paginar />
    </section>
  );
}
