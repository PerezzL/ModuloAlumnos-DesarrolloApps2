# Requisitos funcionales

Los requisitos funcionales del Módulo 1. El detalle de cada módulo externo está en
[`integraciones.md`](integraciones.md); acá va qué hay que construir.

| RF | Requisito | Módulos |
| --- | --- | --- |
| RF1 | Autenticación institucional | CORE · 8 |
| RF2 | Inscripción a materias | 9 · 8 |
| RF3 | Historial académico y cursadas en curso | 9 · 2 |
| RF4 | Notificación de notas | 2 · 9 · CORE |
| RF5 | Notificación de sanción de biblioteca | 3 · CORE |
| RF6 | Notificación de evento próximo | 6 · CORE |
| RF7 | Calendario académico | 4 · 6 · 9 |
| RF8 | Historial de compras | 5 |
| RF9 | Carga de saldo | CORE |

## RF1 — Autenticación institucional

El estudiante inicia sesión con su mail `@uade.edu.ar` y contraseña. El backend de
autenticación es de CORE.

- Formulario de login contra `POST /api/v1/auth/login`.
- Validación del dominio `@uade.edu.ar` en el frontend antes de enviar.
- Guard en el BFF que valida el JWT en cada request protegido (firma RS256, issuer,
  audience, expiración) contra el JWKS de CORE.
- Sesión en el frontend: `accessToken` en memoria, refresh serializado, logout.
- Id del alumno desde la sesión, tratado como string opaco.
- Datos del alumno (nombre, apellido, legajo, carrera, plan) desde Backoffice: `GET /me` del BFF.

El plan viene del claim `planIds` del token de CORE o, si no lo trae, de `careers` en la ficha de Backoffice (comprometido, sin publicar); el nombre de la carrera, del Módulo 9.

## RF2 — Inscripción a materias

El estudiante ve las materias de su plan ofrecidas en el cuatrimestre, agrupadas por materia,
y se inscribe en una comisión. La inscripción se registra en el Módulo 9.

Flujo del BFF:

1. Obtener el plan del alumno (token de CORE, Módulo 8 o, si no lo dan, el plan activo de su carrera en
   `GET /api/academica/carreras/con-ultimo-plan-activo`) y el período vigente
   (`GET /api/planificacion/periodos`).
2. Listar la oferta: `GET /api/planificacion/cursos?periodoId={id}` (no filtra por plan) y
   quedarse con los cursos de las materias de `GET /api/academica/planes/{planId}/asignaturas`,
   que dan el nombre y el código de cada una.
3. Agrupar las comisiones por asignatura.
4. Marcar el estado de cada comisión:
   - `INSCRIPTO`: según las inscripciones del alumno.
   - `CON_CUPO` / `SIN_CUPO`: `inscriptosActivos` contra `cupoMaximo`.
   - `BLOQUEADA`: falta una correlativa.
5. Pre-validar correlatividades: `GET /api/academica/asignaturas/{asignaturaId}/correlatividades`
   cruzado con las inscripciones del alumno. Tipo `APROBADA` exige estado `APROBADO`;
   tipo `REGULAR` acepta `REGULAR` o `APROBADO`.
6. Validar que la fecha esté dentro de `inscripcionDesde` / `inscripcionHasta` del período.
7. Inscribir: `POST /api/planificacion/cursos/{cursoId}/inscripciones` con `{ "alumnoId": "..." }`.
   El Módulo 9 vuelve a validar.

Notas:

- El portal no guarda la inscripción: la comanda y refleja el resultado.
- Correlatividades y nombres de asignatura se cachean en el BFF.
- Rechazo: 409 con `code` `YA_INSCRIPTO`, `SIN_CUPO`, `CORRELATIVIDAD_FALTANTE`,
  `SIN_REGULARIDAD`, `FUERA_DE_FECHA` o `INSCRIPCION_RECHAZADA`. Hoy el Módulo 9 solo informa
  códigos genéricos, así que todos llegan como `INSCRIPCION_RECHAZADA` con su `detail`.
- Fuera de alcance: baja de inscripción.

Pendiente: horarios anidados en el listado de cursos, códigos de error del POST,
nombre de la sede, condiciones de regularidad.

## RF3 — Historial académico y cursadas en curso

Listado de materias cursadas con, como mínimo, materia, cuatrimestre, nota y situación.
Para las cursadas en curso se muestran además la asistencia y las notas parciales.

- Vista de historial (`GET /cursadas`).
- Detalle de cursada (`GET /cursadas/{cursoId}`, ruta de pantalla `/alumnos/cursos/{cursoId}`):
  asistencia (clases dictadas, presentes, ausentes, porcentaje), situación y notas parciales.
- La asistencia se muestra porque define la situación: superado el límite de inasistencias
  el alumno queda `LIBRE`. El portal no calcula ese estado; lo lee del Módulo 9.
- Consulta en vivo, sin tabla propia.

Fuentes:

- Historial: `GET /api/planificacion/alumnos/{alumnoId}/inscripciones?periodoId={id}` (Módulo 9).
- Situación: `INSCRIPTO`, `CURSANDO`, `BAJA`, `REGULAR`, `LIBRE`, `APROBADO`, `DESAPROBADO`.
- Asistencia y notas parciales: servicio del Módulo 2, por alumno y curso.

Pendiente: endpoints y respuesta del Módulo 2; quién calcula la situación final; que el
Módulo 2 use los mismos `cursoId` y `alumnoId`; quién define el límite de inasistencias
y si lo exponen.

## RF4 — Notificación de notas

Al cargarse una nota (parcial o final), el portal muestra una notificación en tiempo real
que lleva a una página con la materia y el resultado.

- Centro de notificaciones: badge, listado, leídas / no leídas.
- Conexión directa del frontend al WebSocket de CORE. Sin consumer en el BFF.
- Al conectar o reconectar: `GET /api/v1/notifications`.
- Página propia de detalle de la nota (`GET /cursadas/{cursoId}/notas/{notaId}`), construida
  desde el `actionUrl` de la notificación: instancia, fecha, nota y resultado.

Pendiente: formato del `actionUrl` e identificadores (Módulo 2); payload de los eventos de
nota parcial y final; si CORE deriva notificación para ambos; fuente única de la nota final
(Módulo 2 o 9) para no notificar dos veces.

## RF5 — Notificación de sanción por préstamo tardío

Notificación en tiempo real que lleva al portal de Biblioteca.

- Mismo mecanismo que RF4. Tipo `LIBRARY_PENALTY_APPLIED`.
- Es una redirección real a otro frontend, no una vista propia.

Pendiente: URL oficial de destino.

## RF6 — Notificación de evento académico próximo

Notificación con enlace al portal de Eventos cuando falta una semana para un evento al que
el estudiante está inscripto.

- Mismo mecanismo que RF4. Tipo `EVENT_REMINDER`.
- Redirección real al portal de Eventos.
- La lógica de "cuándo avisar" vive en el Módulo 6.

Pendiente: confirmar el nombre del evento con que se publica en CORE.

## RF7 — Calendario académico

Vista única con turnos de comedor, eventos y exámenes, con filtros por categoría.

- `GET /calendario?desde=&hasta=&categorias=` en el BFF.
- Agregación en vivo con llamadas en paralelo a los módulos 4, 6 y 9.
- Falla parcial: se muestra lo que cargó y se avisa qué categoría falló, con opción de reintentar.
- Vista informativa (fecha, tipo, título). Los ítems no son navegables por ahora.
- Eventos: se pide el mes visible y se filtran los que tienen `yaInscripto` en true.
  El Módulo 6 filtra por solapamiento de fechas, no por fecha de inicio.
- Exámenes: hoy son ventanas generales, sin fecha por asignatura.
- Comedor: se cargan todos los turnos del rango, sin filtrar por estado, con su hora y sede.

Pendiente: si `hasta` es inclusivo en el Módulo 6 cuando se envía solo la fecha.

## RF8 — Historial de compras

Vista de solo lectura de las compras del estudiante en la Tienda.

- `GET /compras` (paginado, filtros por fecha, estado y sede) y `GET /sedes` para las opciones del filtro y `GET /compras/{orderId}`.
- Consulta en vivo a la Tienda, sin tabla propia ni caché.
- Nombres y precios congelados al momento de la compra.

Pendiente: qué campos van en el listado y cuáles en el detalle; que la Tienda confirme el
filtro por sede (y que sea por `siteId`).

## RF9 — Carga de saldo

El estudiante ve su saldo y carga saldo a su cuenta institucional.

- Saldo actual e historial de movimientos, directo contra CORE.
- Formulario de carga: monto y medio de pago simulado (`mock-approved` / `mock-rejected`).
- Cada intento genera un `Idempotency-Key` (UUID v4) para que un reintento no duplique el cobro.
- Contemplar tres resultados: 201 aprobado, 202 pendiente, 422 rechazado.
