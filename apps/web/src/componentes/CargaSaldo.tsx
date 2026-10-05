import { CircleCheck, Clock, CreditCard, RefreshCw, WifiOff, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorRed } from '@/api/errores';
import { ErrorCarga } from '@/componentes/ErrorCarga';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { type IntentoCarga, type MedioPago, nuevoIntento, useCargaSaldo } from '@/core/cargaSaldo';
import { formatearMonto, normalizarMonto } from '@/core/monto';
import { cn } from '@/lib/utils';

const MEDIOS: { valor: MedioPago; etiqueta: string; detalle: string }[] = [
  { valor: 'mock-approved', etiqueta: 'Tarjeta de prueba', detalle: 'Se aprueba' },
  { valor: 'mock-rejected', etiqueta: 'Tarjeta de prueba rechazada', detalle: 'Se rechaza' },
  { valor: 'mock-pending', etiqueta: 'Pago diferido de prueba', detalle: 'Queda pendiente' },
];

const SUGERIDOS = ['1000.00', '5000.00', '10000.00'];

/**
 * Carga de saldo (4.11). El portal solo arma el pedido: la lógica del cobro es de CORE.
 * Cada envío del formulario es un intento nuevo (Idempotency-Key nueva); "Reintentar" después
 * de un error repite el mismo intento con la misma key.
 */
export function CargaSaldo() {
  const [montoTexto, setMontoTexto] = useState('');
  const [medio, setMedio] = useState<MedioPago>('mock-approved');
  const [errorMonto, setErrorMonto] = useState<string | null>(null);
  const [intento, setIntento] = useState<IntentoCarga | null>(null);
  const carga = useCargaSaldo();

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const monto = normalizarMonto(montoTexto);
    if (!monto) {
      setErrorMonto('Ingresá un monto mayor a cero, con hasta dos decimales.');
      return;
    }
    setErrorMonto(null);
    const nuevo = nuevoIntento(monto, medio);
    setIntento(nuevo);
    carga.mutate(nuevo);
  };

  const reintentarMismo = () => intento && carga.mutate(intento);
  const empezarDeNuevo = () => {
    carga.reset();
    setIntento(null);
  };

  return (
    <section
      aria-labelledby="titulo-carga"
      className="rounded-campo border border-borde-suave bg-white p-6"
    >
      <h2 id="titulo-carga" className="flex items-center gap-2 pb-4 font-semibold">
        <CreditCard className="size-4 text-texto-suave" aria-hidden />
        Cargar saldo
      </h2>

      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="monto">Monto (ARS)</Label>
          <Input
            id="monto"
            inputMode="decimal"
            autoComplete="off"
            placeholder="5.000,00"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
            aria-invalid={errorMonto ? true : undefined}
            aria-describedby={errorMonto ? 'error-monto' : undefined}
          />
          {errorMonto && (
            <p id="error-monto" className="text-sm text-peligro-texto">
              {errorMonto}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {SUGERIDOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMontoTexto(m.replace('.00', ''))}
                className="rounded-full border border-borde px-3 py-1 text-xs font-medium text-etiqueta hover:bg-fondo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40"
              >
                {formatearMonto(m)}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="pb-1.5 text-sm font-medium text-etiqueta">
            Medio de pago simulado
          </legend>
          {MEDIOS.map((m) => (
            <label
              key={m.valor}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-item border px-3 py-2 text-sm has-focus-visible:ring-2 has-focus-visible:ring-primario/40',
                medio === m.valor ? 'border-primario bg-primario/5' : 'border-borde',
              )}
            >
              <input
                type="radio"
                name="medio"
                value={m.valor}
                checked={medio === m.valor}
                onChange={() => setMedio(m.valor)}
                className="accent-primario"
              />
              <span className="flex-1 font-medium">{m.etiqueta}</span>
              <span className="text-xs text-texto-suave">{m.detalle}</span>
            </label>
          ))}
        </fieldset>

        <Button type="submit" size="lg" disabled={carga.isPending}>
          {carga.isPending ? 'Procesando…' : 'Cargar saldo'}
        </Button>
      </form>

      <Resultado
        carga={carga}
        intento={intento}
        reintentar={reintentarMismo}
        empezarDeNuevo={empezarDeNuevo}
      />
    </section>
  );
}

function Resultado({
  carga,
  intento,
  reintentar,
  empezarDeNuevo,
}: {
  carga: ReturnType<typeof useCargaSaldo>;
  intento: IntentoCarga | null;
  reintentar: () => void;
  empezarDeNuevo: () => void;
}) {
  if (carga.isPending || !intento) return null;
  const monto = formatearMonto(intento.monto);

  if (carga.error instanceof ErrorRed) {
    return (
      <Aviso icono={WifiOff} tono="aviso" titulo="No pudimos confirmar la carga">
        Se cortó la conexión y no sabemos si la carga de {monto} llegó. Reintentar es seguro: no se
        va a cobrar dos veces.
        <Button variant="fantasma" onClick={reintentar} className="mt-2 self-start">
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </Button>
      </Aviso>
    );
  }
  if (carga.error) {
    return (
      <ErrorCarga
        error={carga.error}
        fuente="La carga de saldo"
        reintentar={reintentar}
        className="mt-4"
      />
    );
  }

  switch (carga.data?.tipo) {
    case 'APROBADA':
      return (
        <Aviso icono={CircleCheck} tono="exito" titulo="Carga aprobada">
          Cargaste {monto}. Tu saldo ya está actualizado.
        </Aviso>
      );
    case 'PENDIENTE':
      return (
        <Aviso icono={Clock} tono="aviso" titulo="Carga en proceso">
          La carga de {monto} quedó pendiente. Tu saldo se va a actualizar cuando se acredite.
        </Aviso>
      );
    case 'RECHAZADA':
      return (
        <Aviso icono={XCircle} tono="peligro" titulo="Carga rechazada">
          El medio de pago rechazó la carga de {monto}. No se te cobró nada.
          <Button variant="fantasma" onClick={empezarDeNuevo} className="mt-2 self-start">
            Volver a intentar
          </Button>
        </Aviso>
      );
    default:
      return null;
  }
}

const TONOS = {
  exito: 'border-exito/30 bg-exito-fondo text-exito',
  aviso: 'border-aviso/30 bg-aviso-fondo text-aviso',
  peligro: 'border-peligro/20 bg-peligro-fondo text-peligro-texto',
};

function Aviso({
  icono: Icono,
  tono,
  titulo,
  children,
}: {
  icono: typeof CircleCheck;
  tono: keyof typeof TONOS;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={cn('mt-4 flex gap-3 rounded-item border p-3', TONOS[tono])}>
      <Icono className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex flex-col text-sm">
        <p className="font-semibold">{titulo}</p>
        <div className="flex flex-col text-texto">{children}</div>
      </div>
    </div>
  );
}
