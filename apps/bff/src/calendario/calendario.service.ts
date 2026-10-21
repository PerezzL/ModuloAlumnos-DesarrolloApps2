import { Injectable, Logger } from '@nestjs/common';
import type { Calendario, CategoriaCalendario, ItemCalendario } from '@uadenet/api-types';
import { ProblemaError } from '../comun/problema';
import { AcademicoAdapter } from '../modulos/academico/academico.adapter';
import { ComedorAdapter } from '../modulos/comedor/comedor.adapter';
import { EventosAdapter } from '../modulos/eventos/eventos.adapter';
import type { Rango } from './rango';

type Fuente = Calendario['fuentes'][number];

/**
 * Calendario unificado: consulta en paralelo las fuentes pedidas y junta lo que cargó.
 * Una fuente que falla no tira abajo a las otras: se informa en `fuentes` con su `code`.
 * Solo si fallan todas es un error (503). Cada llamada está acotada por el timeout del
 * Gateway, así que una fuente lenta no demora a las demás más que eso.
 */
@Injectable()
export class CalendarioService {
  private readonly logger = new Logger(CalendarioService.name);
  private readonly fuentes: Record<
    CategoriaCalendario,
    (rango: Rango) => Promise<ItemCalendario[]>
  >;

  constructor(comedor: ComedorAdapter, eventos: EventosAdapter, academico: AcademicoAdapter) {
    this.fuentes = {
      COMEDOR: (rango) => comedor.turnos(rango),
      EVENTO: (rango) => eventos.inscriptos(rango),
      EXAMEN: (rango) => academico.turnosExamen(rango),
    };
  }

  async calendario(rango: Rango, categorias: CategoriaCalendario[]): Promise<Calendario> {
    const resultados = await Promise.allSettled(categorias.map((c) => this.fuentes[c](rango)));

    const items: ItemCalendario[] = [];
    const fuentes: Fuente[] = [];
    resultados.forEach((resultado, i) => {
      const categoria = categorias[i]!;
      if (resultado.status === 'fulfilled') {
        items.push(...resultado.value);
        fuentes.push({ categoria, estado: 'OK' });
        return;
      }
      const code =
        resultado.reason instanceof ProblemaError ? resultado.reason.code : 'ERROR_INTERNO';
      this.logger.warn(
        { err: resultado.reason, categoria, code },
        'Falló una fuente del calendario',
      );
      fuentes.push({ categoria, estado: 'ERROR', code });
    });

    if (fuentes.every((f) => f.estado === 'ERROR')) {
      throw new ProblemaError(503, 'UPSTREAM_UNAVAILABLE', 'Calendario no disponible', {
        detail: fuentes.map((f) => `${f.categoria}: ${f.code}`).join('; '),
      });
    }

    // sort es estable: a igual inicio queda el orden de las fuentes
    items.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
    return { items, fuentes };
  }
}
