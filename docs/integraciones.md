# Integraciones con otros módulos

Extraído del documento técnico v4.1 (1 de octubre de 2026).
**Este archivo se actualiza primero cada vez que un módulo confirma o cambia algo.**

Estados: **Resuelto / Confirmado** (contrato firme) · **Implementado** (ya disponible) ·
**Comprometido** (acordado, todavía no disponible; se mockea) · **Propuesto** ·
**Pedido** · **Pendiente**.

Las rutas de los módulos 4, 5, 8 y 9 son las de cada servicio; falta confirmar cómo
quedan detrás del prefijo del Gateway.

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

## Lo más urgente

1. Documentación de endpoints del Módulo 2.
2. Qué datos devuelve el endpoint de usuarios del Módulo 8.
