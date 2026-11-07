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
| 2 | `GET /api/v1/students/{studentId}/courses/{courseId}/attendance` · `/grades` · `/api/v1/students/{studentId}/results` | `/api/v1/teacher/students/{studentId}/courses/{courseId}/attendance` · `/grades` · `/api/v1/teacher/students/{studentId}/results` |
| 4 | `GET /api/v1/dining/calendar/me` (ruta pública) | `/api/v1/dining/calendar/me` |
| 5 | `GET /api/v1/store/orders/me` · `/api/v1/store/orders/{id}` (ruta pública) | `/api/v1/store/orders/me` · `/api/v1/store/orders/{id}` |
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
| `actionUrl` de `TEACHER_EXAM_RESULT_PUBLISHED` | `/student/courses/{courseId}/exams/{examId}`, provisorio del Módulo 2; les propusimos `/cursadas/{courseId}/notas/{examId}` |
| `actionUrl` de `LIBRARY_PENALTY_APPLIED` | `/library/{loanId}/penalty` (pendiente con el Módulo 3) |
| `actionUrl` de `EVENT_REMINDER` | `/events/{eventoId}`, relativa (ejemplo de la sección 8.1) |
| Paginación de `/notifications` | El OpenAPI solo documenta `read` y devuelve `nextCursor`; seguimos mandando `limit` y `cursor` |

Cómo usa el front el `actionUrl` (traducción en `apps/web/src/notificaciones/destino.ts`, el
único lugar que conoce su formato):

- `TEACHER_EXAM_RESULT_PUBLISHED` → pantalla propia `/cursadas/{cursoId}/notas/{notaId}`. Se
  aceptan la ruta provisoria del Módulo 2 y la que les propusimos; cuando confirmen, queda una.
  El `examId` es el `notaId` de nuestro contrato (confirmado), así que el listado de notas y la
  notificación llevan a la misma pantalla.
- `LIBRARY_PENALTY_APPLIED` y `EVENT_REMINDER` → portal de Biblioteca o de Eventos, con la URL
  base de `VITE_BIBLIOTECA_URL` y `VITE_EVENTOS_URL`. La de Biblioteca es un valor de ejemplo
  hasta que el Módulo 3 confirme la suya.
- Se acepta un `actionUrl` relativo o absoluto hacia el origen del portal configurado; otro
  origen, otro formato o un tipo desconocido no navega (solo marca la notificación como leída).

## Módulo 2 — Docente

OpenAPI de `teacher-service` y respuestas a nuestras consultas (noviembre 2026).

| Tema | Estado |
| --- | --- |
| `GET /api/v1/students/{studentId}/courses/{courseId}/attendance` | Confirmado (agregado a pedido nuestro) |
| `GET /api/v1/students/{studentId}/courses/{courseId}/grades` | Confirmado (agregado a pedido nuestro) |
| `GET /api/v1/students/{studentId}/results?courseId=` (nota final) | Confirmado |
| Mismos ids que el Módulo 9 (`courseId`, `studentId` = `sub`) | Confirmado; `courseId` y `examId` son enteros |
| Condición por asistencia | Confirmado: la calculan ellos con `threshold` |
| Catálogo de tipos de examen (`category`) | Confirmado; puede crecer |
| `gradedBy` | Confirmado: UUID del docente, el mismo de Backoffice |
| Notificación `TEACHER_EXAM_RESULT_PUBLISHED` | Confirmado |
| Ruta del `actionUrl` de esa notificación | Provisoria; esperan que les digamos cuál |
| Acceso con el token del alumno | Pendiente; lo vemos con CORE |

- **Asistencia:** `threshold` es el porcentaje mínimo para quedar `REGULAR` (hoy 75).
  Porcentaje = (presentes + justificadas) / clases registradas × 100, sin redondear; la falta
  justificada cuenta como asistencia. `condition` es `REGULAR` o `LIBRE`. Cada clase trae
  `date`, `status` (`PRESENTE`, `AUSENTE`, `JUSTIFICADO` o null) y `note`. No informan cuántas
  faltas quedan.
- **Notas:** `passingGrade`, `average` y por examen `examId`, `type`, `name`, `category`
  (`PARCIAL`, `RECUPERATORIO`, `INTEGRADOR`, `FINAL`), `date`, `status` (`PROGRAMADO`,
  `CANCELADO`), `phase`, `grade`, `absent`, `passed`, `gradedAt`, `gradedBy`. Para la lógica se
  usa `category`, no `type` (TP_3, etc.). No hay observaciones.
- **Nota final:** vive en sus actas y se consulta en `/results` (`grade`, `result`, `actaType`,
  `actaNumber`, `resultDate`…). El evento `teacher.course-result-published.v1` va solo para
  APROBADO o DESAPROBADO y no genera notificación al alumno.
- **Eventos:** `teacher.grade-published.v1` (por carga, solo notas nuevas o modificadas) y
  `teacher.course-result-published.v1`. No los consumimos: no tenemos broker.

Fixtures confirmadas: `teacher/attendance.json` y `teacher/grades.json` (por curso) y
`teacher/results.json` (por alumno). Sus `courseId` son los de las fixtures académicas, que
todavía usan ids de texto: en el Módulo 2 son enteros, pero es el mismo id.

Cómo lo usa el BFF (adaptador en `apps/bff/src/modulos/docente/`, servicio en
`apps/bff/src/cursadas/`):

- **Detalle de cursada:** pide en paralelo las inscripciones (Módulo 9), la asistencia, las
  notas y la nota final de ese curso (Módulo 2). Si el curso no está entre las inscripciones,
  es 404 `CURSADA_NO_ENCONTRADA`. Si falla el Módulo 9, falla todo el detalle. Si falla una
  llamada al Módulo 2 (caído, timeout, respuesta inválida o un 404 para un curso que el Módulo 9
  sí tiene), solo esa parte queda en null y `DOCENTE` va en `fuentesConError`.
- **Asistencia:** porcentaje, mínimo y condición pasan tal como llegan; el portal no calcula ni
  la condición ni las faltas restantes. La alerta "cerca del mínimo" (5 puntos) es una
  constante del front.
- **Notas:** los exámenes cancelados no se listan. `instancia` sale de `category`; una que no
  conocemos queda en null y la pantalla muestra solo el nombre. Resultado: `absent` →
  `AUSENTE`, `passed` → `APROBADO`/`DESAPROBADO`; si no viene, no se informa.
- **Detalle de nota:** sale de las notas del curso (no hay ruta por examen para el alumno). El
  nombre del docente se busca en Backoffice con `gradedBy` y se cachea una hora; si Backoffice
  falla o no lo conoce, `docente` va en null y la pantalla sale igual.
- **Historial:** la nota final sale de `/results` en un solo pedido, cruzado por curso; la
  situación sigue saliendo del Módulo 9. Si falla el Módulo 2, el historial sale sin notas
  finales y con `DOCENTE` en `fuentesConError`.

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

Documento de endpoints de consulta de la Tienda y respuesta a nuestras consultas (octubre 2026).
OpenAPI publicado (noviembre 2026): <https://modulo5daa2-production.up.railway.app/docs-json>
(Swagger UI en `/docs`). Coincide con lo de abajo.

| Tema | Estado |
| --- | --- |
| `GET /api/v1/store/orders/me?status=&siteId=&from=&to=&limit=&cursor=` | Confirmado |
| `GET /api/v1/store/orders/{id}` (404 si la orden es de otro usuario) | Confirmado |
| Campos de la orden (listado y detalle traen la misma orden completa) | Confirmado |
| Filtros por estado, sede y fecha | Confirmado |
| Ruta definitiva | Resuelto: el módulo sirve `/api/v1/orders/*` y el Gateway expone `/api/v1/store/*` (confirmado en su OpenAPI) |
| Que `siteId` sea el mismo id de sede de Backoffice | Suposición nuestra; falta preguntarles. Su `GET /api/v1/sites` dice "mock hasta integrar Backoffice" y hoy usa ids propios |
| Que `quantity` sea entero | Suposición nuestra; su OpenAPI la declara `number` (mínimo 1). El BFF exige entero |
| Autenticación con el JWT de CORE | Pendiente; su demo usa `X-Demo-Role` y `X-Demo-User-Id` (`MOCK_AUTH=true`) hasta integrar CORE |

Listado:

- Paginación por cursor, como CORE: `limit` de 1 a 100 (20 por defecto) y `cursor` (el
  `nextCursor` anterior, un uuid). Responde `{ items, nextCursor }`; `nextCursor` null es la
  última página. No hay número de página ni total. Un cursor que no existe o que no cumple los
  filtros es 400.
- Filtros opcionales y combinables: `status` (`PENDING_PAYMENT`, `COMPLETED`, `COMPENSATING`,
  `FAILED`), `siteId` (uuid), `from` y `to` (ISO 8601, inclusive, sobre `createdAt`).
- Siempre de la orden más reciente a la más vieja (`createdAt desc, id desc`).
- Errores en `application/problem+json` con `code` estable: 400 `VALIDATION_ERROR` (con
  `fields`), 401 `AUTH_INVALID_IDENTITY`, 404 si la orden no existe o es ajena, 503 si su base
  o una integración no está disponible. El BFF decide por status, no por `code`.

Orden: `id`, `siteId`, `status`, `createdAt`, `completedAt` (o null), `total` y `balanceAfter`
(string con 2 decimales, o null), `currency`, `failureCode` (o null) e `items[]`. Cada ítem:
`productId`, `productName`, `imageUrl` (URL completa), `image` (ruta relativa al front de la
Tienda), `quantity`, `unitPrice`, y `variantId`, `color`, `size`, `sku` (null si no es variante).
Los ítems guardan nombre, imagen y precio del momento de la compra. No hay subtotales.

Fixture: `store/orders-me.json` (con `siteId` de `backoffice/sites.json`).

Cómo lo usa el BFF (`GET /compras` y `GET /compras/{orderId}`, adaptador en
`apps/bff/src/modulos/tienda/`):

- Pasa `cursor` y `limit` tal cual. `desde` y `hasta` (`YYYY-MM-DD`) se mandan como días
  completos en hora de Argentina: `from` a las 00:00:00.000 y `to` a las 23:59:59.999, con
  `-03:00`. `estado` va como `status` y `sede` como `siteId`.
- La sede se muestra con el nombre de Backoffice (`nombresDeSedes()`, ver Módulo 8), pedido en
  paralelo. Si Backoffice falla o no conoce la sede, la compra sale igual con `sede: null`.
  El `GET /api/v1/store/sites` de la Tienda no se usa: el dueño del catálogo es Backoffice.
- El estado pasa tal cual; el front lo traduce a una etiqueta y muestra tal como llega uno que
  no conoce. No se usan `failureCode`, `balanceAfter` ni `completedAt`.
- `cantidadProductos` es la suma de las `quantity`. El subtotal de cada producto es
  `quantity × unitPrice` y el de la compra, la suma de los productos; los dos como texto
  decimal, sin float.
- Imagen: `imageUrl`. La ruta relativa `image` no sirve fuera del front de la Tienda.
- Un 400 de la Tienda en el listado es nuestro 400 `SOLICITUD_INVALIDA`. En el detalle, un 404
  es `COMPRA_NO_ENCONTRADA`.

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

Dueño de la cursada (entidad Curso), de la inscripción y del historial. La nota final la
tomamos del Módulo 2 (ver arriba), aunque las inscripciones también traen `notaFinal`.

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

1. Responderle al Módulo 2 la ruta del `actionUrl` y confirmar el acceso con el token del
   alumno con CORE.
2. Qué datos devuelve el endpoint de usuarios del Módulo 8.
