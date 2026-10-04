/**
 * Caché en memoria con TTL, por instancia. Solo para datos de baja variación
 * (correlatividades, nombres de asignatura). Guarda únicamente lo que cargó bien: un error
 * no se cachea, y si el dato no está se pide en el momento, así que ningún request depende
 * de que esté cacheado.
 */
export class CacheTtl<V> {
  private readonly datos = new Map<string, { valor: V; vence: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly ahora: () => number = Date.now,
  ) {}

  async obtener(clave: string, cargar: () => Promise<V>): Promise<V> {
    const guardado = this.datos.get(clave);
    if (guardado && guardado.vence > this.ahora()) return guardado.valor;
    const valor = await cargar();
    this.datos.set(clave, { valor, vence: this.ahora() + this.ttlMs });
    return valor;
  }
}
