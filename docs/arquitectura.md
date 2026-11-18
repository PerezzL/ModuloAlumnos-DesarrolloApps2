# Arquitectura del Módulo 1

## Enfoque

El Portal del Estudiante es un Frontend + BFF (Backend For Frontend) que agrega información:
no es dueño de los datos académicos. Combina dos estilos de comunicación:

- **REST síncrono** para consultas y acciones: oferta e inscripción, historial y asistencia,
  calendario, compras, saldo.
- **Tiempo real** para notificaciones, por WebSocket, con el frontend conectado directo a CORE.
  El backend del Módulo 1 no es consumer de eventos.

## Capas

- **Frontend (SPA)**: HTTP/REST hacia el BFF para lo que agrega o traduce; HTTP/REST directo
  a CORE (por Gateway) para auth, notificaciones y saldo; `socket.io-client` directo a CORE
  para notificaciones en tiempo real.
- **BFF**: REST hacia el Gateway de CORE, que es el único punto de entrada hacia otros módulos.
  Cachea datos de baja variación (correlatividades, nombres de asignatura).
- **Gateway de CORE**: enruta cada petición al microservicio destino según un prefijo fijo.
- **Microservicios**: Gestión Académica (9), Docente (2), Biblioteca (3), Comedor (4),
  Tienda (5), Eventos (6), Backoffice (8). CORE gestiona además auth, notificaciones y saldo.

## Cómo viaja un pedido

El navegador siempre le habla a un solo servidor: CORE. El BFF queda detrás del Gateway y
el alumno nunca lo llama directo (regla 2 del contrato de CORE: "tu portal nunca llama a tu
backend directo").

### Camino 1: lo que agrega o traduce el BFF

Calendario, inscripción, historial y compras. Ejemplo con el calendario:

```
        Navegador (React)
            │  ▲
          1 │  │ 8
            ▼  │
        Gateway de CORE
            │  ▲
          2 │  │ 7
            ▼  │
        BFF (NestJS)
            │  ▲
          3 │  │ 6
            ▼  │
        Gateway de CORE
            │  ▲
          4 │  │ 5
            ▼  │
   Comedor · Eventos · Gestión Académica
```

1. El front llama a `GET {GATEWAY}/api/v1/student/calendario` con el `accessToken`.
2. El Gateway valida el token, agrega `X-User-Id` y los demás headers, y reenvía al BFF
   como `GET /api/v1/calendario` (usa la URL que CORE tiene en `STUDENT_SERVICE_URL`).
3. El BFF valida el token otra vez y hace los pedidos a los módulos en paralelo, también
   contra el Gateway (`/api/v1/dining/...`, `/api/v1/events/...`, `/api/v1/academic/...`),
   reenviando el token del alumno.
4. El Gateway reenvía cada pedido al módulo según el prefijo.
5. Cada módulo responde con su formato; el Gateway no transforma la respuesta.
6. Cada adaptador traduce su respuesta al modelo propio; se unen y se marca qué fuente falló.
7. El BFF responde un único JSON con la forma del [`openapi.yaml`](../openapi.yaml); el Gateway lo pasa tal cual.
8. React lo muestra.

El Gateway aparece dos veces: como puerta de entrada hacia el BFF y como puerta de salida
hacia los demás módulos.

### Camino 2: lo que es de CORE

Login, refresh, logout, saldo y listado de notificaciones. El front llama a CORE y CORE
responde; el BFF no interviene. Ejemplo: `GET {GATEWAY}/api/v1/wallets/me`.

En el despliegue, login, refresh y logout van al propio origen del portal y el nginx del front
los reenvía a CORE (`VITE_AUTH_PROXY=true`): la cookie de refresh es `SameSite=Lax` y el
front no comparte sitio con CORE. Ver [`integracion-real.md`](integracion-real.md), "Despliegue".

### Camino 3: tiempo real

El front abre una conexión socket.io contra `/notifications` de CORE, autenticada con el
`accessToken`, y CORE empuja `notification.created` sin que el front pregunte.

| El front pide | Camino |
| --- | --- |
| Calendario, inscripción, historial, compras, perfil | Front → Gateway → BFF → Gateway → módulos |
| Login, saldo, lista de notificaciones | Front → CORE |
| Notificaciones en tiempo real | CORE → Front (conexión abierta) |

## Gateway de CORE

| Módulo | Prefijo público | Se reescribe a |
| --- | --- | --- |
| Portal del Estudiante (nosotros) | `/api/v1/student/*` | `/api/v1/*` |
| Portal del Docente | `/api/v1/teacher/*` | `/api/v1/*` |
| Biblioteca | `/api/v1/library/*` | `/api/v1/*` |
| Comedor | `/api/v1/dining/*` | `/api/v1/*` |
| Tienda | `/api/v1/store/*` | `/api/v1/*` |
| Eventos | `/api/v1/events/*` | `/api/v1/*` |
| Backoffice | `/api/v1/backoffice/*` | `/api/v1/*` |
| Gestión Académica | `/api/v1/academic/*` | `/api/v1/*` |

Comportamiento:

- No transforma la respuesta: path, query, body y status pasan tal cual.
- Timeout de 10 s por defecto.
  El BFF corta antes sus llamadas a los módulos (`GATEWAY_TIMEOUT_MS`, 8 s por defecto): si
  esperara los mismos 10 s, el Gateway cortaría primero el pedido del front al BFF y el 504
  llegaría sin decir qué módulo tardó.
- No reintenta POST, PATCH ni DELETE.
- Módulo caído: 503 `UPSTREAM_UNAVAILABLE`. Respuesta inválida: 502. Timeout: 504.
- Inyecta en cada request autenticado: `X-User-Id`, `X-User-Roles`, `X-User-Permissions`,
  `X-Correlation-Id`.

**Abierto:** las rutas que informaron los módulos 8 y 9 (`/api/v1/backoffice/users/{userId}`, `/api/planificacion/...`,
`/api/academica/...`) son las de cada servicio. Falta confirmar cómo quedan publicadas
detrás del prefijo del Gateway. Mientras tanto suponemos **prefijo + recurso** (por ejemplo
`/api/v1/academic/planificacion/cursos`); la tabla completa está
en [`integraciones.md`](integraciones.md).

**El JWT sí llega al BFF.** Según el contrato de CORE, `Authorization: Bearer <jwt>` viaja
siempre (salvo login, refresh, health y JWKS) y los headers `X-User-*` se suman a ese token,
no lo reemplazan. Por eso el BFF puede validar la firma y reenviar el token al Módulo 6.

## Stack

Un solo lenguaje (TypeScript 5.9, sobre Node 24) de punta a punta. Las tablas listan todas
las herramientas del repo y qué aporta cada una.

### Frontend (`apps/web`)

| Herramienta | Qué aporta |
| --- | --- |
| React 19 | Interfaz armada por componentes |
| Vite 7 | Servidor de desarrollo con recarga instantánea y build de archivos estáticos |
| React Router 7 | Navegación de la SPA y rutas protegidas por sesión |
| TanStack Query 5 | Caché de las respuestas del servidor, estados de carga y error, invalidación después de inscribirse o cargar saldo. Las escrituras no se reintentan |
| openapi-fetch | Cliente HTTP tipado con los tipos generados del contrato: si el contrato cambia, el front no compila |
| socket.io-client | Conexión en tiempo real con CORE para recibir notificaciones |
| Tailwind CSS 4 | Estilos con clases utilitarias, coherentes con el Figma |
| shadcn/ui (Radix Slot, class-variance-authority, clsx, tailwind-merge) | Componentes base copiados al repo (botones, cards, chips) con variantes, sin depender de una librería cerrada |
| lucide-react | Íconos |
| Inter (`@fontsource-variable/inter`) | Tipografía servida desde el propio front |

### BFF (`apps/bff`)

| Herramienta | Qué aporta |
| --- | --- |
| NestJS 11 (sobre Express) | Módulos, inyección de dependencias, guards, filtros e interceptores (ver abajo por qué) |
| `fetch` nativo de Node | Llamadas al Gateway con timeout (`AbortSignal.timeout`), sin cliente HTTP extra |
| zod | Valida la configuración de entorno al arrancar (si falta una variable, no levanta) y la forma de cada respuesta de los módulos externos en los adaptadores |
| jose | Valida el JWT RS256 contra el JWKS de CORE, con caché de claves |
| nestjs-pino, pino, pino-http | Logs en JSON con el `X-Correlation-Id` de cada pedido; `pino-pretty` los hace legibles en desarrollo |
| swagger-ui-express + yaml | Sirve la documentación de la API en `/docs` a partir de [`openapi.yaml`](../openapi.yaml) |
| rxjs, reflect-metadata | Requeridas por NestJS |
| SWC (`@swc/core`, `unplugin-swc`) | Compila los decoradores de Nest rápido al correr los tests |

### CORE falso (`apps/core-falso`, solo desarrollo y demo)

| Herramienta | Qué aporta |
| --- | --- |
| Express 5 | Gateway, auth, saldo, notificaciones y rutas de los módulos externos |
| socket.io | Namespace `/notifications`, igual al de CORE |
| jose | Firma los tokens RS256 y publica el JWKS |
| cookie-parser, cors | Cookie de refresh y CORS, como CORE |
| tsx | Corre TypeScript directo, sin compilar, en desarrollo |

### Contrato y tipos

| Herramienta | Qué aporta |
| --- | --- |
| OpenAPI 3.0 ([`openapi.yaml`](../openapi.yaml)) | Fuente de verdad de la API entre front y BFF |
| openapi-typescript | Genera los tipos de TypeScript del contrato (`packages/api-types`), que usan front y BFF |
| Redocly CLI | Valida el contrato (lint) |
| Prism | Mock del BFF armado con los ejemplos del contrato, para trabajar el front sin esperar al BFF |
| ajv + ajv-formats (`packages/contrato`) | En los tests e2e, valida cada respuesta del BFF contra el contrato |
| openapi-to-postmanv2 | Exporta una colección de Postman del contrato |

### Calidad y tests

| Herramienta | Qué aporta |
| --- | --- |
| Vitest 3 | Corre los tests de los tres proyectos con un solo comando |
| Testing Library (react, user-event, jest-dom) + happy-dom | Tests de pantallas como las usa una persona, sin navegador |
| MSW | Simula respuestas HTTP en los tests del front y del cliente del Gateway |
| Supertest | Tests e2e por HTTP del BFF y del CORE falso |
| ESLint 9 (typescript-eslint, react-hooks) y Prettier | Reglas de código y formato uniformes |
| GitHub Actions | En cada PR corre `npm run verify` y levanta el stack de Docker con un smoke test |

### Entorno

| Herramienta | Qué aporta |
| --- | --- |
| npm workspaces | Monorepo: tres apps y tres paquetes compartidos con una sola instalación |
| concurrently | `npm run dev` levanta front, BFF y CORE falso en una terminal |
| Docker + docker compose | Un `Dockerfile` por app; levanta todo con un comando. El front se sirve con nginx |

No hay base de datos: el portal no persiste nada propio (ver [Decisiones](#decisiones)).
La caché de datos de baja variación (correlatividades, nombres de asignatura y de sedes) es
en memoria, con TTL y por instancia. No contradice que el BFF no guarde estado entre
requests: es una copia descartable de datos ajenos, ningún request depende de que esté, y
perderla solo cuesta una llamada más al módulo de origen.

El criterio común es un solo lenguaje (TypeScript) y un solo contrato ([`openapi.yaml`](../openapi.yaml)) de
punta a punta. Las alternativas también servían; se eligió por ajuste al problema: un BFF
sin datos propios y una SPA autenticada.

### Por qué NestJS en el BFF

- **Mismo lenguaje que el frontend.** Los tipos se generan una vez desde el contrato y un
  cambio se detecta al compilar.
- **El BFF hace entrada y salida, no cómputo.** El modelo asincrónico de Node resuelve las
  llamadas en paralelo del calendario y la tolerancia a fallas parciales.
- **La estructura modular refleja la arquitectura.** Un módulo de Nest por módulo externo,
  con su adaptador.
- **Los requisitos transversales tienen lugar definido.** Guard para el JWT, filtro de
  excepciones para problem+json, interceptor para `X-Correlation-Id`.
- **Testeable por diseño.** La inyección de dependencias permite reemplazar un adaptador
  por uno falso.
- **Convención sobre decisión.** El framework impone una única forma de organizar el código.

Descartados: **Spring Boot** (dos lenguajes y dos generadores de tipos para nueve endpoints
sin lógica propia; su fortaleza en Security y persistencia acá no se usa) y **Express o
Fastify solos** (dejan en manos del grupo definir y sostener la estructura).

### Por qué React con Vite en el frontend

- **Es una SPA y no necesita más.** Todo está detrás del login: no hay contenido público
  que indexar ni que renderizar en el servidor.
- **La sesión que pide CORE es del lado del cliente.** `accessToken` en memoria y WebSocket
  directo desde el navegador.
- **Ecosistema.** Librerías maduras para calendario, componentes y socket.io.
- **Tipos compartidos con el BFF,** generados del mismo contrato.
- **Popularidad.** Más documentación y comunidad; baja la curva de aprendizaje del grupo.
- **Vite** da arranque y recarga rápidos y produce archivos estáticos fáciles de servir.

Descartado: **Next.js** (su valor es el renderizado en servidor, que no hace falta, y las
rutas de API propias, que duplicarían el rol del BFF).

## Fuentes de verdad

| Dato | Dueño | Qué hace el portal |
| --- | --- | --- |
| Identidad y sesión (id del alumno) | CORE | Lee el token / headers del Gateway |
| Datos del alumno (nombre, plan) | Módulo 8 | Consulta |
| Cursos, períodos, correlatividades | Módulo 9 | Consulta y cachea |
| Inscripciones y situación | Módulo 9 | Consulta y da de alta |
| Asistencia, notas parciales y nota final (actas) | Módulo 2 | Consulta |
| Reservas de comedor | Módulo 4 | Muestra en el calendario |
| Eventos e inscripción a eventos | Módulo 6 | Muestra en el calendario |
| Saldo | CORE | Muestra e inicia cargas |
| Compras | Módulo 5 | Muestra |
| Notificaciones del alumno | CORE | Muestra y marca como leídas |

Todos los módulos usan el mismo id de alumno y el mismo `cursoId`.
El portal no persiste datos: solo mantiene una caché en memoria.

No hay integraciones con servicios de terceros fuera de UADEnet (almacenamiento de archivos,
pagos, correo): todo pasa por CORE o por los módulos del sistema. El medio de pago de la
carga de saldo lo simula CORE (`paymentMethodToken`). Las imágenes de los productos de las
compras son URLs que entrega la Tienda.

## Autenticación e identidad

- Sin SSO institucional ni Identity Provider externo. Login: `POST /api/v1/auth/login` con
  `{ email, password }` contra la identidad que provisiona Backoffice.
- Respuesta: `{ accessToken, expiresIn: 900, user: { id, email, roles, permissions, status } }`
  más una cookie de refresh.
- `accessToken`: JWT RS256, expira en 15 minutos, solo en memoria en el frontend.
- `refreshToken`: cookie HttpOnly/SameSite=Lax con `Path=/api/v1/auth`, manejada por CORE. El
  frontend no la lee.
  Rota en cada uso, así que los refresh se serializan.
- Claims del JWT: `iss`, `aud`, `sub` (userId), `sid`, `email`, `roles`, `permissions`,
  `iat`, `exp`, `jti`.
- El BFF valida el JWT localmente contra `GET /.well-known/jwks.json` (defensa en profundidad,
  pedido explícito de CORE), cacheando las claves y refrescándolas ante un `kid` desconocido o
  una firma que no verifica: CORE regenera la clave al reiniciar y mantiene el `kid`.
- Introspección (`POST /internal/v1/auth/introspect`): existe, pero es solo para operaciones
  sensibles, no para cada request.
- Errores de login (problem+json): 401 `AUTH_INVALID_CREDENTIALS` (genérico a propósito),
  403 `AUTH_IDENTITY_SUSPENDED`, 429 `RATE_LIMITED`.
- `GET /api/v1/auth/me` solo trae id, email, roles, permissions y status. Nombre, apellido,
  legajo, carrera y plan se piden a Backoffice.
- No hay single sign-on entre portales: al navegar a Biblioteca o Eventos el alumno
  tendría que loguearse de nuevo.
- El frontend valida el dominio `@uade.edu.ar` antes de enviar el formulario.

## Notificaciones en tiempo real

Los módulos de origen publican eventos de dominio hacia CORE; CORE los traduce en una
notificación persistida. El Módulo 1 no consume esos eventos ni levanta su propio servidor
de WebSocket o SSE.

```js
const socket = io("https://core/notifications", {
  auth: { token: accessToken }
});
socket.on("notification.created", (n) => {
  // misma forma que un item de GET /api/v1/notifications
});
```

- Namespace `/notifications`, autenticado con el `accessToken`. CORE arma la room
  `user:{sub}` desde el token; cualquier userId que mande el cliente se ignora.
- La notificación se persiste antes de emitirse. Al conectar o reconectar hay que pedir
  `GET /api/v1/notifications`.
- Payload: `id`, `type`, `title`, `message`, `actionUrl`, `read`, `timestamp`.
- Tipos: `TEACHER_EXAM_RESULT_PUBLISHED`, `LIBRARY_PENALTY_APPLIED`, `EVENT_REMINDER`.
- Al hacer clic, el frontend navega según `actionUrl`.
- REST: `GET /api/v1/notifications` (paginado), `GET /api/v1/notifications/unread-count`,
  `PATCH /api/v1/notifications/{id}`, `POST /api/v1/notifications/read-all`.

## Saldo

Responsabilidad de CORE. El portal solo es la interfaz:

- `GET /api/v1/wallets/me` (saldo)
- `GET /api/v1/wallets/me/transactions` (movimientos)
- `POST /api/v1/wallets/me/top-ups` con `Idempotency-Key` (UUID v4 por intento)
  - `paymentMethodToken` simulado: `mock-approved` / `mock-rejected`.
  - Respuestas: 201 aprobado, 202 `PENDING`, 422 `WALLET_TOPUP_REJECTED`.

## API del BFF

Definida en [`openapi.yaml`](../openapi.yaml). Rutas relativas a `/api/v1/student` en el Gateway.

| Endpoint | Pantalla | Se nutre de |
| --- | --- | --- |
| `GET /me` | Header y Home | CORE · Módulo 8 |
| `GET /inscripcion/oferta` | Inscripción a materias | Módulos 9 y 8 |
| `POST /inscripciones` | Inscripción a materias | Módulo 9 |
| `GET /cursadas` | Historial académico | Módulos 9 y 2 |
| `GET /cursadas/{cursoId}` | Detalle de cursada | Módulos 9 y 2 |
| `GET /cursadas/{cursoId}/notas/{notaId}` | Detalle de nota | Módulos 9, 2 y 8 |
| `GET /calendario` | Calendario académico | Módulos 4, 6 y 9 |
| `GET /compras` | Historial de compras | Módulo 5 |
| `GET /compras/{orderId}` | Detalle de compra | Módulo 5 |

## Decisiones

**Tomadas**

- La inscripción vive en el Módulo 9; el portal no la persiste.
- El filtrado por plan se hace en el BFF, con las materias del plan que da el Módulo 9 (sus
  cursos no se filtran por plan). Si no se conoce el plan, la oferta sale sin materias y se
  marca con `filtradaPorPlan: false` (decisión 11).
- Historial, calendario y compras se consultan en vivo, sin tabla propia.
- El calendario se agrega en el BFF con llamadas en paralelo y tolera la caída de un módulo.
- Las notificaciones usan el payload y el WebSocket de CORE; no hay contrato ni consumer propios.
- El JWT se valida localmente (RS256/JWKS) además de la validación del Gateway.
- Sanciones y recordatorios de eventos redirigen a los portales de Biblioteca y Eventos;
  el detalle de la nota es una página propia.
- El id del alumno se trata como string opaco.
- La nota final sale de las actas del Módulo 2; la situación de la materia, del Módulo 9. No
  hay notificación de nota final.
- La condición por asistencia la calcula el Módulo 2; el portal muestra el porcentaje contra
  el mínimo que informa, sin calcular faltas restantes.
- El frontend consume directo de CORE auth, notificaciones y saldo; el BFF expone solo lo
  que agrega o traduce de otros módulos.

**Abiertas**

- Rutas definitivas de los módulos 4, 5, 8 y 9 detrás del Gateway.

**Definidas por la consigna o por CORE (no se discuten)**

- El broker de eventos vive en CORE (RabbitMQ, exchange `uadenet.events.v1`).
  El Módulo 1 no levanta ni administra uno.
- CORE emite y valida los tokens y gestiona el login.
- CORE gestiona el saldo.
- El Gateway de CORE es el único punto de entrada hacia los demás microservicios.
- El transporte de tiempo real es WebSocket, impuesto por CORE.

## Por qué no se consume eventos para el calendario

CORE sugirió consumir `dining.reservation.created/cancelled.v1`, `events.event.created.v1`
y `academic.exam-scheduled.v1` por RabbitMQ y mantener una tabla propia. Se descartó por ahora:

- No hay backfill de datos históricos al arrancar.
- Dar de alta una cola nueva tarda hasta 48 h hábiles (PR a CORE).
- Exige infraestructura de consumo: tabla inbox con deduplicación por `eventId`, reintentos, DLQ.
- El catálogo no tiene eventos de cancelación de inscripción a un evento ni de reprogramación
  de un final, así que la copia quedaría desactualizada.

Se reevalúa si la latencia de las llamadas en vivo se vuelve un problema real.

## Entorno local y mocks

En local la topología es la misma que en producción, con un **CORE falso** (`apps/core-falso`)
que hace de Gateway:

- Auth: par de claves RS256 propio, JWKS, login con usuarios de prueba y cookie de refresh.
- Gateway: reenvía `/api/v1/student/*` a `STUDENT_SERVICE_URL` agregando los headers `X-User-*`.
- Módulos externos: sirve sus rutas desde fixtures (los mismos JSON de los tests de adaptadores),
  pasando por el mismo Gateway. Con `{MODULO}_SERVICE_URL` se reenvía a un servicio real.
  Las inscripciones quedan en memoria, para verlas después en la oferta y en el historial.
- Fallas simuladas: por configuración (`CORE_FALLAS`) o en caliente (`/__falso/fallas`), un
  módulo puede devolver 503, 502 o demorar hasta el 504.
- Notificaciones: socket.io en `/notifications` y un endpoint de prueba para dispararlas.
- Saldo: wallets y top-ups con los tokens `mock-approved` / `mock-rejected`, más
  `mock-pending` (202) para la carga pendiente, que es solo del CORE falso.

Mientras un endpoint del BFF no existe, `STUDENT_SERVICE_URL` puede apuntar a **Prism**, que
levanta un mock directo desde [`openapi.yaml`](../openapi.yaml). Pasar a la integración real es cambiar la URL
del Gateway, sin tocar código.

## Docker

- Un `Dockerfile` por app y un `docker-compose.yml` en la raíz que levanta web, BFF,
  core-falso y Prism con un comando.
- Sirve para tener el mismo entorno en todas las máquinas y levantar todo sin instalar Node.
- El desarrollo diario no depende de Docker: se trabaja con `npm run dev`.
