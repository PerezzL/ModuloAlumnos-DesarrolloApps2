import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv, type ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import { parse } from 'yaml';

// ajv-formats publica CommonJS: según el loader llega como función o como { default }.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as (ajv: Ajv) => Ajv;

const RUTA_CONTRATO = fileURLToPath(new URL('../../../openapi.yaml', import.meta.url));
const ID = 'openapi';

type Nodo = Record<string, unknown>;
type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
}

const escapar = (segmento: string) => segmento.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * En OpenAPI 3.0, `nullable: true` admite null aunque el schema tenga `allOf` o `$ref`.
 * Ajv solo lo aplica junto a `type`, así que se reescribe como `anyOf: [schema, null]`.
 */
function normalizarNullable(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(normalizarNullable);
  if (!nodo || typeof nodo !== 'object') return nodo;
  const copia: Nodo = {};
  for (const [clave, valor] of Object.entries(nodo)) copia[clave] = normalizarNullable(valor);
  if (copia.nullable !== true) return copia;
  const { nullable: _nullable, ...resto } = copia;
  return { anyOf: [resto, { type: 'null' }] };
}

/**
 * Valida respuestas contra los schemas de openapi.yaml (OpenAPI 3.0).
 * Se crea una vez por archivo de test; compila cada schema la primera vez que se usa.
 */
export class Contrato {
  private readonly doc: Nodo;
  private readonly ajv: Ajv;
  private readonly cache = new Map<string, ValidateFunction>();

  constructor(ruta: string = RUTA_CONTRATO) {
    this.doc = normalizarNullable(parse(readFileSync(ruta, 'utf8'))) as Nodo;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
    this.ajv.addSchema(this.doc, ID);
  }

  /**
   * Valida `body` contra la respuesta `status` de `metodo ruta`.
   * `ruta` es la del contrato, con parámetros: `/cursadas/{cursoId}`.
   */
  validar(
    metodo: Metodo,
    ruta: string,
    status: number,
    body: unknown,
    contentType?: string,
  ): ResultadoValidacion {
    const puntero = this.punteroSchema(metodo, ruta, status, contentType);
    let validar = this.cache.get(puntero);
    if (!validar) {
      validar = this.ajv.compile({ $ref: `${ID}#${puntero}` });
      this.cache.set(puntero, validar);
    }
    const valido = validar(body);
    const errores = (validar.errors ?? []).map((e) =>
      `${e.instancePath || '(raíz)'} ${e.message ?? ''}`.trim(),
    );
    return { valido, errores };
  }

  private punteroSchema(metodo: Metodo, ruta: string, status: number, contentType?: string) {
    const paths = this.doc.paths as Nodo;
    const operacion = (paths[ruta] as Nodo | undefined)?.[metodo] as Nodo | undefined;
    if (!operacion) throw new Error(`El contrato no define ${metodo.toUpperCase()} ${ruta}`);

    const respuestas = operacion.responses as Nodo;
    let respuesta = respuestas[String(status)] as Nodo | undefined;
    if (!respuesta) {
      throw new Error(`El contrato no define ${status} para ${metodo.toUpperCase()} ${ruta}`);
    }
    let base = `/paths/${escapar(ruta)}/${metodo}/responses/${status}`;
    if (typeof respuesta.$ref === 'string') {
      base = respuesta.$ref.replace(/^#/, '');
      respuesta = base
        .split('/')
        .slice(1)
        .reduce<Nodo>((nodo, clave) => nodo[clave] as Nodo, this.doc);
    }

    const contenido = respuesta.content as Nodo | undefined;
    if (!contenido) throw new Error(`La respuesta ${status} de ${ruta} no tiene cuerpo`);
    const tipo = contentType ?? Object.keys(contenido)[0];
    if (!tipo || !contenido[tipo]) {
      throw new Error(`La respuesta ${status} de ${ruta} no declara ${contentType}`);
    }
    return `${base}/content/${escapar(tipo)}/schema`;
  }
}
