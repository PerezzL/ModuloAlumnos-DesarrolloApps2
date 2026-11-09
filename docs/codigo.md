# Mapa del código

Dónde vive cada cosa en el repo y qué hace. El porqué de cada pieza está en
[`arquitectura.md`](arquitectura.md); acá va dónde encontrarla.

## Vista general

```
├── openapi.yaml            ← contrato front ↔ BFF (fuente de verdad)
├── apps/
│   ├── web/                ← frontend: React + Vite (SPA)
│   ├── bff/                ← BFF: NestJS
│   └── core-falso/         ← Gateway, auth, notificaciones, saldo y módulos externos de mentira
├── packages/
│   ├── api-types/          ← tipos generados desde openapi.yaml (fuera de git)
│   ├── contrato/           ← valida respuestas contra openapi.yaml en los tests
│   └── fixtures/           ← JSON de ejemplo de cada módulo externo
├── docs/                   ← documentación (este archivo incluido)
├── scripts/smoke-docker.sh ← chequeos del stack de Docker (job `docker` del CI)
├── docker-compose.yml      ← core-falso, bff, prism y web con un comando
├── .github/workflows/      ← CI: `npm run verify` y el smoke de Docker
└── .env.example            ← variables de entorno de las tres apps
```

Las tres apps y los paquetes son workspaces de npm. Los scripts de la raíz (`dev`, `verify`,
`mock`, etc.) están en [`AGENTS.md`](../AGENTS.md), sección "Comandos".

## Contrato y tipos

| Dónde | Qué hace |
| --- | --- |
| [`openapi.yaml`](../openapi.yaml) | Define cada endpoint del BFF, sus modelos y los `code` de error. Todo cambio de API empieza acá |
| `packages/api-types` | `npm run gen` genera los tipos TypeScript del contrato con `openapi-typescript`. Los usan el front y el BFF |
| `packages/contrato` | `new Contrato().validar(metodo, ruta, status, body)`: valida con ajv que una respuesta cumpla el contrato. Lo usan los tests e2e del BFF |
| `redocly.yaml` | Reglas de `npm run lint:contrato` (Redocly) |

El BFF publica el mismo YAML como Swagger UI en `/docs` (`apps/bff/src/docs/docs.ts`).

## Frontend — `apps/web`

SPA en React con Vite, React Router y TanStack Query. Habla solo con el Gateway de CORE:
a `/api/v1/student/*` para lo que resuelve el BFF y directo a CORE para auth, notificaciones
y saldo.

| Carpeta (`src/`) | Qué hay |
| --- | --- |
| `main.tsx`, `rutas.tsx` | Arranque y rutas. Todo menos `/login` va dentro de `RutaProtegida` y `LayoutAutenticado` |
| `config.ts` | Variables `VITE_*`: URL del Gateway, del socket y de los portales externos |
| `sesion/` | Login, refresh serializado y logout contra CORE (`core.ts`); estado de la sesión con el token solo en memoria (`sesion.ts`); validación del dominio `@uade.edu.ar` (`mail.ts`) |
| `api/` | Cliente tipado del BFF con `openapi-fetch` (`cliente.ts`); `fetch` que agrega el token y refresca ante un 401 (`fetchConSesion.ts`); traducción de problem+json a errores (`errores.ts`) |
| `core/` | Llamadas directas a CORE fuera de la sesión: saldo, carga de saldo con `Idempotency-Key`, notificaciones. `monto.ts` maneja importes como string decimal |
| `paginas/` | Una pantalla por archivo (Inicio, Calendario, Inscripción, Historial, CursadaDetalle, NotaDetalle, Compras, CuentaCorriente, Notificaciones, Perfil, Login) |
| `calendario/`, `inscripcion/`, `cursadas/`, `compras/`, `notificaciones/` | Lo propio de cada pantalla: hooks de TanStack Query (`consultas.ts`, `useCalendario.ts`), componentes y reglas de presentación |
| `notificaciones/` | Además: socket de CORE (`useNotificacionesEnVivo.ts`) y traducción del `actionUrl` a un destino (`destino.ts`, único lugar que conoce su formato) |
| `componentes/` | Piezas compartidas: estados de carga, vacío y error, avisos, saldo del encabezado. `componentes/ui/` son los de shadcn/ui |
| `layouts/` | Sidebar y layout de las pantallas autenticadas |
| `test/` | Infraestructura de tests (ver [Mocks en los tests](#mocks-en-los-tests)) |

Los tests (`*.test.ts(x)`) están junto a lo que prueban y corren con Vitest y Testing Library.

## BFF — `apps/bff`

NestJS. Recibe por el Gateway los pedidos de `/api/v1/student/*`, llama a los módulos
externos también por el Gateway y devuelve los modelos del contrato.

| Carpeta (`src/`) | Qué hay |
| --- | --- |
| `main.ts`, `app.ts`, `app.module.ts` | Arranque. `app.ts` arma lo común a producción y a los tests: logger, correlation id, health, Swagger y el prefijo `/api/v1` |
| `config/` | Variables de entorno validadas con zod (Gateway, JWKS, issuer, audience, prefijos de cada módulo, timeout) |
| `auth/` | Guard global que valida el JWT contra el JWKS de CORE; decorador `@AlumnoActual()` que lee `X-User-Id`; `@Publico()` para lo que no requiere token |
| `gateway/` | `GatewayClient`: único cliente HTTP hacia los módulos. Arma la URL con el prefijo configurado, reenvía el token y el `X-Correlation-Id`, aplica el timeout y traduce 502, 503 y 504 |
| `comun/` | Errores problem+json (`problema.ts` y su filtro), contexto por request con `AsyncLocalStorage` (`contexto.ts`), logger, caché en memoria con TTL (`cache.ts`) y validación de parámetros |
| `modulos/` | Un adaptador por módulo externo (ver abajo) |
| `calendario/`, `inscripcion/`, `cursadas/`, `compras/`, `perfil/`, `sedes/` | Un módulo de Nest por feature: controller con los endpoints del contrato, service que combina adaptadores y funciones puras con la lógica (`oferta.ts`, `historial.ts`, `detalle.ts`, `rango.ts`) |
| `health/`, `docs/` | `GET /health/live` y `/health/ready`; Swagger UI desde `openapi.yaml` |

### Adaptadores (`src/modulos/<modulo>/`)

Cada módulo externo (`academico` = 9, `docente` = 2, `comedor` = 4, `eventos` = 6,
`tienda` = 5, `backoffice` = 8) tiene los mismos archivos:

| Archivo | Qué hace |
| --- | --- |
| `*.origen.ts` | Schema zod de la respuesta del módulo, tal como llega. No sale de la carpeta |
| `*.mapper.ts` | Función pura: respuesta del módulo → modelo propio. Si la forma no cierra, lanza 502 `UPSTREAM_INVALID` |
| `*.mapper.test.ts` | Pasa la fixture del módulo por el mapper y verifica el resultado |
| `*.adapter.ts` | Servicio de Nest que llama al `GatewayClient` y aplica el mapper |
| `*.modelo.ts` | Modelos internos, cuando el contrato no alcanza (Módulo 9 y Módulo 2) |
| `*.module.ts` | Módulo de Nest que exporta el adaptador |

`modulos/comun.ts` tiene lo compartido: validar contra el schema de origen y normalizar ids
opacos. Cuando un módulo confirma su contrato, se tocan su `origen`, su `mapper` y su fixture.

Biblioteca (Módulo 3) no tiene adaptador: el portal solo la ve por sus notificaciones.

## CORE falso — `apps/core-falso`

Express. Reemplaza en local todo lo que no es nuestro: el Gateway, la auth, las
notificaciones, el saldo y los módulos externos. Escucha en `:4000`. No se despliega.

| Archivo (`src/`) | Qué hace |
| --- | --- |
| `main.ts`, `app.ts`, `config.ts` | Arranque, armado de las rutas y configuración (puerto, `STUDENT_SERVICE_URL`, `{MODULO}_SERVICE_URL`, `CORE_FALLAS`) |
| `gateway.ts` | Valida el token, agrega `X-User-*` y `X-Correlation-Id` y reenvía según el prefijo: `/api/v1/student/*` al BFF y el resto a los módulos falsos o a un servicio real si su URL está configurada |
| `auth.ts`, `tokens.ts`, `usuarios.ts` | Login, refresh con rotación, logout y JWKS. Firma JWT RS256 con un par de claves generado al arrancar. Usuarios de prueba en `usuarios.ts` |
| `modulos/*.ts` | Un módulo externo falso por archivo. Responde sus rutas con las fixtures de `packages/fixtures`. Solo el alumno demo (`v.moreno`) tiene datos |
| `modulos/academico.ts` | Además guarda en memoria las inscripciones nuevas, para verlas después en la oferta y el historial |
| `notificaciones.ts`, `socket.ts` | `GET /api/v1/notifications` y el namespace socket.io `/notifications` |
| `saldo.ts` | Wallet, movimientos y cargas con los tokens `mock-approved`, `mock-rejected` y `mock-pending` |
| `fallas.ts` | Fallas simuladas por módulo: `caido` (503), `invalido` (502) y `lento` (504 o demora) |
| `falso.ts` | Endpoints de control `/__falso/*`: cambiar fallas en caliente, disparar notificaciones, simular la inscripción cerrada, reiniciar el estado |
| `fixtures.ts`, `paginacion.ts`, `problema.ts` | Lectura de fixtures, paginación por cursor como la de CORE y errores problem+json |

## Mocks: qué hay y dónde

Ningún módulo externo existe todavía, así que el portal se prueba contra piezas falsas.
Son cuatro, y cada una cubre un hueco distinto:

| Pieza | Reemplaza a | Se usa para | Dónde está | Detalle |
| --- | --- | --- | --- | --- |
| **Fixtures** | Las respuestas de los módulos externos | Única fuente de datos de ejemplo: las leen los tests de adaptadores, los e2e del BFF y el CORE falso | `packages/fixtures/<modulo>/` | [`packages/fixtures/README.md`](../packages/fixtures/README.md) |
| **CORE falso** | CORE completo y los módulos externos | Correr el portal de punta a punta en local y en la demo | `apps/core-falso` | [`instalacion.md`](instalacion.md#core-falso-módulos-externos-y-fallas), [`pruebas.md`](pruebas.md) |
| **Prism** | Nuestro BFF | Avanzar una pantalla antes de que exista su endpoint, con los ejemplos de `openapi.yaml` | `npm run mock` (`:4010`) | [`instalacion.md`](instalacion.md#qué-es-prism-y-para-qué-está) |
| **Mocks de tests** | El Gateway, el JWKS, el BFF y el socket | Tests automáticos sin levantar nada | `apps/bff/test/`, `apps/web/src/test/` | [abajo](#mocks-en-los-tests) |

Cómo encajan:

- **Una sola copia de los datos.** Las fixtures se escriben una vez y las leen los tests y el
  CORE falso. Si un test de adaptador pasa, el CORE falso sirve exactamente esa respuesta.
- **Misma topología que producción.** En local el navegador le habla al CORE falso como si
  fuera el Gateway real, y el BFF llama a los módulos por ese mismo Gateway. Pasar al CORE real
  es cambiar URLs, no código.
- **Provisional por defecto.** Casi todas las fixtures se llaman `*.provisional.json` porque
  el módulo no confirmó su contrato. El estado de cada uno está en
  [`integraciones.md`](integraciones.md).
- **Un módulo real a la vez.** Con `{MODULO}_SERVICE_URL`, el CORE falso reenvía ese módulo a
  un servicio real y sigue simulando el resto.
- **Fallas a demanda.** El CORE falso puede tirar un módulo (503), devolver basura (502) o
  demorarlo (504) para probar la falla parcial del calendario y del detalle de cursada.

### Mocks en los tests

| Dónde | Qué simula | Cómo |
| --- | --- | --- |
| `apps/bff/src/modulos/*/*.mapper.test.ts` | Respuesta de un módulo | Lee la fixture y la pasa por el mapper, sin red |
| `apps/bff/test/app-e2e.ts` | Gateway y JWKS de CORE | Levanta el BFF completo con `supertest`; el Gateway se simula con `msw` y los tokens se firman con un par de claves de prueba (`tokens.ts`) |
| `apps/bff/test/*-gateway.ts` | Rutas de cada módulo detrás del Gateway | Handlers de `msw` que responden con las fixtures (`fixtures.ts`) |
| `apps/bff/test/*.e2e.test.ts` | — | Prueban cada endpoint y validan sus respuestas contra `openapi.yaml` con `@uadenet/contrato` |
| `apps/web/src/test/servidor.ts` | BFF y CORE | `msw` con respuestas del contrato (`calendario.ts`, `cursadas.ts`, `inscripcion.ts`, `compras.ts`) y la auth y el saldo de CORE |
| `apps/web/src/test/socket.ts` | Socket de notificaciones | Reemplaza a `socket.io-client` (se activa en `setup.ts`) para emitir eventos y cortar la conexión |
| `apps/core-falso/src/*.test.ts` | — | Prueban el propio CORE falso: auth, Gateway, módulos, saldo y notificaciones |

En los tests de `msw`, un pedido sin handler hace fallar el test: ningún test depende de una
red real.
