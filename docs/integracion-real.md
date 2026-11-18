# Integración real

Qué hacer cuando el portal deja de depender del CORE falso. Tiene dos partes:

1. **Conectar el portal al CORE real**: qué cambiar el día que CORE tenga un ambiente.
2. **Cuando un módulo confirma su contrato**: qué tocar, módulo por módulo.

El estado de cada contrato (qué está confirmado y qué no) vive en [`integraciones.md`](integraciones.md); este
archivo dice **qué hacer** con cada novedad. Si una confirmación cambia algo de acá, se
actualizan los dos.

## Parte 1 — Conectar el portal al CORE real

### Qué nos tiene que dar CORE

CORE está desplegado en Railway desde sus novedades del 4 de noviembre de 2026. Lo que sigue
pendiente se sigue en la tarjeta "[CORE] Dominio de los portales…" de Trello:

| Dato | Valor |
| --- | --- |
| URL pública del Gateway | `https://core-api-production-e458.up.railway.app` |
| URL del JWKS | `https://core-api-production-e458.up.railway.app/.well-known/jwks.json` |
| `iss` y `aud` de los tokens | `iss`: la URL de la API en Railway (antes `http://localhost:3000`); `aud`: `uadenet`. Falta ver con un token real si el `iss` termina en `/`: `jose` compara el valor exacto |
| URL del WebSocket de notificaciones | _pendiente_; no figura en su OpenAPI. Suponemos `<URL del Gateway>/notifications` |
| Dominio bajo el que se sirven los portales (por la cookie de refresh) | _pendiente_ |
| Si el Gateway espera una URL pública del BFF o una red compartida | _pendiente_ |
| Usuarios de prueba en su ambiente | Hay uno STUDENT, uno TEACHER y uno ADMIN; las credenciales se piden por privado a CORE |
| Límite de pedidos | 100 por minuto por IP de cliente, en toda la API (`x-ratelimit-limit: 100`). Pendiente: si aplica al proxy `/api/v1/{module}/*`, porque todo lo que pide el BFF sale de una sola IP (ver "Del lado de CORE") |
| Prefijo y rutas de cada módulo detrás del Gateway | _pendiente_ (hoy usamos la suposición de [`integraciones.md`](integraciones.md)) |

### Variables que cambian

Ninguna URL está en el código: pasar a CORE real es cambiar estas variables.

| Variable | App | Hoy (CORE falso) | Con CORE real |
| --- | --- | --- | --- |
| `GATEWAY_URL` | BFF | `http://localhost:4000` | `https://core-api-production-e458.up.railway.app` |
| `JWKS_URL` | BFF | `http://localhost:4000/.well-known/jwks.json` | `https://core-api-production-e458.up.railway.app/.well-known/jwks.json` |
| `JWT_ISSUER` | BFF | `http://localhost:4000` | `https://core-api-production-e458.up.railway.app` (a confirmar con un token real) |
| `JWT_AUDIENCE` | BFF | `uadenet` | `uadenet` |
| `PREFIJO_*` | BFF | `/api/v1/{modulo}` | Los mismos: el OpenAPI de CORE registra `student`, `teacher`, `library`, etc. |
| `VITE_GATEWAY_URL` | Front | `http://localhost:4000` | `https://core-api-production-e458.up.railway.app` |
| `VITE_NOTIFICATIONS_URL` | Front | `http://localhost:4000/notifications` | `https://core-api-production-e458.up.railway.app/notifications` (supuesto) |
| `VITE_BIBLIOTECA_URL` | Front | `https://asignia.app/uade-net` | Portal de Biblioteca (Módulo 3) |
| `VITE_EVENTOS_URL` | Front | `https://eventos.uadenet.example` | Portal de Eventos (Módulo 6) |

Las `VITE_*` quedan fijas **al compilar** el front: cambiarlas obliga a reconstruirlo
(`npm run build` o una imagen nueva de Docker).

Las variables del CORE falso (`CORE_*`, `STUDENT_SERVICE_URL`, `{MODULO}_SERVICE_URL`,
`WEB_ORIGIN`) dejan de usarse: el CORE falso no se levanta.

### Docker

Hoy `docker-compose.yml` sirve solo para el CORE falso: el BFF tiene
`GATEWAY_URL: http://core-falso:4000` fijo y el front se compila con `localhost:4000`.
Cuando tengamos los valores de CORE, hay que agregar un compose aparte (por ejemplo,
`docker-compose.core-real.yml`) que levante solo `web` y `bff`, sin `core-falso` ni Prism,
con las variables de la tabla anterior.

### Del lado de CORE

- **Registrar nuestro BFF:** pasarle a CORE la URL pública del BFF para su
  `STUDENT_SERVICE_URL` (con `/api/v1` incluido). Depende del despliegue (tarjeta E02).
- **Timeout:** el BFF tiene que responder antes de los 10 s del Gateway. Ojo con los planes
  de hosting que apagan el servicio por inactividad.
- **Cookie de refresh:** es `SameSite=Lax` y la define CORE. Si el front no queda bajo el
  mismo sitio que CORE, la sesión se pierde al recargar. Plan B: una regla de reescritura en
  el hosting del front para login, refresh y logout (ver [`arquitectura.md`](arquitectura.md), "Despliegue").
  El CORS de producción acepta `http://localhost:5173` con credenciales, pero desde
  `localhost` la cookie `Lax` tampoco viaja en el `POST /auth/refresh`: probarlo con un
  usuario real antes de dar por buena la sesión.
- **Límite de pedidos:** CORE limita a 100 pedidos por minuto por IP de cliente
  (`TRUST_PROXY_HOPS=1` en Railway). Todo lo que el BFF pide al Gateway sale de la IP del BFF,
  y una sola pantalla puede hacer varios pedidos (el calendario hace tres): si el límite
  aplica al proxy, todos los alumnos juntos comparten esos 100. Hay que preguntarle a CORE
  si el proxy está exento o si pueden darle al BFF un límite propio. Un 429 del Gateway hoy
  llega al alumno como error del módulo.

### Lo que deja de existir

- **Usuarios de prueba** (`v.moreno`, `j.perez`, `suspendido`): se usan los que dé CORE.
- **Controles `/__falso/*`**: no hay fallas simuladas, reset ni notificaciones a demanda.
  Las notificaciones las tienen que generar los módulos reales.
- **Carga pendiente:** el formulario de saldo ofrece "Pago diferido de prueba"
  (`mock-pending`, en `apps/web/src/componentes/CargaSaldo.tsx`), que solo existe en el CORE
  falso. Contra CORE real hay que ocultarlo (todavía no hay una variable para eso).

### Cómo verificar

Recorrer la tarjeta "[Integración] CORE" de Trello y la sección 14 de
[`core/CORE_INTEGRACION.md`](core/CORE_INTEGRACION.md). Como mínimo:

- [ ] `GET /health/live` y `GET /health/ready` del BFF responden.
- [ ] Login con un usuario de CORE y entrada al Home.
- [ ] El `iss` del token coincide exacto con `JWT_ISSUER` (si no, el BFF responde 401 a todo).
- [ ] El token trae el claim `careerIds` y el Perfil muestra la carrera. Si no lo trae, la
      carrera sale de Backoffice (ver [`integraciones.md`](integraciones.md), Módulo 8).
- [ ] Recargar la página no pierde la sesión (cookie de refresh).
- [ ] Una pantalla que pasa por el BFF (Perfil o Calendario) trae datos: prueba que el
      Gateway llega al BFF con `X-User-Id` y que el guard valida los tokens reales.
- [ ] Saldo y movimientos; una carga con `mock-approved`.
- [ ] El socket de notificaciones conecta (sin errores en la consola del navegador).
- [ ] Logout.

### Modo intermedio: un módulo real con el CORE falso

Antes de que CORE tenga ambiente, se puede probar un módulo real con el resto falso: el
CORE falso reenvía ese módulo a su servicio en lugar de responder con la fixture.

```bash
ACADEMIC_SERVICE_URL=http://<servicio-del-modulo-9>/api/v1 npm run dev
```

Vale para `TEACHER`, `DINING`, `STORE`, `EVENTS`, `BACKOFFICE` y `ACADEMIC`, con la base
incluida (ver `.env.example`). Limitación: el token lo firma el CORE falso; si el módulo
valida el JWT contra el JWKS real de CORE, lo va a rechazar, y en ese caso solo sirve si el
módulo confía en los headers `X-User-*` del Gateway.

## Parte 2 — Cuando un módulo confirma su contrato

### Pasos comunes

1. **Registrar:** actualizar [`integraciones.md`](integraciones.md) (estado y detalle) y comentar en la tarjeta
   del módulo en "Esperando a otros módulos".
2. **Rama:** una rama y un PR por integración, con la misma forma de trabajo de los bloques
   ([`AGENTS.md`](../AGENTS.md)).
3. **Fixture primero:** corregirla con la respuesta real y quitarle `.provisional` del
   nombre. Actualizar las referencias en el CORE falso y en los tests
   (`grep -r "<nombre-de-la-fixture>"`).
4. **Tipo de origen:** ajustar el `*.origen.ts` del adaptador (el schema zod de lo que manda
   el módulo).
5. **Mapper:** ajustar el `*.mapper.ts` hasta que pase su `*.mapper.test.ts`.
6. **Contrato:** si se confirma un campo marcado `x-provisional` en [`openapi.yaml`](../openapi.yaml), quitarle
   la marca y correr `npm run gen`. Si nuestro modelo tiene que cambiar, el cambio empieza
   en [`openapi.yaml`](../openapi.yaml).
7. **Decisiones:** revisar las decisiones de [`plan.md`](plan.md) que dependían de la suposición (ver
   cada ficha).
8. **Casos de prueba:** si cambian datos, actualizar [`pruebas.md`](pruebas.md) y [`demo-guide.md`](demo-guide.md).
9. `npm run verify` y probar contra el CORE falso; si el módulo ya está disponible, también
   con el modo intermedio.
10. **Trello:** al cerrar, la tarjeta de "Integración real" del módulo pasa a revisión.

### Fichas por módulo

Rutas relativas a la raíz del repo. Cada adaptador del BFF está en
`apps/bff/src/modulos/<carpeta>/` y tiene `*.origen.ts` (forma del módulo),
`*.mapper.ts` y su test, `*.adapter.ts` (llamadas HTTP) y, a veces, `*.modelo.ts`.
El módulo de mentira de cada uno está en `apps/core-falso/src/modulos/`.

#### CORE

| | |
| --- | --- |
| OpenAPI | https://core-api-production-e458.up.railway.app/docs-json (formas de auth, saldo, notificaciones y errores del Gateway: ya aplicadas) |
| Falta confirmar | Formato del `actionUrl` de cada notificación; que cada módulo sirva sus rutas bajo `/api/v1`; que `careerIds` viaje en el JWT; paginación con `cursor` en `/notifications` y `/wallets/me/transactions`; si el límite de 100 pedidos por minuto aplica al proxy |
| Fixtures | `packages/fixtures/core/` (`wallet-me.json` y `transacciones.json` confirmadas; `notificaciones.provisional.json` por el `actionUrl`) |
| Código | Front: `apps/web/src/core/` (`saldo.ts`, `notificaciones.ts`, `cargaSaldo.ts`). Claim `careerIds`: `apps/bff/src/auth/jwt.guard.ts` (`idsDeCarrera`). Errores del Gateway: `apps/bff/src/gateway/gateway.client.ts`, `apps/bff/src/modulos/comun.ts` y `apps/web/src/api/errores.ts` (deciden por status). CORE falso: `saldo.ts`, `notificaciones.ts`, `gateway.ts` |
| Contrato | No toca [`openapi.yaml`](../openapi.yaml): el front consume a CORE directo |
| Si cambian las rutas | Actualizar la tabla "Rutas detrás del Gateway" de [`integraciones.md`](integraciones.md), los `PREFIJO_*` (`.env.example`, `docker-compose.yml`) y el CORE falso |
| Trello | "[CORE] Pedir contracts/openapi.yaml…" (Backlog) e "[Integración] CORE" |

#### Módulo 2 — Docente

| | |
| --- | --- |
| Falta confirmar | La ruta del `actionUrl` de `TEACHER_EXAM_RESULT_PUBLISHED` (les propusimos `/cursadas/{courseId}/notas/{examId}`) y el acceso con el token del alumno (con CORE) |
| Fixtures | `packages/fixtures/teacher/attendance.json`, `grades.json`, `results.json` (confirmadas; los `courseId` siguen los de las fixtures académicas) |
| Adaptador | `apps/bff/src/modulos/docente/`. Lo usa `apps/bff/src/cursadas/` (historial, detalle de cursada y de nota) |
| Front | `apps/web/src/notificaciones/destino.ts` (único lugar que conoce el `actionUrl`: cuando confirmen la ruta, dejar una sola); `apps/web/src/cursadas/IndicadorCondicion.tsx` (margen de la alerta) |
| Contrato | `Asistencia`, `NotaResumen`, `NotaDetalle` y la nota final del historial: confirmados |
| Decisiones | **12**: el `examId` es el `notaId`; un 404 del Módulo 2 cuenta como falla de `DOCENTE`; cada llamada falla por separado; la nota final sale del Módulo 2 y no del 9; el nombre del docente sale de Backoffice con `gradedBy` |
| Pruebas y demo | [`pruebas.md`](pruebas.md) "Detalle de cursada y de nota"; [`demo-guide.md`](demo-guide.md) pasos 6 y 7 |
| Trello | "[Módulo 2 · Docente]…", "[Módulos 2 y 9] Fuente única de la nota final" e "[Integración] Módulo 2" |

#### Módulo 3 — Biblioteca

| | |
| --- | --- |
| Confirmado | Destino `https://asignia.app/uade-net/prestamos/{loanId}`. Falta que CORE confirme si el `actionUrl` llega relativo o absoluto (se aceptan los dos) |
| Código | `apps/web/src/notificaciones/destino.ts` (formato del `actionUrl`) y `VITE_BIBLIOTECA_URL` |
| Fixtures | El ítem `LIBRARY_PENALTY_APPLIED` de `packages/fixtures/core/notificaciones.provisional.json` |
| Trello | "[Módulo 3 · Biblioteca]…" (no tiene tarjeta de integración: es solo una redirección) |

#### Módulo 4 — Comedor

| | |
| --- | --- |
| Falta confirmar | Que `siteId` sea el id de sede de Backoffice y que solo lleguen turnos `RESERVED` |
| Fixtures | `packages/fixtures/dining/calendar-me.json`, `calendar-me-vacio.json`; sedes en `backoffice/sites.json` |
| Adaptador | `apps/bff/src/modulos/comedor/`. El nombre de la sede sale de `nombresDeSedes()` del adaptador de Backoffice |
| Pruebas y demo | [`pruebas.md`](pruebas.md) "Calendario"; [`demo-guide.md`](demo-guide.md) paso 4 |
| Trello | "[Módulo 4 · Comedor]…" e "[Integración] Módulo 4" |

#### Módulo 5 — Tienda

| | |
| --- | --- |
| Falta confirmar | Que el `siteId` de las órdenes sea el de Backoffice |
| Fixtures | `packages/fixtures/store/orders-me.json` |
| Adaptador | `apps/bff/src/modulos/tienda/`. Lo usa `apps/bff/src/compras/` |
| Contrato | Parámetro `sede` de `GET /compras` (`x-provisional`): se quita la marca cuando confirmen el `siteId`. Si usaran otro id, el adaptador tendría que traducirlo con `/store/sites` |
| Trello | "[Módulo 5 · Tienda]…" e "[Integración] Módulo 5" |

#### Módulo 6 — Eventos

| | |
| --- | --- |
| Falta confirmar | Si `hasta` es inclusivo con solo la fecha; nombre del recordatorio en el catálogo de CORE |
| Fixtures | `packages/fixtures/events/eventos.json` (ya confirmada) |
| Adaptador | `apps/bff/src/modulos/eventos/eventos.adapter.ts` pide hasta el día siguiente para cubrir los dos casos; si `hasta` es inclusivo, se puede simplificar |
| Trello | "[Módulo 6 · Eventos]…" e "[Integración] Módulo 6" |

#### Módulo 8 — Backoffice

| | |
| --- | --- |
| Falta confirmar | Que publiquen `careers: [{ careerId, planId }]`; la ruta definitiva de la ficha (lo define CORE) y el permiso de lectura |
| Fixtures | `packages/fixtures/backoffice/users.provisional.json`; el nombre de la carrera sale de `academic/carreras.provisional.json` (Módulo 9) |
| Adaptador | `apps/bff/src/modulos/backoffice/`. Lo usan `apps/bff/src/perfil/` (que resuelve el nombre de la carrera con el Módulo 9) y `apps/bff/src/inscripcion/` (para el `planId`). Si se manejan varias carreras, ver [`integraciones.md`](integraciones.md) |
| Contrato | `Perfil`: `carrera` y `planId` (`x-provisional`); `nombre`, `apellido` y `legajo` ya están confirmados |
| Decisiones | **11**: sin `planId` de Backoffice, la oferta usa el plan activo de la carrera en el Módulo 9; sin carrera, sale sin materias (`filtradaPorPlan: false`, en `apps/bff/src/inscripcion/inscripcion.service.ts`). Si Backoffice publica `careers`, revisar si el respaldo sigue haciendo falta |
| Pruebas y demo | [`pruebas.md`](pruebas.md) "Home y perfil" e "Inscripción" (caso "Sin plan" con `j.perez`); [`demo-guide.md`](demo-guide.md) pasos 3 y 5 |
| Trello | "[Módulo 8 · Backoffice]…" e "[Integración] Módulo 8" |

#### Módulo 9 — Gestión Académica

| | |
| --- | --- |
| Falta confirmar | Que CORE confirme el pedido del Módulo 9 (rutas y formas); con qué status llegan los rechazos y si van a informar el motivo con un código propio; si `curso.periodo` viene anidado en las inscripciones del alumno; si `numero` del período es siempre el cuatrimestre; acceso con el token del alumno |
| Fixtures | Todas las de `packages/fixtures/academic/` (cursos, materias del plan, carreras, correlatividades, períodos, turnos de examen, inscripciones del alumno, inscripción creada y rechazos). Ya siguen las formas publicadas: al confirmarse, se reemplazan por respuestas reales y se les quita `.provisional` |
| Adaptador | `apps/bff/src/modulos/academico/`. La traducción de rechazos está solo en `academico.mapper.ts` (hoy todo es `INSCRIPCION_RECHAZADA` con el `detail`; la tabla `MOTIVOS` espera códigos por motivo). Lo usan `inscripcion/`, `cursadas/`, `calendario/` y `perfil/` |
| Contrato | `Comision.sede`, `Comision.horarios`, `ProblemaInscripcion.code` (`x-provisional`) |
| Decisiones | **11** (plan del alumno y oferta sin plan) |
| Pendiente propio | T16 (Backlog) queda sin sentido mientras el Módulo 9 use códigos genéricos: el CORE falso ya simula los rechazos con su forma |
| Pruebas y demo | [`pruebas.md`](pruebas.md) "Inscripción" e "Historial"; [`demo-guide.md`](demo-guide.md) pasos 5 y 6 |
| Trello | "[Módulo 9 · Gestión Académica]…", "[Módulos 2 y 9] Fuente única de la nota final" e "[Integración] Módulo 9" |

## Anexo: despliegue (movido de arquitectura.md)

Todavía no se eligió proveedor; no hace falta hasta la entrega final (la segunda entrega
se muestra en local con compose).

- **BFF:** se puede hostear en cualquier lado; a CORE se le pasa la URL para
  `STUDENT_SERVICE_URL`. Tiene que responder dentro del timeout de 10 s del Gateway
  (ojo con planes que duermen el servicio).
- **Frontend:** archivos estáticos. El proveedor es libre, pero el dominio no: la cookie de
  refresh es `SameSite=Lax` y la define CORE, así que el navegador solo la envía si el front
  está bajo el mismo sitio que CORE. Si no, la sesión se pierde al recargar.
- **Red interna:** CORE pide que el módulo no sea accesible desde afuera. No se arma red
  privada; el riesgo se cubre con la validación local del JWT.

Lo que se respeta desde ya para no atarse a ningún proveedor: toda URL es configuración
(Gateway, JWKS, issuer, audience, WebSocket), el BFF no guarda estado y expone
`GET /health/live` y `GET /health/ready`.

**Pendiente con CORE:** bajo qué dominio se sirven los portales, si esperan URL pública o
red compartida, y si habrá ambiente de pruebas. Plan B para la cookie: regla de reescritura
en el hosting del front para login, refresh y logout.
