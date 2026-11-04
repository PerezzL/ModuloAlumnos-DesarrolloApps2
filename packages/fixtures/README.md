# Fixtures de los módulos externos

## Qué son

Una fixture es un archivo JSON con una **respuesta de ejemplo de un módulo externo**,
escrita a mano con la forma en que ese módulo responde (o en que creemos que responde).
Por ejemplo, `dining/calendar-me.json` es lo que devolvería el Comedor si
`v.moreno` le pide sus turnos.

No es código ni configuración: son datos de prueba. Cambiar una fixture cambia lo que ve el
portal en local y lo que prueban los tests, nada más.

## Para qué sirven

El portal depende de seis módulos externos (2, 4, 5, 6, 8 y 9) y de CORE, y casi ninguno
está disponible todavía. Las fixtures permiten trabajar sin ellos, en dos lugares a la vez:

1. **El CORE falso las sirve** (`apps/core-falso`). Cuando el BFF le pide algo a un módulo
   por el Gateway en local, recibe la fixture. Así el portal funciona completo, con datos
   coherentes, sin ningún servicio real.
2. **Los tests de los adaptadores del BFF las usan como entrada.** Cada adaptador convierte
   la respuesta de un módulo a nuestro modelo de [`openapi.yaml`](../../openapi.yaml); el test le pasa la fixture
   y verifica el resultado.

Que sean **los mismos archivos** en los dos lugares es a propósito: lo que se ve en la demo
y lo que prueban los tests no se pueden desalinear. Si un módulo cambia su respuesta, se
corrige la fixture, falla el test del adaptador y se ve exactamente qué ajustar.

## Por qué casi todas son provisionales

Una fixture se llama `*.provisional.json` cuando **la forma de la respuesta no está
confirmada** por el módulo dueño: algunos nombres de campo, tipos o estructuras son
suposición nuestra. Pasa por dos motivos:

- **El módulo informó qué datos trae, pero no con qué nombres o forma.** Backoffice adelantó
  `careers` con el `planId`, pero todavía no lo publicó.
- **El endpoint existe, pero no tenemos la respuesta.** Varios endpoints del Módulo 9 están
  implementados, pero solo conocemos la ruta. Lo mismo con partes de CORE (`wallets/me`, el
  ítem de notificación), porque no tenemos su `contracts/openapi.yaml`.

Además, las rutas detrás del Gateway están sin confirmar para los módulos 4, 5, 8 y 9 y
usamos una suposición ("prefijo + recurso"). Todo eso está detallado, módulo por módulo, en
[`docs/integraciones.md`](../../docs/integraciones.md).

Las fixtures del Módulo 2 (`teacher/*.json`) están confirmadas por su OpenAPI. También
`events/eventos.json`: el Módulo 6 documentó todos sus
campos.

**Qué implica para el código** (regla de [`AGENTS.md`](../../AGENTS.md)): fuera del adaptador de cada módulo,
nadie depende de cómo viene la respuesta. Si un módulo responde distinto a lo supuesto, se
toca solo su fixture y su adaptador. La UI tolera que los campos marcados `x-provisional`
en [`openapi.yaml`](../../openapi.yaml) vengan vacíos o null.

## Cómo deja de ser provisional

Cuando un módulo confirma o cambia su respuesta:

1. Se actualiza [`docs/integraciones.md`](../../docs/integraciones.md) y se comenta en su tarjeta de Trello de "Esperando
   a otros módulos".
2. Se corrige la fixture con la forma real y se le quita `.provisional` del nombre
   (y se actualizan las referencias en el CORE falso y en los tests).
3. Se ajusta el adaptador hasta que su test pase.
4. Si corresponde, se quita `x-provisional` del campo en [`openapi.yaml`](../../openapi.yaml).

## Reglas

- Una carpeta por módulo, con el nombre de su prefijo en el Gateway (`dining`, `events`,
  `store`, `backoffice`, `academic`, `teacher`) y `core` para lo que el front consume de CORE.
- Si no se conoce un campo, no se inventa en el código: va en la fixture provisional y se
  registra en [`docs/integraciones.md`](../../docs/integraciones.md).
- Los datos son del alumno de prueba `v.moreno@uade.edu.ar`
  (`ba310c57-a684-4dbf-a4a4-905fcfbefa08`). `j.perez@uade.edu.ar` no tiene datos, para
  probar los estados vacíos.
- Los datos tienen que ser coherentes entre módulos (mismas asignaturas, cursos, compras e
  importes) y con fechas alrededor de octubre de 2026. Los casos que se pueden probar con
  ellos están en [`docs/pruebas.md`](../../docs/pruebas.md); si cambiás una fixture, revisá que sigan valiendo.
- Cuando un archivo agrupa la respuesta de varias consultas (por ejemplo, por curso), es un
  objeto con la clave de la consulta y, como valor, la respuesta del módulo.

## Archivos

| Archivo | Ruta del módulo (ya reescrita por el Gateway) |
| --- | --- |
| `dining/calendar-me.json` | `GET /api/v1/calendar/me?from=&to=` |
| `events/eventos.json` | `GET /api/v1/eventos` (y cada ítem, `GET /api/v1/eventos/{id}`) |
| `store/orders-me.json` | `GET /api/v1/orders/me?status=&siteId=&from=&to=&limit=&cursor=` (y cada ítem, `GET /api/v1/orders/{id}`) |
| `backoffice/users.provisional.json` | `GET /api/v1/users/{userId}`, por id |
| `backoffice/sites.json` | `GET /api/v1/sites` (y cada ítem, `GET /api/v1/sites/{siteId}`) |
| `academic/carreras.provisional.json` | `GET /api/v1/academica/carreras` |
| `academic/periodos.provisional.json` | `GET /api/v1/planificacion/periodos` |
| `academic/turnos-examen.provisional.json` | `GET /api/v1/planificacion/turnos-examen` |
| `academic/cursos.provisional.json` | `GET /api/v1/planificacion/cursos?periodoId=&planId=` |
| `academic/correlatividades.provisional.json` | `GET /api/v1/academica/asignaturas/{id}/correlatividades`, por asignatura |
| `academic/inscripciones-alumno.provisional.json` | `GET /api/v1/planificacion/alumnos/{alumnoId}/inscripciones` |
| `teacher/attendance.json` | `GET /api/v1/students/{studentId}/courses/{courseId}/attendance`, por curso |
| `teacher/grades.json` | `GET /api/v1/students/{studentId}/courses/{courseId}/grades`, por curso |
| `teacher/results.json` | `GET /api/v1/students/{studentId}/results`, por alumno |
| `core/notificaciones.provisional.json` | Semilla de `GET /api/v1/notifications` |
| `core/wallet-me.json` | `GET /api/v1/wallets/me` |
| `core/transacciones.json` | Semilla de `GET /api/v1/wallets/me/transactions` |

Las "semillas" son el estado inicial: el CORE falso las carga en memoria al arrancar y
después cambian (una notificación nueva, una carga de saldo). `POST /__falso/reset` vuelve
a ellas.
