/**
 * Reemplazo de socket.io-client para los tests (se activa en setup.ts). Permite simular lo que
 * hace CORE: aceptar o rechazar el handshake, emitir eventos y cortar la conexión.
 */
type Manejador = (...args: unknown[]) => void;

export class SocketFalso {
  connected = false;
  /** Como en socket.io: false después de un rechazo del middleware o de disconnect() */
  active = true;
  conexiones = 0;
  cerrado = false;
  private readonly manejadores = new Map<string, Manejador[]>();

  constructor(
    readonly url: string,
    readonly opciones: { auth?: (cb: (datos: { token: string | null }) => void) => void },
  ) {}

  on(evento: string, fn: Manejador) {
    this.manejadores.set(evento, [...(this.manejadores.get(evento) ?? []), fn]);
    return this;
  }

  /** Token que mandaría el cliente en el handshake */
  tokenDelHandshake() {
    let token: string | null = null;
    this.opciones.auth?.((datos) => (token = datos.token));
    return token;
  }

  /** CORE emite un evento al cliente */
  simular(evento: string, ...args: unknown[]) {
    for (const fn of this.manejadores.get(evento) ?? []) fn(...args);
  }

  simularConexion() {
    this.connected = true;
    this.active = true;
    this.conexiones++;
    this.simular('connect');
  }

  simularCorte() {
    this.connected = false;
    this.simular('disconnect', 'transport close');
  }

  simularRechazo() {
    this.connected = false;
    this.active = false;
    this.simular('connect_error', new Error('AUTH_TOKEN_INVALID'));
  }

  connect() {
    this.active = true;
    this.reconexionesPedidas++;
    return this;
  }

  reconexionesPedidas = 0;

  disconnect() {
    this.connected = false;
    this.active = false;
    this.cerrado = true;
    return this;
  }
}

export const sockets: SocketFalso[] = [];

export function io(url: string, opciones: ConstructorParameters<typeof SocketFalso>[1]) {
  const socket = new SocketFalso(url, opciones);
  sockets.push(socket);
  return socket;
}

export const ultimoSocket = () => sockets.at(-1);
