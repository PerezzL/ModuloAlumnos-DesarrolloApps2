# Fixtures de los módulos externos

JSON de ejemplo con la forma en que responde cada módulo (después de que el Gateway de CORE
reescribe la ruta). Los usan dos lugares, y tienen que ser los mismos:

- el CORE falso (`apps/core-falso`), que los sirve detrás del Gateway;
- los tests de cada adaptador del BFF (JSON del módulo → modelo de `openapi.yaml`).

Reglas (ver `AGENTS.md`):

- Una carpeta por módulo, con el nombre de su prefijo en el Gateway (`dining`, `events`,
  `store`, `backoffice`, `academic`, `teacher`) y `core` para lo que el front consume de CORE.
- Los que dependen de un contrato no confirmado se llaman `*.provisional.json`. Qué está
  confirmado y qué no se registra en `docs/integraciones.md`.
- Los datos son del alumno de prueba `v.moreno@uade.edu.ar`
  (`ba310c57-a684-4dbf-a4a4-905fcfbefa08`). `j.perez@uade.edu.ar` no tiene datos, para
  probar los estados vacíos.
- Cuando un archivo agrupa la respuesta de varias consultas (por ejemplo, por curso), es un
  objeto con la clave de la consulta y, como valor, la respuesta del módulo.

| Archivo | Ruta del módulo (ya reescrita) |
| --- | --- |
| `dining/reservations-me.provisional.json` | `GET /api/v1/reservations/me` |
| `events/eventos.json` | `GET /api/v1/eventos` (y cada ítem, `GET /api/v1/eventos/{id}`) |
| `store/orders-me.provisional.json` | `GET /api/v1/orders/me` (y cada ítem, `GET /api/v1/orders/{orderId}`) |
| `backoffice/users.provisional.json` | `GET /api/v1/users/{userId}`, por id |
| `academic/periodos.provisional.json` | `GET /api/v1/planificacion/periodos` |
| `academic/turnos-examen.provisional.json` | `GET /api/v1/planificacion/turnos-examen` |
| `academic/cursos.provisional.json` | `GET /api/v1/planificacion/cursos?periodoId=&planId=` |
| `academic/correlatividades.provisional.json` | `GET /api/v1/academica/asignaturas/{id}/correlatividades`, por asignatura |
| `academic/inscripciones-alumno.provisional.json` | `GET /api/v1/planificacion/alumnos/{alumnoId}/inscripciones` |
| `teacher/asistencia.provisional.json` | `GET /api/v1/cursos/{cursoId}/alumnos/{alumnoId}/asistencia`, por curso |
| `teacher/notas.provisional.json` | `GET /api/v1/cursos/{cursoId}/alumnos/{alumnoId}/notas`, por curso |
| `core/notificaciones.provisional.json` | Semilla de `GET /api/v1/notifications` |
| `core/wallet-me.provisional.json` | `GET /api/v1/wallets/me` |
| `core/transacciones.provisional.json` | Semilla de `GET /api/v1/wallets/me/transactions` |
