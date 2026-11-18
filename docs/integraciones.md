# Integraciones con otros módulos

Qué consume el portal de cada módulo, qué está confirmado y cómo lo usa el BFF.
Las respuestas de ejemplo de cada módulo están en `packages/fixtures/`; su
[`README.md`](../packages/fixtures/README.md) explica qué son y cuándo dejan de ser provisionales.

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

Contrato de integración de CORE (documento de la cátedra) y su OpenAPI publicado: <https://core-api-production-e458.up.railway.app/docs-json> (Swagger UI en `/docs`). Ese JSON manda sobre las formas de
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

Novedades del 4 de noviembre de 2026 (PDF "CORE G10 · Novedades" y OpenAPI de producción).
CORE aclara que todo es compatible: no se quitaron rutas, campos, roles ni permisos.

- **En producción:** `https://core-api-production-e458.up.railway.app` (JWKS en
  `/.well-known/jwks.json`, `kid` `dev-key-1`). Al reiniciar regenera la clave con el mismo
  `kid` (visto el 17/11): el BFF vuelve a pedir el JWKS cuando una firma no verifica.
- **`iss` nuevo:** pasó de `http://localhost:3000` a la URL de Railway, sin `/` final
  (visto en un token real, noviembre 2026); `aud` sigue `uadenet`. El BFF lo lee de
  `JWT_ISSUER`: no hay que tocar código.
- **`careerIds`:** la identidad trae `careerIds` en el `user` del login y del refresh y en
  `GET /auth/me` (el refresh ahora también devuelve `user`). El BFF toma la carrera del claim
  `careerIds` del JWT y usa Backoffice solo de respaldo (ver Módulo 8). Confirmado con un
  token real: el JWT trae `careerIds` y también `planIds` (vacíos para el usuario de prueba).
  El BFF toma el plan del claim `planIds` de la misma forma: Backoffice y el plan activo de la
  carrera en el Módulo 9 quedan de respaldo.
  El access token dura 15 minutos y el de un estudiante solo trae permisos de saldo
  (`wallet:read:self`, `wallet:credit:self`).
- **Roles y permisos:** roles nuevos de Backoffice (`BACKOFFICE_VIEWER`, `PAYROLL_ADMIN`) y
  permisos `backoffice:*`. STUDENT y TEACHER siguen con solo la wallet propia. Al portal no le
  cambia nada: no autoriza por rol. Un usuario TEACHER puede entrar al portal del alumno.
- **No nos afecta:** `GET /internal/v1/identities/{userId}` y sus errores `AUTH_*` (para
  Backoffice), reversa idempotente del saldo, `events:read` en
  `GET /internal/v1/events/{eventId}`.
- **Credenciales de servicio:** CORE ya nos asignó el `clientId` `student-service` y su
  `clientSecret` (para `POST /internal/v1/service-auth/token`). Hoy no se usan: no llamamos a
  `/internal/v1/*`. El secreto no va al repo; si hace falta, entra como variable de entorno.
- **Límite de pedidos:** 100 por minuto por IP de cliente, en toda la API. Ver el pendiente
  de abajo.
- **401 sin token:** llega con `code: "HTTP_401"` y sin `correlationId`, aunque el OpenAPI lo
  marca obligatorio. El front decide el refresh por status, así que no le afecta.

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
| `actionUrl` de `EVENT_REMINDER` | `/events/{eventoId}`, relativa (ejemplo de la sección 8.1) |
| Paginación de `/notifications` | El OpenAPI solo documenta `read` y devuelve `nextCursor`; seguimos mandando `limit` y `cursor` |
| Paginación de `/wallets/me/transactions` | El OpenAPI solo documenta `limit` ("a lo sumo 100") y devuelve `nextCursor`; seguimos mandando `cursor` |
| Límite de 100 pedidos por minuto en el proxy | Pendiente: todo lo del BFF sale de una sola IP |
| Cookie de refresh con el front en otro sitio | Vista en un login real: `refreshToken`, `Path=/api/v1/auth`, `HttpOnly`, `SameSite=Lax`, 7 días, sin `Domain` y sin `Secure` (el contrato decía `Secure`). Desde otro sitio (incluso `localhost`) no viaja en el refresh. Resuelto con el reenvío de `/api/v1/auth/*` desde el nginx del front (funciona porque no fija `Domain`) |

Cómo usa el front el `actionUrl` (traducción en `apps/web/src/notificaciones/destino.ts`, el
único lugar que conoce su formato):

- `TEACHER_EXAM_RESULT_PUBLISHED` → pantalla propia `/cursadas/{cursoId}/notas/{notaId}`. Se
  aceptan la ruta provisoria del Módulo 2 y la que les propusimos; cuando confirmen, queda una.
  El `examId` es el `notaId` de nuestro contrato (confirmado), así que el listado de notas y la
  notificación llevan a la misma pantalla.
- `LIBRARY_PENALTY_APPLIED` → detalle del préstamo en el portal de Biblioteca
  (`/prestamos/{loanId}` sobre `VITE_BIBLIOTECA_URL`, confirmado por el Módulo 3).
- `EVENT_REMINDER` → portal de Eventos, con la URL base de `VITE_EVENTOS_URL`.
- Se acepta un `actionUrl` relativo al portal o absoluto dentro del portal configurado (si el
  portal tiene ruta base, como `https://asignia.app/uade-net`, tiene que estar debajo de ella);
  otro origen, otro formato o un tipo desconocido no navega (solo marca la notificación como leída).

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
`teacher/results.json` (por alumno). Sus `courseId` son enteros y coinciden con los cursos de
las fixtures académicas.

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
| URL de destino | Confirmada: `https://asignia.app/uade-net/prestamos/{loanId}` (detalle del préstamo) |
| Rutas por el Gateway | Exponen préstamos, sanciones, catálogo y pago; no las usamos (la sanción es una redirección) |

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

Según su Swagger de integraciones (v2.0.0), CORE avisa al alumno con link a
`https://asignia.app/uade-net/prestamos/{loanId}`. El evento no trae `penaltyId`, por eso el
link va al préstamo (que muestra la sanción) y no al detalle de la sanción. El `actionUrl` lo
arma CORE: aceptamos tanto `/prestamos/{loanId}` relativo como la URL absoluta.

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
plan de la oferta (`InscripcionService`) y en `Perfil` del [`openapi.yaml`](../openapi.yaml).

El plan sale primero del claim `planIds` del token de CORE. Si el token no lo trae y
Backoffice tampoco (`careers` vacío, null o ausente) o no responde, la oferta usa el plan
activo de la carrera del alumno en el Módulo 9. Sin carrera, sale sin materias y con
`filtradaPorPlan: false` (decisión 11 de [`plan.md`](plan.md); ver Módulo 9).

Cómo lo usa el BFF (`GET /me`, adaptador en `apps/bff/src/modulos/backoffice/` y
`apps/bff/src/perfil/perfil.service.ts`):

- El id y el mail salen del token de CORE; de Backoffice se toman `firstName`, `lastName` y
  `fileNumber` (→ `nombre`, `apellido`, `legajo`). Se ignoran `documentId`, `roles`,
  `status` y `siteId`. Todos opcionales: si no vienen, el perfil sale sin ellos.
- **Carrera:** la primera del claim `careerIds` del token de CORE. Backoffice es el
  respaldo: si el token no trae carreras (claim ausente o lista vacía), se usa la primera de
  `careers` y, si no viene, el `careerId` suelto (confirmado).
- **Plan:** el primero del claim `planIds` del token de CORE. Si el token no trae planes, el
  de Backoffice es el de la carrera elegida dentro de `careers`; si Backoffice no la tiene,
  `planId` es null y la oferta usa el plan activo de la carrera en el Módulo 9
  (ver arriba).
- El nombre de la carrera sale de `GET /academica/carreras` del Módulo 9, cacheado en memoria
  una hora. Si el Módulo 9 falla o no conoce la carrera, el perfil sale igual, sin `carrera`.
- Un 404 de Backoffice (usuario que no conoce) no es error: el perfil sale con id, mail y, si
  el token la trae, la carrera.

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
tomamos del Módulo 2 (ver arriba), aunque el Módulo 9 también la expone.
Documento de integración del Módulo 9 y respuestas a nuestras consultas (octubre 2026), más
el pedido de alta en el Gateway que el Módulo 9 le mandó a CORE (noviembre 2026). Ese pedido
lista los endpoints y formatos que van a exponer, pero CORE todavía no lo confirmó.

| Tema | Estado |
| --- | --- |
| `POST /api/planificacion/cursos/{cursoId}/inscripciones` con `{ "alumnoId" }` | Implementado; listado para el Portal del Estudiante en el pedido a CORE |
| `GET /api/academica/asignaturas/{asignaturaId}/correlatividades` | Implementado; la forma cambió y trae nombres (ver abajo) |
| `GET /api/planificacion/turnos-examen` | Implementado |
| `GET /api/planificacion/periodos` | Implementado |
| `GET /api/planificacion/cursos?periodoId=` | Implementado |
| `GET /api/academica/carreras` · `/carreras/{carreraId}/planes` · `/planes/{planId}/asignaturas` | Implementado |
| `GET /api/planificacion/cursos/{cursoId}/notas/{alumnoId}` (nota final) | Implementado |
| `GET /api/planificacion/alumnos/{alumnoId}/inscripciones?periodoId=` | Forma definida en el pedido a CORE: `InscripcionAlumno[]` (ver abajo) |
| Nombre de sede y de aula en el listado de cursos | Resuelto en el pedido a CORE: `sedeNombre` y `aulaNombre` (puede ser null) |
| Filtro `planId` y `asignatura` anidada en el listado de cursos | Propuesto, no previsto; no hace falta (ver abajo) |
| Período anidado en las inscripciones del alumno | Lo habían rechazado, pero en el pedido a CORE viene anidado en `curso.periodo`. Confirmar cuál vale |
| Códigos de error | `code` genéricos (ver abajo). Pendiente: cómo distinguir el motivo de un rechazo de inscripción |
| Condiciones de regularidad | Expuestas en `GET /api/regularidad/cursos/{cursoId}`; el portal usa el `threshold` del Módulo 2 |
| Acceso con el token del alumno | Pendiente; sus rutas piden `ROLE_ADMINISTRATIVO` o `ROLE_ACADEMIC_ADMIN`. Le propusieron a CORE `academic:read` y `academic:write` y le preguntaron qué roles va a emitir para estudiante y docente |
| Reescritura de rutas en el Gateway | Pendiente: le preguntaron a CORE si reescribe `/api/v1/academic/{resto}` → `/api/{resto}` o si ellos pasan a servir `/api/v1`. Con cualquiera de las dos, la ruta pública que usamos no cambia |
| `GET /api/planificacion/asignaturas/{id}/agenda?desde=&hasta=` | Listado para "Portales" en el pedido a CORE. Pendiente: qué representa una `Asignacion` (si son fechas de examen por materia, serviría para el calendario) |
| Notificación de la nota final | Resuelto: no hay. El Módulo 2 no notifica la nota final y `resultado.publicado` va solo a Analítica |
| Evento de reprogramación o cancelación de finales | Pendiente; no está en el catálogo de CORE. El Módulo 9 pidió publicar `academic.exam-scheduled.v1` y `academic.term-defined.v1`; falta saber si CORE los convierte en notificaciones al alumno |

- Ids de curso, asignatura, período, etc.: `Long`. El `alumnoId` es `String` y es el mismo id
  de usuario de todo el sistema (`sub` de CORE).
- Materias del plan: `GET /api/academica/planes/{planId}/asignaturas` da los ids, códigos y
  nombres de las asignaturas del plan. Los cursos del plan son los de `/cursos` cuyo
  `asignaturaId` está en esa lista. El `planId` del alumno sale del token de CORE o del Módulo 8.
- Listado de cursos: `codigo` (la comisión), `asignaturaId`, `periodoId`, `sedeId`,
  `modalidad`, `turno`, un solo horario (`diaSemana` en inglés, `horaInicio`/`horaFin`
  `HH:MM:SS`, `aulaId`), `estado` (`PLANIFICADO`, `EN_CURSO`, `FINALIZADO`, `CANCELADO`),
  `cupoMaximo`, `inscriptosActivos`, `fechaInicio`, `fechaFin`. Cursos viejos pueden traer
  el horario en null. El pedido a CORE agrega `sedeNombre` y `aulaNombre` (puede ser null), y
  detalla los valores de `turno` (`MAÑANA`, `TARDE`, `NOCHE`). `sedeId` va a ser el `siteId` de Backoffice; las
  sedes y aulas del Módulo 9 son un mock local que no se expone.
- Correlatividades: el GET devuelve
  `{ asignaturaId, condiciones: [{ tipo, materiasCorrelativas: [{ id, codigo, nombre }] }] }`,
  con tipo `REGULAR` o `APROBADA` (pedido a CORE de noviembre 2026). Trae los nombres: ya no
  hace falta cruzarlas con las asignaturas del plan. `{ id, asignaturaId, correlativaId, tipo }`,
  que es lo que anotamos en octubre, es la respuesta del POST (alta de una correlatividad).
- Inscripciones del alumno (pedido a CORE): cada elemento es la inscripción
  (`{ id, alumnoId, fechaInscripcion, estado, notaFinal, fechaResultado }`) más
  `curso: CursoAcademico`, que es el curso del listado con `asignatura: { id, codigo, nombre }`
  y `periodo` (el período completo) en lugar de `asignaturaId` y `periodoId`.
- Errores: `application/problem+json` con `type`, `title`, `status`, `detail`, `instance`,
  `code`, `correlationId` y, en los de validación, `errors` (un mensaje por campo). Los `code`
  son genéricos: `RESOURCE_NOT_FOUND`, `BUSINESS_RULE_VIOLATION`, `VALIDATION_ERROR`,
  `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `DATA_CONFLICT`, `DATA_ACCESS_ERROR` e
  `INTERNAL_ERROR`. No hay uno por motivo de rechazo, así que el adaptador no puede pasarlos a
  nuestros `code` (`SIN_CUPO`, `CORRELATIVIDAD_FALTANTE`, etc.) sin saber cómo distinguirlos.
- Períodos: `id`, `anio`, `numero`, `fechaInicio`, `fechaFin`, `inscripcionDesde`,
  `inscripcionHasta`, todas fechas sin hora. Sin `nombre`. **Suposición nuestra:**
  `inscripcionHasta` incluye ese día completo, en hora de Argentina.
- Turnos de examen: `id`, `nombre`, `fechaInicio`, `fechaFin`, `inscripcionDesde`,
  `inscripcionHasta`. Ventanas generales, sin fecha por asignatura.
- POST de inscripción: 201 `{ id, alumnoId, fechaInscripcion, estado, notaFinal, fechaResultado }`,
  sin `cursoId`. Estados: `INSCRIPTO`, `CURSANDO`, `BAJA`, `REGULAR`, `LIBRE`, `APROBADO`,
  `DESAPROBADO`.
- Nota final: la carga el Módulo 2 y el Módulo 9 la expone en
  `GET /cursos/{cursoId}/notas/{alumnoId}` (`{ alumnoId, notaFinal, estado, fechaResultado }`).
  El portal no la usa: la toma de las actas del Módulo 2 (`/results`, ver arriba).
- `resultado.publicado` se publica por RabbitMQ para Analítica; no llega a CORE ni genera
  notificación al alumno.
- El Módulo 2 obtiene el listado de inscriptos directamente del Módulo 9; el Módulo 1 no lo entrega.
- Lo que no está implementado se trabaja con mock hasta que esté disponible.

Fixtures (`academic/*.provisional.json`): siguen las formas de arriba, con ids numéricos. Son
provisionales porque CORE todavía no confirmó el pedido del Módulo 9. Las materias del plan
están en `planes-asignaturas.provisional.json` (por `planId`) y el catálogo de carreras trae
`ultimoPlanActivo`. El status de los rechazos es una suposición nuestra: `DATA_CONFLICT` con
409 y `BUSINESS_RULE_VIOLATION` con 422 (`inscripcion-rechazos.provisional.json`).

Cómo lo usa el BFF (oferta, inscripción e historial, adaptador en
`apps/bff/src/modulos/academico/`):

- Período: el nombre se arma con `numero` y `anio` ("1° cuatrimestre 2027"). La ventana va
  desde las 00:00 de `inscripcionDesde` hasta las 23:59:59.999 de `inscripcionHasta`, en hora
  de Argentina.
- Oferta: pide en paralelo el plan del alumno, los períodos y todas las inscripciones del
  alumno; elige el período vigente (el de inscripción abierta, si no el próximo en abrir, si
  no el último que cerró); pide los cursos del período y las materias del plan, y se queda con
  los cursos de esas materias (de ahí salen nombre y código). Las comisiones `CANCELADO` y
  `FINALIZADO` no se ofrecen.
- Plan del alumno: el del token de CORE (`planIds`); si no lo trae, el de Backoffice para su
  carrera y, si tampoco, el plan activo de la carrera (`/academica/carreras/con-ultimo-plan-activo`). Sin plan, la oferta sale sin
  materias y con `filtradaPorPlan: false` (decisión 11 de [`plan.md`](plan.md)).
- Correlatividades: se aplanan las `condiciones` (una correlativa por materia, con su tipo).
  Si el Módulo 9 no conoce una asignatura (404), se toma como sin correlativas. Si fallan,
  falla la oferta: no se ofrece una materia sin validar sus correlativas.
- Caché en memoria por una hora: correlatividades, materias del plan y catálogo de carreras.
- Estado por comisión: `INSCRIPTO` si hay una inscripción del alumno en ese curso que no sea
  `BAJA`; si no, `BLOQUEADA` si falta una correlativa; si no, `CON_CUPO` o `SIN_CUPO`.
- Horario: el único del curso pasa a `horarios` con el día en español, las horas en `HH:MM`
  y el aula de `aulaNombre`. Un día fuera de lunes a sábado invalida la respuesta (502). Sin
  horario o sin sede, la comisión sale con `horarios: []` y `sede: null`.
- POST: el 201 no trae el curso, así que el `cursoId` es el del pedido.
- Rechazos: la traducción está en un solo lugar (`academico.mapper.ts`). `BUSINESS_RULE_VIOLATION`
  y `DATA_CONFLICT` (con 400, 409 o 422) son 409 `INSCRIPCION_RECHAZADA` con el `detail` del
  Módulo 9, que el front muestra. Un 409 siempre es un rechazo. Otro 4xx (por ejemplo, un
  `VALIDATION_ERROR`) es 502. Si el Módulo 9 agrega códigos por motivo, se mapean a los
  nuestros en la misma tabla.
- Historial: ordena por inicio del período y, dentro del mismo período, por fecha de
  inscripción, de la más reciente a la más antigua (los ids son opacos y no se ordenan);
  `enCurso` es `INSCRIPTO` o `CURSANDO`.
