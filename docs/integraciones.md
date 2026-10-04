# Integraciones con otros módulos

Extraído del documento técnico v4.1 (1 de octubre de 2026).
**Este archivo se actualiza primero cada vez que un módulo confirma o cambia algo.**
Las respuestas de ejemplo de cada módulo están en `packages/fixtures/`; su `README.md`
explica qué son y cuándo dejan de ser provisionales.

Estados: **Resuelto / Confirmado** (contrato firme) · **Implementado** (ya disponible) ·
**Comprometido** (acordado, todavía no disponible; se mockea) · **Propuesto** ·
**Pedido** · **Pendiente**.

Las rutas de los módulos 4, 5, 8 y 9 son las de cada servicio; falta confirmar cómo
quedan detrás del prefijo del Gateway (ver abajo la suposición que usamos).

## Rutas detrás del Gateway — Suposición nuestra

Mientras no se confirme, usamos **prefijo del Gateway + recurso**: se quita la base propia
del servicio (`/api`, `/api/v1`, `/api/store`) y se conserva el resto. El Gateway reescribe el
prefijo a `/api/v1`, así que el módulo recibe `/api/v1/{recurso}`. En el BFF, prefijos y
rutas son configuración; el CORE falso y las fixtures (`packages/fixtures/`) siguen esta tabla.

| Módulo | Ruta informada por el módulo | Ruta pública que usamos |
| --- | --- | --- |
| 2 | (sin contrato) | `/api/v1/teacher/cursos/{cursoId}/alumnos/{alumnoId}/asistencia` · `/notas` · `/notas/{notaId}` |
| 4 | `GET /reservations/me` | `/api/v1/dining/reservations/me` |
| 5 | `GET /api/store/orders/me` · `/api/store/orders/:orderId` | `/api/v1/store/orders/me` · `/api/v1/store/orders/{orderId}` |
| 6 | `GET /api/v1/eventos` · `/api/v1/eventos/{id}` | `/api/v1/events/eventos` · `/api/v1/events/eventos/{id}` |
| 8 | `GET /api/v1/backoffice/users/{userId}` | `/api/v1/backoffice/users/{userId}` |
| 9 | `/api/planificacion/...` · `/api/academica/...` | `/api/v1/academic/planificacion/...` · `/api/v1/academic/academica/...` |

Backoffice usa el prefijo `/api/v1/backoffice/*` de la sección 6 de `CORE_INTEGRACION.md`.

Códigos de error del Gateway que usa el CORE falso: 503 `UPSTREAM_UNAVAILABLE` y 504
`UPSTREAM_TIMEOUT` (este último, suposición); para el 502 CORE no publica el `code` y usamos
`UPSTREAM_INVALID`, igual que el BFF.

## CORE — Resuelto

Contrato completo en `docs/core/CORE_INTEGRACION.md`.

- Auth: `POST /api/v1/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /api/v1/auth/me`,
  `GET /.well-known/jwks.json`.
- Notificaciones: WebSocket `/notifications`; `GET /api/v1/notifications`, `/unread-count`,
  `PATCH /api/v1/notifications/{id}`, `POST /api/v1/notifications/read-all`.
- Saldo: `GET /api/v1/wallets/me`, `GET /api/v1/wallets/me/transactions`,
  `POST /api/v1/wallets/me/top-ups`.
- Gateway: prefijos, headers inyectados y errores (ver `arquitectura.md`).
- Id del alumno: claim `sub`, el mismo en todos los módulos.
- `store.purchase.completed.v1` no se enruta a los portales.
- No expone un endpoint de calendario agregado.

Lo que no figura en `CORE_INTEGRACION.md` y suponemos en el CORE falso (fixtures en
`packages/fixtures/core/`, todas provisionales, hasta tener el `contracts/openapi.yaml` de CORE):

| Tema | Suposición |
| --- | --- |
| `GET /api/v1/wallets/me` | `{ userId, balance, currency }` |
| Ítem de `/wallets/me/transactions` | La respuesta del débito de la sección 7.3 más `description` |
| Ítem de `/notifications` (y del socket) | Campos del `POST /internal/v1/notifications` más `id`, `read`, `createdAt`; sin `userId` |
| `PATCH /notifications/{id}` | Devuelve la notificación actualizada; 404 si es de otro usuario |
| Carga sin `Idempotency-Key` | 400 `IDEMPOTENCY_KEY_REQUIRED` |
| Misma key con otro cuerpo | 409 `IDEMPOTENCY_KEY_CONFLICT` (CORE solo dice "409 conflicto de idempotencia") |
| Carga pendiente | Token `mock-pending` → 202 `PENDING`. Es extensión nuestra: CORE solo nombra `mock-approved` y `mock-rejected` |
| Respuesta de la carga aprobada | La misma forma que un movimiento, con `concept: TOP_UP` |
| `actionUrl` de `EXAM_RESULT_PUBLISHED` | `/teacher/courses/{courseId}/exams/{examId}` (pendiente con el Módulo 2) |
| `actionUrl` de `LIBRARY_PENALTY_APPLIED` | `/library/{loanId}/penalty` (pendiente con el Módulo 3) |

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
- **Los schemas `Asistencia`, `NotaResumen` y `NotaDetalle` del `openapi.yaml` son una
  suposición nuestra.** No hay contrato del Módulo 2.
- Las fixtures (`teacher/*.provisional.json`) y las rutas del CORE falso siguen esa
  suposición; cada nota trae además `examId`, `docente` y `observaciones`.

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
| `GET /reservations/me` | Confirmado |
| Hora del turno | Pendiente; hoy `slot.date` es solo la fecha |
| Detalle de campos de `slot` y `campus` | Pendiente |
| Ruta definitiva | Pendiente |

Respuestas:

- 200 `{ "reservations": [...] }` (array vacío si no hay reservas)
- 401 `{ "error": "Unauthorized" }`
- 500 `{ "error": "Internal server error" }`

```jsonc
{
  "id": 1,                                   // id de la reserva
  "userId": 15,                              // usuario que reservó
  "slotId": 32,                              // turno reservado
  "createdAt": "2026-10-01T12:30:00.000Z",
  "slot": {
    "...": "...",
    "date": "2026-10-05",                    // fecha del turno (YYYY-MM-DD)
    "campus": { "...": "..." }
  },
  "campus": { "...": "..." }                 // también viene directo
}
```

Se cargan todas las reservas, sin filtrar por estado. Ojo: los ids del ejemplo son
numéricos; en nuestro contrato son strings opacos, el adaptador los convierte.

Fixture: `dining/reservations-me.provisional.json`. Para `slot` y `campus` suponemos
`{ id, date, campus }` y `{ id, name }`.

## Módulo 5 — Tienda

| Tema | Estado |
| --- | --- |
| `GET /api/store/orders/me?page=&limit=` | Propuesto |
| `GET /api/store/orders/:orderId` (solo compras propias) | Propuesto |
| Campos del listado vs. del detalle | Pendiente |
| Filtro por sede | Pedido |
| Que persistan ellos mismos el historial | Pendiente |

Campos: `orderId`, fecha, sede, estado, productos, cantidades, precio unitario histórico,
subtotal, total. Nombres y precios congelados al momento de la compra.
Filtros ofrecidos: paginación, fecha, estado.

Fixture: `store/orders-me.provisional.json`. Salvo `orderId`, los nombres de los campos
(`fecha`, `sede`, `estado`, `productos[]` con `cantidad`, `precioUnitario` y `subtotal`,
`total`), los estados y la forma de la paginación (`{ items, page, limit, total }`) son
suposición nuestra. El detalle tiene la misma forma que un ítem del listado.

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
  `fechaInicio`, `fechaFin`, `esPago`, `precio`, `inscriptos`, `disponibles`, `yaInscripto`,
  `creadoPor`.
- Si `hasta` no resulta inclusivo, pedir hasta el primer día del mes siguiente.

Recordatorio: `tipo`, `usuarioId` (el mismo id del JWT de CORE), `eventoId`, `titulo`,
`fechaInicio`, `locacion` (texto ya armado, por ejemplo "Aula Magna — Monserrat") y `url`.

## Módulo 8 — Backoffice

| Tema | Estado |
| --- | --- |
| `GET /api/v1/backoffice/users/{userId}` | Confirmado |
| Qué campos trae (nombre, apellido, legajo, carrera) | Pendiente |
| Si incluye `planId` | Pendiente |

Sin `planId` no se puede filtrar la oferta de RF2.

Cómo lo usa el BFF (`GET /me`, adaptador en `apps/bff/src/modulos/backoffice/`):

- El id y el mail salen del token de CORE; de Backoffice solo se toman nombre, apellido,
  legajo, carrera y `planId`. Todos opcionales: si no vienen, el perfil sale sin ellos.
- Un 404 de Backoffice (usuario que no conoce) no es error: el perfil sale solo con id y mail.
  Suposición nuestra, sin confirmar con el Módulo 8.

Fixture: `backoffice/users.provisional.json` con `id`, `email`, `nombre`, `apellido`,
`legajo`, `carrera`, `planId` y `status`, todos supuestos.

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
- Turnos de examen: los campos informados más un `id`; fechas sin hora.
- Cursos: `id`, `comision`, `periodoId`, `sede`, `cupoMaximo`, `inscriptosActivos`,
  `asignatura` anidada y `horarios` (pedido, puede faltar).
- Correlatividades: `[{ asignaturaId, nombre, tipo }]`.
- Inscripciones del alumno: `id`, `cursoId`, `comision`, `asignatura`, `periodo`,
  `notaFinal`, `estado`, `fecha`.
- POST de inscripción: 201 `{ id, cursoId, alumnoId, estado, fecha }`. Los rechazos son
  409 con los `code` de nuestro `openapi.yaml` (`YA_INSCRIPTO`, `SIN_CUPO`,
  `CORRELATIVIDAD_FALTANTE` con `correlativasFaltantes`). El CORE falso no simula
  `SIN_REGULARIDAD` ni `FUERA_DE_FECHA`.

## Lo más urgente

1. Documentación de endpoints del Módulo 2.
2. Qué datos devuelve el endpoint de usuarios del Módulo 8.
