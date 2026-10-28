# Integraciones con otros módulos

Extraído del documento técnico v4.1 (1 de octubre de 2026).
**Este archivo se actualiza primero cada vez que un módulo confirma o cambia algo.**
Qué tocar después (fixtures, adaptador, contrato, decisiones), módulo por módulo: [`integracion-real.md`](integracion-real.md).
Las respuestas de ejemplo de cada módulo están en `packages/fixtures/`; su [`README.md`](../README.md)
explica qué son y cuándo dejan de ser provisionales.

Estados: **Resuelto / Confirmado** (contrato firme) · **Implementado** (ya disponible) ·
**Comprometido** (acordado, todavía no disponible; se mockea) · **Propuesto** ·
**Pedido** · **Pendiente**.

Las rutas de los módulos 5, 8 y 9 son las de cada servicio; falta que confirmen que las
sirven bajo `/api/v1`, que es adonde las manda el Gateway (ver abajo).

## Rutas detrás del Gateway

**Confirmado por el OpenAPI de CORE:** el Gateway recibe `/api/v1/{module}/{rest}` y lo reenvía
a `/api/v1/{rest}` del módulo, con el mismo método, query y cuerpo, y devuelve la respuesta sin
tocarla. Los `module` registrados son `student`, `teacher`, `library`, `dining`, `store`,
`events`, `analytics`, `backoffice` y `academic`: los mismos prefijos que usamos.

**Suposición nuestra:** cada módulo quita su base propia (`/api`, `/api/store`) y sirve el resto
bajo `/api/v1`. En el BFF, prefijos y rutas son configuración; el CORE falso y las fixtures
(`packages/fixtures/`) siguen esta tabla.

| Módulo | Ruta informada por el módulo | Ruta pública que usamos |
| --- | --- | --- |
| 2 | (sin contrato) | `/api/v1/teacher/cursos/{cursoId}/alumnos/{alumnoId}/asistencia` · `/notas` · `/notas/{notaId}` |
| 4 | `GET /api/v1/dining/calendar/me` (ruta pública) | `/api/v1/dining/calendar/me` |
| 5 | `GET /api/store/orders/me` · `/api/store/orders/:orderId` | `/api/v1/store/orders/me` · `/api/v1/store/orders/{orderId}` |
| 6 | `GET /api/v1/eventos` · `/api/v1/eventos/{id}` | `/api/v1/events/eventos` · `/api/v1/events/eventos/{id}` |
| 8 | `GET /api/v1/backoffice/users/{userId}` · `/sites` | `/api/v1/backoffice/users/{userId}` · `/api/v1/backoffice/sites` |
| 9 | `/api/planificacion/...` · `/api/academica/...` | `/api/v1/academic/planificacion/...` · `/api/v1/academic/academica/...` |

Backoffice usa el prefijo `/api/v1/backoffice/*` de la sección 6 de [`CORE_INTEGRACION.md`](core/CORE_INTEGRACION.md).

Errores del Gateway (OpenAPI de CORE), que el CORE falso reproduce:

| Status | `code` | Cuándo |
| --- | --- | --- |
| 404 | `GATEWAY_ROUTE_NOT_FOUND` | `module` desconocido |
| 502 | `GATEWAY_UPSTREAM_FAILURE` | Falló la conexión con el módulo |
| 503 | `GATEWAY_UPSTREAM_UNCONFIGURED` · `GATEWAY_CIRCUIT_OPEN` | Módulo sin configurar, o circuito abierto (30 s después de cinco fallas seguidas) |
| 504 | `GATEWAY_UPSTREAM_FAILURE` | El módulo tardó más de 10 s |

El BFF decide por status y responde con nuestros códigos (`UPSTREAM_UNAVAILABLE`,
`UPSTREAM_INVALID`, `UPSTREAM_TIMEOUT`) de [`openapi.yaml`](../openapi.yaml). Ojo: en el CORE real
un módulo caído da 502 hasta que se abre el circuito, y recién ahí 503; el BFF lo informa como
respuesta inválida. El CORE falso simula un módulo caído siempre como 503.

## CORE — Resuelto

Contrato completo en [`docs/core/CORE_INTEGRACION.md`](core/CORE_INTEGRACION.md) y en su OpenAPI
publicado: <https://core-api-production-e458.up.railway.app/docs-json> (Swagger UI en `/docs`). Ese JSON manda sobre las formas de
las respuestas; no guardamos una copia.

- Auth: `POST /api/v1/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /api/v1/auth/me`,
  `GET /.well-known/jwks.json`.
- Notificaciones: WebSocket `/notifications`; `GET /api/v1/notifications`, `/unread-count`,
  `PATCH /api/v1/notifications/{id}`, `POST /api/v1/notifications/read-all`.
- Saldo: `GET /api/v1/wallets/me`, `GET /api/v1/wallets/me/transactions`,
  `POST /api/v1/wallets/me/top-ups`.
- Gateway: prefijos, headers inyectados y errores (ver [`arquitectura.md`](arquitectura.md)).
- Id del alumno: claim `sub`, el mismo en todos los módulos.
- `store.purchase.completed.v1` no se enruta a los portales.
- No expone un endpoint de calendario agregado.

Confirmado por el OpenAPI (fixtures `core/wallet-me.json` y `core/transacciones.json`):

| Tema | Forma |
| --- | --- |
| `GET /api/v1/wallets/me` | `{ walletId, userId, balance, currency, updatedAt }` |
| Ítem de `/wallets/me/transactions` | `transactionId, status, type, concept, amount, currency, balanceAfter, externalReference, originalTransactionId, createdAt`; sin `description` (el front muestra el nombre del `concept`) |
| Ítem de `/notifications` (y del socket) | `id, userId, type, title, message, actionUrl, sourceModule, sourceReference, readAt, expiresAt, createdAt`. Leída es `readAt` no null; el `PATCH` recibe `{ read }` |
| `PATCH /notifications/{id}` | Devuelve la notificación; 404 `NOTIFICATION_NOT_FOUND` si es de otro usuario |
| Carga sin `Idempotency-Key` | 400 `IDEMPOTENCY_KEY_REQUIRED` |
| Misma key con otro cuerpo | 409 `IDEMPOTENCY_CONFLICT` |
| Carga | Siempre 201 con el movimiento: `mock-approved` → `POSTED`, `mock-pending` → `PENDING` (no hay 202); `mock-rejected` → 422 `WALLET_TOPUP_REJECTED` |

Pendiente (la fixture `core/notificaciones.provisional.json` sigue provisional por esto):

| Tema | Suposición |
| --- | --- |
| `actionUrl` de `EXAM_RESULT_PUBLISHED` | `/teacher/courses/{courseId}/exams/{examId}` (pendiente con el Módulo 2) |
| `actionUrl` de `LIBRARY_PENALTY_APPLIED` | `/library/{loanId}/penalty` (pendiente con el Módulo 3) |
| `actionUrl` de `EVENT_REMINDER` | `/events/{eventoId}`, relativa (ejemplo de la sección 8.1) |
| Paginación de `/notifications` | El OpenAPI solo documenta `read` y devuelve `nextCursor`; seguimos mandando `limit` y `cursor` |

Cómo usa el front el `actionUrl` (traducción en `apps/web/src/notificaciones/destino.ts`, el
único lugar que conoce su formato):

- `EXAM_RESULT_PUBLISHED` → pantalla propia `/cursadas/{cursoId}/notas/{notaId}`. Suponemos que
  el `examId` del `actionUrl` es el `notaId` de nuestro contrato (pendiente con el Módulo 2): el
  adaptador de Docente usa el `examId` de cada nota como `notaId`, así que el listado de notas y
  la notificación llevan a la misma pantalla.
- `LIBRARY_PENALTY_APPLIED` y `EVENT_REMINDER` → portal de Biblioteca o de Eventos, con la URL
  base de `VITE_BIBLIOTECA_URL` y `VITE_EVENTOS_URL`. La de Biblioteca es un valor de ejemplo
  hasta que el Módulo 3 confirme la suya.
- Se acepta un `actionUrl` relativo o absoluto hacia el origen del portal configurado; otro
  origen, otro formato o un tipo desconocido no navega (solo marca la notificación como leída).

## Módulo 2 — Docente

| Tema | Estado |
| --- | --- |
| Servicio de asistencia y notas parciales por alumno y curso | Confirmado; faltan endpoints y respuesta |
| Eventos de nota parcial y de nota final | Confirmado; falta payload |
| Formato del `actionUrl` e identificadores (`examId`, `subjectId`) | Pendiente |
| Quién calcula la situación final | Pendiente |
| Uso del mismo `cursoId` y `alumnoId` que el Módulo 9 | Pendiente |
| Límite de inasistencias para quedar libre | Pendiente |
| Que persistan ellos mismos notas y actas | Pendiente |
| Fuente única de la nota final (con el Módulo 9) | Pendiente |

- Publica `teacher.exam-result.published.v1` hacia CORE; nosotros recibimos la notificación
  `EXAM_RESULT_PUBLISHED`.
- La notificación no trae el detalle completo del examen: para la página de detalle hay que
  consultar la API del Módulo 2 con los identificadores del `actionUrl`.
- **Los schemas `Asistencia`, `NotaResumen` y `NotaDetalle` del [`openapi.yaml`](../openapi.yaml) son una
  suposición nuestra.** No hay contrato del Módulo 2.
- Las fixtures (`teacher/*.provisional.json`) y las rutas del CORE falso siguen esa
  suposición. Rutas supuestas, detrás de `PREFIJO_DOCENTE`:
  `/cursos/{cursoId}/alumnos/{alumnoId}/asistencia`, `.../notas` y `.../notas/{examId}`.
- Cada nota se identifica por `examId` (el único id que trae el `actionUrl`) y trae además
  `docente` y `observaciones`, que solo van en el detalle. Mientras no tiene nota, `nota` y
  `resultado` vienen en null.

Cómo lo usa el BFF (adaptador en `apps/bff/src/modulos/docente/`, detalle en
`apps/bff/src/cursadas/`):

- Detalle de cursada: pide en paralelo las inscripciones del alumno (Módulo 9), la asistencia
  y las notas (Módulo 2). Si el curso no está entre las inscripciones, es 404
  `CURSADA_NO_ENCONTRADA`, responda lo que responda el Módulo 2. Si falla el Módulo 9, falla
  todo el detalle.
- Si falla el Módulo 2 (caído, timeout, respuesta inválida o un 404 para un curso que el
  Módulo 9 sí tiene), la cursada sale igual con lo que no cargó en null y `DOCENTE` en
  `fuentesConError`. Asistencia y notas son llamadas distintas: si falla una sola, solo esa
  queda en null.
- Límite de inasistencias y faltas restantes pasan tal como llegan. Si no vienen, quedan en
  null y el portal no las calcula a partir de las ausencias; la pantalla no muestra el
  indicador. La alerta de "quedan pocas" (1 o 0) es una constante del front.
- Detalle de nota: pide en paralelo las inscripciones (materia, comisión y confirmación de que
  el curso es del alumno) y la nota. Curso ajeno o nota inexistente: 404
  `NOTA_NO_ENCONTRADA`. Si falla el Módulo 2, falla la pantalla.

## Módulo 3 — Biblioteca

| Tema | Estado |
| --- | --- |
| Evento de sanción | Confirmado |
| URL de destino | Pendiente; adelantaron `www.su-url.com/library/{loanId}/penalty` |

Sin integración directa. Publica `library.penalty.applied.v1` hacia CORE, que genera
`LIBRARY_PENALTY_APPLIED`.

```json
{
  "userId": "UUID del alumno",
  "loanId": "UUID del préstamo",
  "daysLate": 8,
  "amount": "2500.00",
  "currency": "ARS"
}
```

El monto lo calcula Backoffice pero llega resuelto desde Biblioteca.

## Módulo 4 — Comedor

| Tema | Estado |
| --- | --- |
| `GET /api/v1/dining/calendar/me?from=&to=` | Confirmado |
| Hora del turno | Resuelto: `startAt` y `endAt` en UTC |
| Ruta definitiva | Resuelto: es la ruta pública, detrás del Gateway |
| Que `siteId` sea el mismo id de sede de Backoffice | Suposición nuestra |
| Que solo lleguen turnos `RESERVED` | Suposición nuestra |

Devuelve los turnos del usuario del token (`Authorization: Bearer`, el mismo de CORE), listos
para el calendario. `from` y `to` son opcionales, `YYYY-MM-DD` e inclusive. Ordena por fecha
ascendente y no pagina: `nextCursor` siempre es null.

```json
{
  "items": [
    {
      "id": "b3f1c2e0-...",
      "type": "DINING_RESERVATION",
      "title": "Comedor - Sede Centro",
      "siteId": "4c2e...",
      "startAt": "2026-10-05T15:00:00.000Z",
      "endAt": "2026-10-05T15:45:00.000Z",
      "status": "RESERVED"
    }
  ],
  "nextCursor": null
}
```

Sin turnos en el rango: `{ "items": [], "nextCursor": null }`.

| Status | `code` | Cuándo |
| --- | --- | --- |
| 401 | `AUTH_TOKEN_MISSING` | No se mandó `Authorization: Bearer` |
| 401 | `AUTH_TOKEN_INVALID` | Token inválido, vencido o que no es de usuario |
| 401 | `AUTH_IDENTITY_MISMATCH` | El `X-User-Id` del Gateway no coincide con el usuario del token |
| 500 | `INTERNAL_ERROR` | Error inesperado |

Fixtures: `dining/calendar-me.json` y `dining/calendar-me-vacio.json`.

Cómo lo usa el BFF (calendario, adaptador en `apps/bff/src/modulos/comedor/`):

- Pide `from` = primer día del rango y `to` = el día siguiente al último: no está dicho en qué
  zona compara Comedor las fechas, y un turno a la noche del último día ya es el día siguiente
  en UTC. Después recorta por solapamiento en hora de Argentina.
- Cada turno es un ítem con hora (`todoElDia: false`), con `inicio` y `fin` pasados a `-03:00`.
  El título es fijo ("Turno de comedor"): el `title` de Comedor ya trae la sede, que va en `lugar`.
- `lugar` es el nombre de la sede según Backoffice (ver Módulo 8), buscado por `siteId`. Si
  Backoffice no responde o no conoce la sede, el turno sale igual con `lugar: null`; la
  categoría no se marca con error.
- No filtra por `status`.

## Módulo 5 — Tienda

| Tema | Estado |
| --- | --- |
| `GET /api/store/orders/me?page=&limit=` | Propuesto |
| `GET /api/store/orders/:orderId` (solo compras propias) | Propuesto |
| Campos del listado vs. del detalle | Pendiente |
| Filtro por sede | Pedido (que sea por `siteId` de Backoffice es suposición nuestra) |
| Que persistan ellos mismos el historial | Pendiente |

Campos: `orderId`, fecha, sede, estado, productos, cantidades, precio unitario histórico,
subtotal, total. Nombres y precios congelados al momento de la compra.
Filtros ofrecidos: paginación, fecha, estado.

Fixture: `store/orders-me.provisional.json`. Salvo `orderId`, los nombres de los campos
(`fecha`, `siteId`, `sede`, `estado`, `productos[]` con `cantidad`, `precioUnitario` y `subtotal`,
`total`), los estados y la forma de la paginación (`{ items, page, limit, total }`) son
suposición nuestra. El detalle tiene la misma forma que un ítem del listado.

Cómo lo usa el BFF (`GET /compras` y `GET /compras/{orderId}`, adaptador en
`apps/bff/src/modulos/tienda/`):

- Pasa la paginación y los filtros como `page`, `limit`, `desde`, `hasta` (inclusive,
  `YYYY-MM-DD`), `estado` y `sede`. Los nombres de los filtros son suposición nuestra.
- `sede` es el `siteId` de Backoffice. La pantalla arma el selector con `GET /sedes` (ver
  Módulo 8) y manda el id elegido. **Suposición nuestra:** que la Tienda filtre por `siteId`;
  por eso la fixture trae `siteId` además del nombre en `sede`, que es lo que se muestra.
- En el listado, `productos` es opcional: si viene, `cantidadProductos` es la suma de las
  cantidades; si no, se omite.
- Si la orden no trae `subtotal`, el BFF lo calcula sumando los subtotales de los productos
  como texto decimal (sin float).
- En el detalle, un 404 o un 403 (compra de otro alumno) son el mismo 404 `COMPRA_NO_ENCONTRADA`.
- La pantalla ofrece filtrar por los estados de la fixture (`COMPLETADA`, `CANCELADA`); un
  estado que la Tienda mande y no esté en esa lista se muestra igual en el listado.

## Módulo 6 — Eventos Académicos

| Tema | Estado |
| --- | --- |
| `GET /api/v1/eventos?desde=&hasta=` | Confirmado |
| `GET /api/v1/eventos/{id}` | Confirmado |
| Recordatorio `evento.recordatorio` | Confirmado |
| Si `hasta` es inclusivo cuando se envía solo la fecha | Pendiente |
| Nombre del evento en el catálogo de CORE (`events.reminder.requested.v1`) | Pendiente |

Listado:

- `desde` y `hasta` en ISO 8601, opcionales (sin ellos devuelve todo).
- Ordena por `fechaInicio` ascendente.
- Filtra por **solapamiento** de fechas, no por fecha de inicio: un evento del 30/09 al
  02/10 aparece en octubre.
- `yaInscripto` se calcula contra el usuario del JWT: el BFF debe reenviar el token del alumno.
- Campos: `id`, `titulo`, `descripcion`, `locacionId`, `locacion` (nombre, sede), `cupoMaximo`,
  `fechaInicio`, `fechaFin`, `esPago`, `categoriaPrecio`, `precio`, `inscriptos`, `disponibles`,
  `yaInscripto`, `creadoPor`.
- `categoriaPrecio` (agregado en octubre de 2026): `"general"`, `"especial"` o null; indica la
  tarifa aplicada cuando `esPago` es true. El portal no lo usa (el calendario no muestra precios).
- Fechas con offset de Argentina (`2026-10-15T18:00:00-03:00`). `locacionId` es UUID y
  `creadoPor` es un id de usuario (`u-10432`); para nosotros son strings opacos.
- Si `hasta` no resulta inclusivo, pedir hasta el primer día del mes siguiente.

Cómo lo usa el BFF (calendario, adaptador en `apps/bff/src/modulos/eventos/`): pide desde las
00:00 del primer día hasta las 00:00 del día siguiente al último (hora de Argentina), así el
último día entra sea `hasta` inclusivo o no, y después recorta por solapamiento. Se queda con
los eventos con `yaInscripto` y convierte las fechas a `-03:00`.

Recordatorio: `tipo`, `usuarioId` (el mismo id del JWT de CORE), `eventoId`, `titulo`,
`fechaInicio`, `locacion` (texto ya armado, por ejemplo "Aula Magna — Monserrat") y `url`.

## Módulo 8 — Backoffice

| Tema | Estado |
| --- | --- |
| `GET /api/v1/backoffice/users/{userId}` | Confirmado (documento de flujo de datos del Módulo 8) |
| Campos de la ficha | Confirmado: `userId`, `email`, `firstName`, `lastName`, `documentId`, `fileNumber`, `roles`, `status`, `siteId`, `careerId` |
| `careers: [{ careerId, planId }]` (un plan por carrera, asignado en el alta) | Comprometido; todavía no publicado |
| Ruta definitiva de la consulta | Pendiente; adelantaron `GET /internal/v1/users/{userId}` con token de servicio. Lo define CORE: mientras tanto seguimos con la ruta del Gateway |
| Permiso de lectura | Pendiente; nos avisan |
| `GET /api/v1/backoffice/sites` · `/sites/{siteId}` | Confirmado (documento de flujo de datos del Módulo 8) |

- `careerId` y `planId` son ids del Módulo 9: numéricos, pero los mandan como texto.
- El 404 para un `userId` que no existe está confirmado.
- Nombre, apellido, legajo y carrera no viajan en `backoffice.user.upserted.v1`: se consultan
  con este endpoint.

Suposiciones nuestras: la respuesta trae la ficha de arriba más `careers`, y **cada alumno
tiene un solo plan**. Si `careers` trae varias, se toma la primera. Manejar varias carreras
obliga a cambiar `planId` por una lista en el adaptador (`backoffice.mapper.ts`), en el
filtro de la oferta (`InscripcionService` y `AcademicoAdapter.cursos`) y en `Perfil` del
[`openapi.yaml`](../openapi.yaml).

Sin `planId` no se puede filtrar la oferta de RF2. Decisión del bloque D: si Backoffice no lo
devuelve (`careers` vacío, null o ausente) o no responde, el BFF pide la oferta sin `planId`
y la marca con `filtradaPorPlan: false`; la pantalla avisa que puede incluir materias de
otros planes. Queda registrado con un warning en el log.

Cómo lo usa el BFF (`GET /me`, adaptador en `apps/bff/src/modulos/backoffice/` y
`apps/bff/src/perfil/perfil.service.ts`):

- El id y el mail salen del token de CORE; de Backoffice se toman `firstName`, `lastName`,
  `fileNumber` (→ `nombre`, `apellido`, `legajo`) y la primera de `careers`. Se ignoran
  `documentId`, `roles`, `status`, `siteId` y el `careerId` suelto. Todos opcionales: si no
  vienen, el perfil sale sin ellos.
- Backoffice solo da el id de la carrera: el nombre sale de `GET /academica/carreras` del
  Módulo 9, cacheado en memoria una hora. Si el Módulo 9 falla o no conoce la carrera, el
  perfil sale igual, sin `carrera`.
- Un 404 de Backoffice (usuario que no conoce) no es error: el perfil sale solo con id y mail.

Fixture: `backoffice/users.provisional.json`, con la ficha del documento más `careers`.
Provisional hasta que publiquen `careers`.

Sedes: Backoffice es el dueño del catálogo de sedes, y las sedes no tienen evento: se
consultan y se cachean. `GET /sites?status=&cursor=&limit=` devuelve
`{ items: [{ siteId, code, name, address, city, province, country, timezone, status, updatedAt }], nextCursor }`,
de a 100 como máximo. Fixture: `backoffice/sites.json`.

Cómo lo usa el BFF (`nombresDeSedes()` en el adaptador de Backoffice, para cualquier módulo
que mande solo un `siteId`; hoy, Comedor y el filtro por sede de Compras):

- Pide el catálogo completo (sin filtrar por estado, así se resuelven también las sedes
  inactivas), siguiendo `nextCursor`, y lo guarda en memoria una hora como `siteId → name`.
- Si falla, no se cachea y cada llamador decide: Comedor sigue sin el nombre.
- `GET /sedes` del BFF devuelve ese mismo catálogo como `{ items: [{ id, nombre }] }`,
  ordenado por nombre, para el filtro por sede de Compras. Si Backoffice falla, responde el
  error; la pantalla deja el filtro sin opciones y el listado funciona igual.
- **Suposición nuestra:** el `siteId` es el mismo en todos los módulos.

## Módulo 9 — Gestión Académica y Planificación

Dueño de la cursada (entidad Curso), de la inscripción y del historial.

| Tema | Estado |
| --- | --- |
| `POST /api/planificacion/cursos/{cursoId}/inscripciones` con `{ "alumnoId" }` | Implementado |
| `GET /api/academica/asignaturas/{asignaturaId}/correlatividades` | Implementado |
| `GET /api/planificacion/turnos-examen` | Implementado |
| `GET /api/planificacion/periodos` | Implementado |
| Filtro `planId` en `GET /api/planificacion/cursos?periodoId=&planId=` | Comprometido |
| `asignatura: { id, codigo, nombre }` anidada en el listado de cursos | Comprometido |
| `GET /api/planificacion/alumnos/{alumnoId}/inscripciones?periodoId=` | Comprometido |
| Horarios anidados en el listado de cursos | Pedido |
| Códigos de error del POST | Pendiente |
| Condiciones de regularidad | Pendiente |
| Emisión de `academica.resultado.publicado` | Pendiente; DTO definido (`tipo`, `ocurridoEn`, `enlace`) |
| Evento de reprogramación o cancelación de finales | Pendiente; no está en el catálogo de CORE |

- Correlatividades: tipo `REGULAR` o `APROBADA`.
- Turnos de examen: ventanas generales (`nombre`, `fechaInicio`, `fechaFin`,
  `inscripcionDesde`, `inscripcionHasta`), sin fecha por asignatura.
- Inscripciones por alumno: cada una con curso y asignatura, período, `notaFinal`, `estado`.
- El Módulo 2 obtiene el listado de inscriptos directamente del Módulo 9; el Módulo 1 no lo entrega.
- Lo comprometido se trabaja con mock hasta que esté disponible.

Fixtures (`academic/*.provisional.json`): aunque varios endpoints están implementados, no
tenemos sus respuestas, así que todas son provisionales. Suposiciones:

- Períodos: `id`, `nombre`, `fechaInicio`, `fechaFin`, `inscripcionDesde`, `inscripcionHasta`.
- Turnos de examen: los campos informados más un `id`; fechas sin hora. No suponemos que
  acepte filtros de fecha: el BFF pide todos y se queda con los que se solapan con el rango
  (adaptador en `apps/bff/src/modulos/academico/`).
- Cursos: `id`, `comision`, `periodoId`, `sede`, `cupoMaximo`, `inscriptosActivos`,
  `asignatura` anidada y `horarios` (pedido, puede faltar).
- Correlatividades: `[{ asignaturaId, nombre, tipo }]`.
- Inscripciones del alumno: `id`, `cursoId`, `comision`, `asignatura`, `periodo`,
  `notaFinal`, `estado`, `fecha`.
- POST de inscripción: 201 `{ id, cursoId, alumnoId, estado, fecha }`
  (`academic/inscripcion-creada.provisional.json`). Los rechazos son 409 problem+json con los
  `code` de nuestro [`openapi.yaml`](../openapi.yaml) (`YA_INSCRIPTO`, `SIN_CUPO`, `CORRELATIVIDAD_FALTANTE` con
  `correlativasFaltantes`, `SIN_REGULARIDAD`, `FUERA_DE_FECHA`), uno por motivo en
  `academic/inscripcion-rechazos.provisional.json`. El CORE falso no simula
  `SIN_REGULARIDAD` ni `FUERA_DE_FECHA`.

Cómo lo usa el BFF (oferta, inscripción e historial, adaptador en
`apps/bff/src/modulos/academico/`):

- Oferta: pide en paralelo el `planId` (Backoffice), los períodos y todas las inscripciones
  del alumno; elige el período vigente (el de inscripción abierta, si no el próximo en abrir,
  si no el último que cerró); pide los cursos de ese período y plan y las correlatividades de
  cada asignatura. Las correlatividades se cachean en memoria una hora; si el Módulo 9 no
  conoce una asignatura (404), se toma como sin correlativas. Si fallan, falla la oferta: no
  se ofrece una materia sin validar sus correlativas.
- Estado por comisión: `INSCRIPTO` si hay una inscripción del alumno en ese curso que no sea
  `BAJA`; si no, `BLOQUEADA` si falta una correlativa; si no, `CON_CUPO` o `SIN_CUPO`.
- Horarios con un día fuera de `LUNES`–`SABADO` o una hora que no sea `HH:MM` invalidan la
  respuesta (502). Si no vienen horarios o sede, la comisión sale con `horarios: []` y
  `sede: null`.
- Rechazos: la traducción de los códigos del Módulo 9 a los nuestros está en un solo lugar
  (`academico.mapper.ts`). Hoy es identidad; un código que no reconoce, o un cuerpo que no se
  entiende, es `INSCRIPCION_RECHAZADA`.
- Historial: ordena por la fecha de inscripción, de la más reciente a la más antigua (los ids
  de período son opacos y no se ordenan); `enCurso` es `INSCRIPTO` o `CURSANDO`.

## Lo más urgente

1. Documentación de endpoints del Módulo 2.
2. Qué datos devuelve el endpoint de usuarios del Módulo 8.
