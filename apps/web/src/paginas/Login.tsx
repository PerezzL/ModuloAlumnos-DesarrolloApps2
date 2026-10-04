import { CircleAlert, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router';
import logo from '@/assets/uade-logo.png';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { ErrorLogin, type MotivoErrorLogin } from '@/sesion/core';
import { DOMINIO, esMailInstitucional } from '@/sesion/mail';
import { useSesion } from '@/sesion/SesionProvider';

const MENSAJES: Record<MotivoErrorLogin, { titulo: string; detalle: string }> = {
  // Genérico a propósito: no se dice cuál de los dos datos está mal
  CREDENCIALES_INVALIDAS: {
    titulo: 'Credenciales inválidas',
    detalle: 'El usuario o la contraseña son incorrectos. Verificá tus datos e intentá de nuevo.',
  },
  CUENTA_SUSPENDIDA: {
    titulo: 'Cuenta suspendida',
    detalle: 'Tu cuenta está suspendida. Comunicate con la universidad para reactivarla.',
  },
  DEMASIADOS_INTENTOS: {
    titulo: 'Demasiados intentos',
    detalle: 'Esperá un minuto antes de volver a intentar.',
  },
  SIN_CONEXION: {
    titulo: 'No pudimos conectarnos',
    detalle: 'Revisá tu conexión e intentá de nuevo en unos minutos.',
  },
  DESCONOCIDO: {
    titulo: 'No pudimos iniciar sesión',
    detalle: 'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.',
  },
};

export function Login() {
  const { estado, sesion } = useSesion();
  const navigate = useNavigate();
  const desde = (useLocation().state as { desde?: Location } | null)?.desde;
  const destino = desde ? `${desde.pathname}${desde.search}${desde.hash}` : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [errorMail, setErrorMail] = useState(false);
  const [error, setError] = useState<MotivoErrorLogin | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado.tipo === 'autenticado' && !enviando) return <Navigate to={destino} replace />;

  const validarMail = () => {
    const valido = esMailInstitucional(email);
    setErrorMail(!valido);
    return valido;
  };

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validarMail() || !password) return;
    setEnviando(true);
    try {
      await sesion.iniciarSesion(email.trim(), password);
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err instanceof ErrorLogin ? err.motivo : 'DESCONOCIDO');
      setEnviando(false);
    }
  };

  const mensaje = error && MENSAJES[error];

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm py-10">
        <img src={logo} alt="UADE" className="mx-auto h-[70px] w-[200px] object-contain" />

        <div className="pt-10">
          <h1 className="text-2xl font-bold">Bienvenido</h1>
          <p className="pt-1 text-sm text-texto-suave">Ingresá con tu cuenta institucional UADE</p>
        </div>

        <form onSubmit={enviar} noValidate className="pt-8">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo institucional</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3.5 size-[15px] -translate-y-1/2 text-pista"
                aria-hidden
              />
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder={`usuario${DOMINIO}`}
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => email && validarMail()}
                aria-invalid={errorMail}
                aria-describedby={errorMail ? 'error-email' : undefined}
              />
            </div>
            {errorMail && (
              <p id="error-email" className="flex items-center gap-1 text-xs text-peligro-texto">
                <CircleAlert className="size-3" aria-hidden />
                El correo debe pertenecer al dominio{' '}
                <strong className="font-semibold">{DOMINIO}</strong>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 pt-4">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3.5 size-[15px] -translate-y-1/2 text-pista"
                aria-hidden
              />
              <Input
                id="password"
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pr-11 pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={error === 'CREDENCIALES_INVALIDAS'}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-pista hover:text-texto-suave"
                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {verPassword ? <EyeOff className="size-[15px]" /> : <Eye className="size-[15px]" />}
              </button>
            </div>
          </div>

          {mensaje && (
            <div
              role="alert"
              className="mt-4 flex gap-3 rounded-campo border-[1.5px] border-[#fecaca] bg-[#fff5f5] p-3.5"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-peligro" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-peligro-texto">{mensaje.titulo}</p>
                <p className="pt-0.5 text-xs text-peligro">{mensaje.detalle}</p>
              </div>
            </div>
          )}

          {import.meta.env.DEV && (
            <p className="pt-4 text-center text-[11px] text-pista">
              Demo: <code>v.moreno@uade.edu.ar</code> / <code>uade2026</code>
            </p>
          )}

          <Button type="submit" size="lg" className="mt-4 w-full" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar al portal'}
          </Button>
        </form>
      </div>
    </div>
  );
}
