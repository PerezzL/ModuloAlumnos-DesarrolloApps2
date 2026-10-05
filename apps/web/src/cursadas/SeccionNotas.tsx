import type { NotaResumen } from '@uadenet/api-types';
import { FileText } from 'lucide-react';
import { Link } from 'react-router';
import { EstadoVacio } from '@/componentes/EstadoVacio';
import { INSTANCIA, notaLegible, resultadoLegible, rutaNota } from './examen';
import { fechaLarga } from './formato';
import { Seccion } from './Seccion';

/** Notas de parciales, recuperatorios y finales (4.5). Cada una lleva a su detalle (4.7). */
export function SeccionNotas({ cursoId, notas }: { cursoId: string; notas: NotaResumen[] }) {
  return (
    <Seccion id="titulo-notas" titulo="Notas">
      {notas.length === 0 ? (
        <EstadoVacio
          icono={FileText}
          titulo="Todavía no tenés notas"
          mensaje="Cuando el docente cargue la nota de un examen, la vas a ver acá."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Notas de la cursada</caption>
            <thead className="border-b border-borde-suave text-xs uppercase tracking-wide text-texto-suave">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Examen
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Instancia
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Fecha
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Nota
                </th>
                <th scope="col" className="py-2 font-medium">
                  Resultado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde-suave">
              {notas.map((n) => (
                <tr key={n.notaId}>
                  <td className="py-3 pr-4">
                    <Link
                      to={rutaNota(cursoId, n.notaId)}
                      className="font-semibold text-primario-oscuro hover:underline"
                    >
                      {n.titulo ?? INSTANCIA[n.instancia]}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{INSTANCIA[n.instancia]}</td>
                  <td className="py-3 pr-4">{n.fecha ? fechaLarga(n.fecha) : '—'}</td>
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                    {notaLegible(n.nota)}
                  </td>
                  <td className="py-3">{resultadoLegible(n.resultado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Seccion>
  );
}
