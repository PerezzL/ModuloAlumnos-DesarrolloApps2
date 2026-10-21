# Guía de pruebas en local

Cómo probar el portal sin ningún módulo real: qué usuarios hay, qué datos tiene cada uno,
cómo simular fallas y qué casos están preparados para cada pantalla.

Para levantar todo, ver [`instalacion.md`](instalacion.md). Para entender de dónde salen los datos (las
fixtures) y por qué casi todos son provisionales, ver [`packages/fixtures/README.md`](../packages/fixtures/README.md).

## 1. Las piezas de prueba

| Pieza | Qué imita | Cuándo usarla |
| --- | --- | --- |
| **CORE falso** (`:4000`) | CORE (login, Gateway, notificaciones, saldo) y los módulos 2, 4, 5, 6, 8 y 9 | Siempre. Es lo que abre el navegador |
| **Fixtures** (`packages/fixtures/`) | Las respuestas de cada módulo externo | No se levantan: el CORE falso las sirve |
| **Prism** (`:4010`) | Nuestro BFF, a partir de [`openapi.yaml`](../openapi.yaml) | Para avanzar una pantalla antes de que exista su endpoint en el BFF |

Con el CORE falso, el camino es el real: front → Gateway → BFF → Gateway → módulo falso.
Con Prism, el BFF no interviene y los datos son los ejemplos del contrato (el alumno pasa a
llamarse "Juan Pérez"), así que los casos de esta guía no aplican.

Todo el estado del CORE falso vive en memoria: **reiniciarlo o llamar a
`POST /__falso/reset` vuelve a los datos iniciales** (inscripciones, notificaciones, saldo y
fallas). Conviene hacerlo antes de cada sesión de pruebas.

## 2. Usuarios

Todos con la contraseña `uade2026`.

| Usuario | Para qué sirve |
| --- | --- |
| `v.moreno@uade.edu.ar` | Alumna con datos en todos los módulos. Es la de casi todos los casos |
| `j.perez@uade.edu.ar` | Alumno sin datos: estados vacíos. Backoffice le devuelve `planId: null` |
| `suspendido@uade.edu.ar` | Cuenta suspendida: el login responde 403 |

## 3. Controles del CORE falso

Son endpoints que solo existen en el CORE falso, sin token, pensados para usar con `curl`
(o Postman) mientras el portal está abierto.

### Fallas simuladas

```bash
curl -X PUT localhost:4000/__falso/fallas/dining -H 'content-type: application/json' -d '{"tipo":"caido"}'
```

| `tipo` | Qué devuelve el Gateway para ese módulo |
| --- | --- |
| `caido` | 503 `GATEWAY_CIRCUIT_OPEN` |
| `invalido` | 502 `GATEWAY_UPSTREAM_FAILURE` |
| `lento` | 504 `GATEWAY_UPSTREAM_FAILURE` a los 10 s |
| `lento` con `"demoraMs": 3000` | Responde bien, 3 s tarde (para ver los estados de carga) |

| Módulo | Qué alimenta |
| --- | --- |
| `teacher` | Asistencia y notas (detalle de cursada y de nota) |
| `dining` | Comedor en el calendario |
| `events` | Eventos en el calendario |
| `academic` | Exámenes en el calendario, oferta, inscripción e historial |
| `store` | Historial de compras |
| `backoffice` | Datos del perfil (nombre, legajo, carrera, plan) y nombres de sede del calendario |
| `student` | Nuestro BFF entero (el front recibe la falla directo del Gateway) |

- `GET /__falso/fallas` muestra las activas.
- `DELETE /__falso/fallas/{modulo}` quita una.
- Para arrancar ya con fallas: `CORE_FALLAS=dining:caido,events:lento:3000` en el `.env`
  (o al lado de `docker compose up`).

### Notificaciones a demanda

```bash
curl -X POST localhost:4000/__falso/notificaciones -H 'content-type: application/json' -d '{"tipo":"EXAM_RESULT_PUBLISHED"}'
```

Tipos: `EXAM_RESULT_PUBLISHED`, `LIBRARY_PENALTY_APPLIED`, `EVENT_REMINDER`. Sin `email` va
a `v.moreno`; con `"email": "j.perez@uade.edu.ar"` va a otro alumno. Se guarda y se emite
por el socket, como hace CORE.

### Carga de saldo

El `paymentMethodToken` decide el resultado (no se aceptan números de tarjeta):

| Token | Resultado |
| --- | --- |
| `mock-approved` | 201 `POSTED`, acredita |
| `mock-rejected` | 422 `WALLET_TOPUP_REJECTED`, no acredita |
| `mock-pending` | 201 `PENDING`, no acredita y nunca se resuelve |

### Probar sin pantallas

Mientras una pantalla no existe, se puede ver lo que responde cada módulo con un token:

```bash
TOKEN=$(curl -s localhost:4000/api/v1/auth/login -H 'content-type: application/json' -d '{"email":"v.moreno@uade.edu.ar","password":"uade2026"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -s localhost:4000/api/v1/dining/calendar/me -H "Authorization: Bearer $TOKEN"
```

Las rutas de cada módulo están en [`packages/fixtures/README.md`](../packages/fixtures/README.md) (anteponiendo el prefijo del
Gateway, por ejemplo `/api/v1/academic/planificacion/cursos`). Las de nuestro BFF son
`/api/v1/student/...`, según [`openapi.yaml`](../openapi.yaml).

## 4. Casos por pantalla

Las pantallas llegan por bloques (ver [`plan.md`](plan.md)): C (Home, Calendario, Saldo,
Notificaciones), D (Inscripción, Historial, Compras) y E (detalle de cursada y de nota).
Los datos ya están para todas. Salvo que se diga otro usuario, los casos son con `v.moreno`.

### Login y sesión (bloque A)

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Login correcto | `v.moreno` | Entra al portal |
| Dominio inválido | Un email que no sea `@uade.edu.ar` | El front lo rechaza sin llamar a CORE |
| Contraseña incorrecta | Cualquier otra contraseña | Credenciales inválidas (401) |
| Demasiados intentos | Más de 5 contraseñas incorrectas en un minuto | 429 con `Retry-After` |
| Cuenta suspendida | `suspendido@uade.edu.ar` | Mensaje de cuenta suspendida (403) |
| Refresh | `CORE_ACCESS_TTL_S=30` en el `.env` y esperar | La sesión sigue sin pedir login |
| Logout | Cerrar sesión y volver atrás | Pide login, no muestra datos |

### Home y perfil (bloque C)

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Perfil completo | `v.moreno` | Valentina Moreno, legajo 1123456, Ingeniería en Informática |
| Sin datos | `j.perez` | Estados vacíos en todos los resúmenes |
| Backoffice caído | Falla `backoffice: caido` | `GET /me` responde 503 `UPSTREAM_UNAVAILABLE` (así está en el contrato) |

### Calendario (bloque C)

Datos de octubre de 2026:

| Categoría | Qué hay |
| --- | --- |
| Comedor | Turnos el 5 (12:00), el 8 (13:00) en Sede Monserrat y el 14 (12:30) en Sede Recoleta, de 45 minutos |
| Eventos | Semana de la Ingeniería (30/09 al 02/10, tiene que aparecer en octubre), Jornada de Desarrollo de Software (12/10, inscripta), Taller de oratoria (21/10, no inscripta). En noviembre, el torneo de ajedrez (7/11, inscripta) |
| Exámenes | Mesa especial del 19 al 23 de octubre; turno de diciembre del 7 al 19 |

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Mes completo | Ver octubre de 2026 | Las tres categorías |
| Falla parcial | Falla `dining: caido` (o `events`, o `academic`) | Responde 200 con las otras dos; `fuentes` marca la caída |
| Las tres caídas | Fallas en `dining`, `events` y `academic` | Error |
| Timeout | Falla `events: lento` | A los 10 s, el calendario sale sin eventos |
| Sin sedes | Falla `backoffice: caido` | Los turnos de comedor salen sin lugar; `fuentes` no marca error |
| Rango largo | Pedir más de 62 días | 400 `RANGO_INVALIDO` |
| Sin datos | `j.perez` | Sin turnos de comedor ni eventos inscriptos. Los turnos de examen son ventanas generales, iguales para todos |

### Saldo (bloque C)

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Saldo y movimientos | `v.moreno` | $ 13.500,00 y 7 movimientos (beca, cargas, compras, multa, comedor) |
| Sin movimientos | `j.perez` | $ 0,00 y estado vacío |
| Carga aprobada | Token `mock-approved` | Suma al saldo y aparece primera en los movimientos |
| Carga rechazada | `mock-rejected` | Mensaje de rechazo, el saldo no cambia |
| Carga pendiente | `mock-pending` | Mensaje de pendiente, el saldo no cambia |
| Reintento | Repetir la misma carga con la misma `Idempotency-Key` | Misma respuesta, no acredita dos veces |
| Cada intento nuevo | Dos cargas desde la pantalla | Cada una lleva su propia key y las dos acreditan |

### Notificaciones (bloque C)

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Listado | `v.moreno` | 3 notificaciones (nota, sanción de biblioteca, recordatorio de evento), 2 sin leer |
| Tiempo real | Con el portal abierto, disparar una notificación | Llega sin recargar y sube el contador |
| Socket caído | Disparar con el portal cerrado y después abrirlo | Aparece igual (se pide por REST al conectar) |
| Otro alumno | Disparar con `"email": "j.perez@uade.edu.ar"` | A `v.moreno` no le llega |
| Marcar leída / todas | Desde el centro de notificaciones | Baja el contador |
| Destino de cada tipo | Abrir cada una | Nota → detalle de nota; sanción → portal de Biblioteca; evento → portal de Eventos. Los `actionUrl` son provisionales |
| Sin notificaciones | `j.perez` | Estado vacío |

### Inscripción (bloque D)

Pantalla **Académico** (`/academico`). La oferta es del 1° cuatrimestre de 2027, con la
inscripción abierta del 28/09 al 19/12/2026. La arma el BFF cruzando cursos, correlatividades
e historial.

| Asignatura (comisión) | Qué se espera |
| --- | --- |
| Sistemas Operativos (A) | Se puede inscribir: correlativas cumplidas y con cupo |
| Algoritmos y Estructuras de Datos (B) | Se puede inscribir (la recursa: quedó libre en 2025) |
| Algoritmos y Estructuras de Datos (A) | Sin cupo (40/40) → `SIN_CUPO` |
| Desarrollo de Aplicaciones II | Bloqueada: le falta regularizar Desarrollo de Aplicaciones I (la está cursando) |
| Bases de Datos II | Bloqueada: le falta aprobar Bases de Datos I |

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Inscripción correcta | Sistemas Operativos | Confirmación; el cupo pasa de 10 a 11 y aparece en Mis Cursos |
| Ya inscripto | Con dos pestañas abiertas, inscribirse en las dos | La segunda muestra "Ya estás inscripto" (`YA_INSCRIPTO`) |
| Sin cupo al enviar | Llenar la comisión desde otra pestaña antes de confirmar | "La comisión se quedó sin cupo" (`SIN_CUPO`) |
| Sin plan | `j.perez` (`planId: null`) | Aviso de que no se pudo confirmar el plan y oferta de todos los planes (`filtradaPorPlan: false`) |
| Inscripción cerrada | `GET /inscripcion/oferta?periodoId=2026-2` | `inscripcionAbierta: false`; en pantalla, aviso y sin botones |
| Módulo 9 caído | Falla `academic: caido` | Error de servicio no disponible; el POST no se reintenta solo |

El CORE falso no simula `SIN_REGULARIDAD` ni `FUERA_DE_FECHA`. Después de probar, hacé
`POST /__falso/reset` para deshacer las inscripciones.

### Historial de cursadas (bloque D)

Pantalla **Mis Cursos** (`/mis-cursos`): arriba las cursadas en curso, con enlace al detalle
(`/alumnos/cursos/{cursoId}`, en construcción hasta el bloque E); abajo el resto del historial,
con filtro por período.

| Asignatura | Período | Estado |
| --- | --- | --- |
| Programación I | 2° cuat. 2025 | Aprobado, 8 |
| Matemática Discreta | 2° cuat. 2025 | Aprobado, 7 |
| Algoritmos y Estructuras de Datos | 2° cuat. 2025 | Libre |
| Programación II | 1° cuat. 2026 | Regular |
| Bases de Datos I | 2° cuat. 2026 | Cursando (tiene detalle) |
| Desarrollo de Aplicaciones I | 2° cuat. 2026 | Cursando (tiene detalle) |

### Historial de compras (bloque D)

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Listado | `v.moreno` | 3 compras: dos completadas (Monserrat y Recoleta) y una cancelada |
| Detalle | Abrir una | Productos, cantidades, precio unitario y total |
| Compra ajena | Pedir el id de una compra de `v.moreno` con el token de `j.perez` | 404 |
| Sin compras | `j.perez` | Estado vacío |
| Tienda caída | Falla `store: caido` | Error de servicio no disponible |

### Detalle de cursada y de nota (bloque E)

Todo lo del Módulo 2 es suposición nuestra (no hay contrato).

| Caso | Cómo | Qué se espera |
| --- | --- | --- |
| Asistencia con alerta | Bases de Datos I | 5 de 8 clases (62,5 %); alerta: le queda 1 falta (límite 4) |
| Asistencia sin límite | Desarrollo de Aplicaciones I | 8 de 8 clases; sin indicador de faltas |
| Alumno libre | Algoritmos y Estructuras de Datos, entrando por URL: `/alumnos/cursos/curso-ayed-2025-2-a` (desde Mis cursos solo enlazan las cursadas en curso) | "Quedaste libre" en lugar del indicador; sin notas (estado vacío) |
| Notas | Desarrollo de Aplicaciones I | 1er parcial 4 (desaprobado) y recuperatorio pendiente |
| Detalle de nota | Abrir el 1er parcial de Desarrollo de Aplicaciones I | Nota 4, docente y observaciones; enlace para volver a la cursada |
| Nota desde la notificación | Tocar "Se publicó tu nota de Bases de Datos I" en la campana | Detalle del 1er parcial: nota 7, sin observaciones |
| Curso o nota ajenos | `/alumnos/cursos/no-existe` o `/cursadas/curso-bd1-2026-2-a/notas/no-existe` | "No encontramos esa cursada" / "esa nota" |
| Módulo 2 caído | Falla `teacher: caido` | El detalle sale con el encabezado y un aviso con reintento en asistencia y en notas (`DOCENTE` en `fuentesConError`); el detalle de nota muestra error |

Sin clases dictadas (estado vacío en lugar de 0 %) no tiene caso en las fixtures: se prueba
con los tests del front.

## 5. Fechas de los datos

Los datos están armados alrededor del **4 de octubre de 2026** (cursada del 2° cuatrimestre
en curso, inscripción al 1° de 2027 abierta). Con el tiempo, algunos casos cambian solos;
por ejemplo, después del 19/12/2026 la inscripción figura cerrada. Si eso molesta, se
actualizan las fechas de las fixtures (y esta guía).
