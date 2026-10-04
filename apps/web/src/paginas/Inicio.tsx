import { usePerfil } from '@/api/consultas';
import { useSesion } from '@/sesion/SesionProvider';

/** Esqueleto del Home. El contenido (saldo, próximos eventos, accesos) llega en el bloque C. */
export function Inicio() {
  const { estado } = useSesion();
  const { data: perfil } = usePerfil();
  const nombre = perfil?.nombre ?? (estado.tipo === 'autenticado' ? estado.usuario.email : '');

  return (
    <section>
      <h2 className="text-2xl font-bold">Hola, {nombre} 👋</h2>
      <p className="pt-1 text-sm text-texto-suave">
        {new Intl.DateTimeFormat('es-AR', { dateStyle: 'full' }).format(new Date())}
      </p>
    </section>
  );
}
