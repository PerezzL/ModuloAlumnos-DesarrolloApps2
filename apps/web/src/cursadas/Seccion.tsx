import type { ReactNode } from 'react';

/** Sección del detalle de cursada, con su título como nombre accesible */
export function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-campo border border-borde-suave bg-white p-6"
    >
      <h3 id={id} className="text-base font-semibold">
        {titulo}
      </h3>
      {children}
    </section>
  );
}
