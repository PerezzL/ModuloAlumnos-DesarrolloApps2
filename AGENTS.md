# UADEnet — Módulo 1: Portal del Estudiante

Instrucciones para cualquier agente de IA (y persona) que trabaje en este repo.
Mantener este archivo corto: solo lo que no se deduce leyendo el código.

## Qué es este proyecto

Frontend (SPA) + BFF del Portal del Estudiante de UADEnet, un sistema de 10 módulos
construido por 10 grupos. El Módulo 1 **no es dueño de datos académicos**: consulta y
agrega información de otros módulos a través del Gateway de CORE.

## Qué leer antes de tocar código

| Archivo | Para qué |
| --- | --- |
| [`openapi.yaml`](openapi.yaml) | Contrato front ↔ BFF. Es la fuente de verdad de la API propia. |
| [`docs/instalacion.md`](docs/instalacion.md) | Instalación desde cero, Node vs. Docker, Prism. |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Capas, Gateway, fuentes de verdad, auth, decisiones tomadas. |
| [`docs/integraciones.md`](docs/integraciones.md) | Qué expone cada módulo externo y qué está confirmado o pendiente. |
| [`docs/integracion-real.md`](docs/integracion-real.md) | Qué tocar cuando un módulo confirma su contrato y cómo conectar al CORE real. |
| [`docs/pruebas.md`](docs/pruebas.md) | Cómo probar en local: usuarios, fallas simuladas y casos preparados por pantalla. |
| [`packages/fixtures/README.md`](packages/fixtures/README.md) | Qué son las fixtures, para qué sirven y por qué casi todas son provisionales. |
| [`docs/plan.md`](docs/plan.md) | Decisiones tomadas, pasos de armado y pendientes. |
| [`docs/requisitos.md`](docs/requisitos.md) | Los 9 requisitos funcionales (RF1–RF9). |
| [`docs/pantallas.md`](docs/pantallas.md) | Pantallas, qué muestran y de qué endpoint salen. |
| [`docs/core/CORE_INTEGRACION.md`](docs/core/CORE_INTEGRACION.md) | Contrato de integración de CORE (auth, notificaciones, saldo, Gateway). |

## Stack y estructura

- **Frontend:** React con Vite y TypeScript (SPA), en `apps/web`.
- **BFF:** Node.js con TypeScript y NestJS, en `apps/bff`. Un módulo de Nest por cada módulo externo.
- **CORE falso:** `apps/core-falso`. Hace de Gateway, auth, notificaciones, saldo y módulos
  externos en local. Es solo para desarrollo y demo.
- **Tipos:** `packages/api-types`, generados desde [`openapi.yaml`](openapi.yaml) con `openapi-typescript`.
  No se suben a git. El front los consume con `openapi-fetch`.
- Front: React Router y TanStack Query. BFF: `fetch` nativo, `nestjs-pino`, config validada con zod.
- Monorepo con npm workspaces. Un `Dockerfile` por app y `docker-compose.yml` en la raíz.
- No usar los decoradores de `@nestjs/swagger` como fuente del contrato: el YAML manda.
- El porqué de cada elección está en [`docs/arquitectura.md`](docs/arquitectura.md); los pasos de armado, en [`docs/plan.md`](docs/plan.md).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala todo el monorepo (Node 24, ver `.nvmrc`) |
| `npm run gen` | Regenera `packages/api-types` desde [`openapi.yaml`](openapi.yaml) |
| `npm run verify` | `gen` → typecheck → ESLint → `redocly lint` → Vitest. **Correrlo antes de cada commit.** El CI corre lo mismo |
| `npm test` | Solo los tests (Vitest, todos los proyectos) |
| `npm run format` | Prettier |
| `npm run mock` | Prism en :4010 con los ejemplos de [`openapi.yaml`](openapi.yaml). Para usarlo: `STUDENT_SERVICE_URL=http://localhost:4010` |
| `npm run postman` | Exporta la colección Postman del contrato a `postman/` (fuera de git) |

Las respuestas del BFF se validan contra el contrato con `@uadenet/contrato`
(`new Contrato().validar('get', '/calendario', 200, body)`) en los tests e2e.

## Reglas del dominio (no negociables)

**Identidad**
- El alumno se identifica solo por el token: el BFF lee `X-User-Id` (lo inyecta el Gateway).
  Nunca aceptar el id del alumno por path, query o body.
- Todos los ids (alumno, curso, orden, nota) son strings opacos. No asumir UUID ni número,
  no parsearlos, no ordenarlos numéricamente.

**Contrato primero**
- Todo cambio de API empieza en [`openapi.yaml`](openapi.yaml). Después se regeneran los tipos.
- Los archivos generados no se editan a mano.
- Los campos con `x-provisional: true` dependen de un contrato externo no confirmado:
  la UI debe tolerar que vengan vacíos o null, y ninguna lógica fuera del adaptador
  debe depender de cómo llegan desde el módulo de origen.

**Adaptadores**
- Un adaptador por módulo externo. Es el único lugar que conoce la forma de la respuesta
  de ese módulo; el resto del BFF y el frontend solo ven los modelos del [`openapi.yaml`](openapi.yaml).
- El BFF habla con los demás módulos únicamente por el Gateway de CORE. La URL del Gateway
  y los prefijos de ruta son configuración, no constantes en el código.
- Cada adaptador tiene tests con fixtures: JSON de ejemplo del módulo externo → modelo propio.
  Las fixtures viven en `packages/fixtures/<modulo>/` y el CORE falso sirve las mismas;
  las que dependen de un contrato no confirmado se nombran `*.provisional.json`.
- Si no se conoce el contrato de un módulo, no inventar nombres de campos en el código:
  van en un fixture marcado como provisional y se registra en [`docs/integraciones.md`](docs/integraciones.md).

**Persistencia**
- El portal no persiste inscripciones, historial, calendario ni compras. Siempre consulta en vivo.
- Solo se cachean datos de baja variación (correlatividades, nombres de asignatura).
  Caché en memoria con TTL; ningún request puede depender de que el dato esté cacheado.

**Errores y resiliencia**
- Errores en `application/problem+json` con un `code` estable.
- Manejar explícitamente los errores del Gateway: 502 (respuesta inválida),
  503 `UPSTREAM_UNAVAILABLE` (módulo caído), 504 (timeout de 10 s).
- Calendario: responde 200 con lo que cargó e informa en `fuentes` qué categoría falló.
  Solo es error si fallan las tres.
- Detalle de cursada: si el Módulo 2 no responde, se devuelve igual con `asistencia` y
  `notas` en null y el módulo en `fuentesConError`.
- El POST de inscripción no se reintenta automáticamente.

**Seguridad y sesión**
- El BFF valida el JWT localmente (RS256 contra el JWKS de CORE; issuer, audience, expiración).
  Las claves se cachean y se refrescan solo ante un `kid` desconocido.
- Frontend: el `accessToken` vive solo en memoria. Nunca en localStorage ni sessionStorage.
- Los llamados a refresh se serializan: el refresh token rota en cada uso y dos refresh
  en paralelo rompen la sesión.
- El frontend valida el dominio `@uade.edu.ar` antes de enviar el login.
- Carga de saldo: cada intento lleva un `Idempotency-Key` (UUID v4) propio.
- No commitear `.env` ni secretos. Las claves del CORE falso de desarrollo son solo de prueba.

**Requisitos de CORE para el BFF**
- Exponer `GET /health/live` y `GET /health/ready`.
- Publicar el OpenAPI actualizado (Swagger UI servido desde [`openapi.yaml`](openapi.yaml)).
- Propagar `X-Correlation-Id` en logs y en toda llamada saliente.
- Toda URL externa (Gateway, JWKS, issuer, audience, WebSocket) es variable de entorno.
- El BFF no guarda estado entre requests.

**Frontend ↔ CORE directo**
- El navegador solo conoce la URL del Gateway. Nunca llama al BFF directo.
- Autenticación, notificaciones y saldo no pasan por el BFF: el frontend usa los contratos
  de CORE por el Gateway.
- Notificaciones: `socket.io-client` contra el namespace `/notifications` de CORE.
  El socket es una aceleración, no una garantía: al conectar o reconectar hay que pedir
  `GET /api/v1/notifications`.

**Formatos**
- Fechas con hora: ISO 8601 con zona. Fechas sin hora: `YYYY-MM-DD`.
- Importes (`Monto`): string decimal. No convertir a float.

## Fuera de alcance (no implementar)

- Baja de inscripción.
- Servidor propio de WebSocket o SSE.
- Consumer de RabbitMQ o cualquier broker propio.
- Manejo de contraseñas o servidor de identidad.
- Lógica de negocio del saldo (cobros, acreditaciones).
- Vistas propias para sanción de biblioteca o detalle de evento: son redirecciones a otros portales.

## Tablero de Trello

Tablero: https://trello.com/b/zenfbiBW/uadenet-alumnos

Trello es un reflejo del trabajo, no lo dirige: sirve para mostrar cómo se organiza el
equipo y para ver qué falta. Se sincroniza al cerrar cada bloque, no tarea por tarea.

Cada tarjeta lleva la épica entre corchetes y un código (`T` tarea técnica, `H` historia,
`E` entrega) que se cita en los commits. El color de la etiqueta es el riesgo del contrato:
verde firme, amarillo provisional, rojo supuesto.

- **Al planear un bloque:** leer las tarjetas que incluye. Sus criterios de aceptación son
  la especificación de cada tarea.
- **Al cerrar un bloque:** mover sus tarjetas a "En revisión (PR abierto)", comentar el link
  del PR y lo que haya surgido, y crear en "Backlog" las tarjetas de trabajo nuevo.
- **Si un módulo externo confirma o cambia algo:** comentarlo en su tarjeta de
  "Esperando a otros módulos" además de actualizar [`docs/integraciones.md`](docs/integraciones.md).

Si tenés acceso a Trello desde tu herramienta, hacé la sincronización. Si no, avisale a la
persona para que la haga a mano; no la des por hecha.

Límites:

- No mover tarjetas a "Terminado": lo hace una persona después de revisar el PR.
- No modificar la historia ni los criterios de aceptación de una tarjeta. Si parecen
  incorrectos o incompletos, comentarlo y preguntar.
- No archivar ni borrar tarjetas, ni reordenar el Backlog.
- "Terminado" significa que funciona contra el CORE falso. La conexión al módulo real se
  sigue en las tarjetas de "Integración real".

## Forma de trabajo

- Se trabaja por bloques grandes (ver [`docs/plan.md`](docs/plan.md)). Un plan por bloque, revisado con la
  persona antes de arrancar; después se avanza sin frenar entre tarjetas.
- Una rama `bloque/<nombre>` y un PR por bloque. Adentro, un commit por tarjeta con su código
  en el título (`T07: guard JWT`). Se mergea sin squash.
- Si el bloque anterior todavía no está mergeado, la rama nueva sale de la rama de ese bloque
  y su PR apunta a ella (no a `main`). Si el bloque anterior recibe cambios, se traen con
  `git merge`. Cuando se mergea a `main`, se cambia la base del PR nuevo a `main`.
- Al instalar dependencias, no filtrar la salida de `npm install`: los errores de peers
  (ERESOLVE) pasan inadvertidos y el paquete no queda instalado.
- Tests de adaptadores antes que el adaptador.
- Si el código y la documentación se contradicen, o algo no está especificado,
  frenar y preguntar en lugar de asumir.
- Los términos del dominio van en español, tal como figuran en el contrato
  (`cursada`, `inscripcion`, `comision`). No traducirlos.
- Cuando un módulo externo confirma o cambia algo: actualizar [`docs/integraciones.md`](docs/integraciones.md),
  el fixture, el adaptador y, si corresponde, quitar `x-provisional` del contrato.
  Qué archivos y decisiones toca cada módulo: [`docs/integracion-real.md`](docs/integracion-real.md).
- Cuando el agente se equivoque en algo repetible, agregar la regla acá.
