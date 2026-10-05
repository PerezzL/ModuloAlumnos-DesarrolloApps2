# Integración real

Qué hacer cuando el portal deja de depender del CORE falso. Tiene dos partes:

1. **Conectar el portal al CORE real**: qué cambiar el día que CORE tenga un ambiente.
2. **Cuando un módulo confirma su contrato**: qué tocar, módulo por módulo.

El estado de cada contrato (qué está confirmado y qué no) vive en `integraciones.md`; este
archivo dice **qué hacer** con cada novedad. Si una confirmación cambia algo de acá, se
actualizan los dos.

## Parte 1 — Conectar el portal al CORE real

### Qué nos tiene que dar CORE

Todo esto está pendiente (tarjeta "[CORE] Dominio de los portales…" en Trello):

| Dato | Valor |
| --- | --- |
| URL pública del Gateway | _pendiente_ |
| URL del JWKS | _pendiente_ |
| `iss` y `aud` de los tokens | _pendiente_ |
| URL del WebSocket de notificaciones | _pendiente_ |
| Dominio bajo el que se sirven los portales (por la cookie de refresh) | _pendiente_ |
| Si el Gateway espera una URL pública del BFF o una red compartida | _pendiente_ |
| Usuarios de prueba en su ambiente | _pendiente_ |
| Prefijo y rutas de cada módulo detrás del Gateway | _pendiente_ (hoy usamos la suposición de `integraciones.md`) |

### Variables que cambian

Ninguna URL está en el código: pasar a CORE real es cambiar estas variables.

| Variable | App | Hoy (CORE falso) | Con CORE real |
| --- | --- | --- | --- |
| `GATEWAY_URL` | BFF | `http://localhost:4000` | URL del Gateway |
| `JWKS_URL` | BFF | `http://localhost:4000/.well-known/jwks.json` | JWKS de CORE |
| `JWT_ISSUER` | BFF | `http://localhost:4000` | `iss` de CORE |
| `JWT_AUDIENCE` | BFF | `uadenet` | `aud` de CORE |
| `PREFIJO_*` | BFF | `/api/v1/{modulo}` | Los que confirme CORE (solo si difieren) |
| `VITE_GATEWAY_URL` | Front | `http://localhost:4000` | URL del Gateway |
| `VITE_NOTIFICATIONS_URL` | Front | `http://localhost:4000/notifications` | WebSocket de CORE |
| `VITE_BIBLIOTECA_URL` | Front | `https://biblioteca.uadenet.example` | Portal de Biblioteca (Módulo 3) |
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
  el hosting del front para login, refresh y logout (ver `arquitectura.md`, "Despliegue").

### Lo que deja de existir

- **Usuarios de prueba** (`v.moreno`, `j.perez`, `suspendido`): se usan los que dé CORE.
- **Controles `/__falso/*`**: no hay fallas simuladas, reset ni notificaciones a demanda.
  Las notificaciones las tienen que generar los módulos reales.
- **Carga pendiente:** el formulario de saldo ofrece "Pago diferido de prueba"
  (`mock-pending`, en `apps/web/src/componentes/CargaSaldo.tsx`), que solo existe en el CORE
  falso. Contra CORE real hay que ocultarlo (todavía no hay una variable para eso).

### Cómo verificar

Recorrer la tarjeta "[Integración] CORE" de Trello y la sección 14 de
`core/CORE_INTEGRACION.md`. Como mínimo:

- [ ] `GET /health/live` y `GET /health/ready` del BFF responden.
- [ ] Login con un usuario de CORE y entrada al Home.
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

1. **Registrar:** actualizar `integraciones.md` (estado y detalle) y comentar en la tarjeta
   del módulo en "Esperando a otros módulos".
2. **Rama:** una rama y un PR por integración, con la misma forma de trabajo de los bloques
   (`AGENTS.md`).
3. **Fixture primero:** corregirla con la respuesta real y quitarle `.provisional` del
   nombre. Actualizar las referencias en el CORE falso y en los tests
   (`grep -r "<nombre-de-la-fixture>"`).
4. **Tipo de origen:** ajustar el `*.origen.ts` del adaptador (el schema zod de lo que manda
   el módulo).
5. **Mapper:** ajustar el `*.mapper.ts` hasta que pase su `*.mapper.test.ts`.
6. **Contrato:** si se confirma un campo marcado `x-provisional` en `openapi.yaml`, quitarle
   la marca y correr `npm run gen`. Si nuestro modelo tiene que cambiar, el cambio empieza
   en `openapi.yaml`.
7. **Decisiones:** revisar las decisiones de `plan.md` que dependían de la suposición (ver
   cada ficha).
8. **Casos de prueba:** si cambian datos, actualizar `pruebas.md` y `demo-guide.md`.
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
| Falta confirmar | Su `contracts/openapi.yaml`: forma de `GET /api/v1/wallets/me`, del ítem de notificación, los `code` de idempotencia y del 502; rutas detrás del Gateway |
| Fixtures | `packages/fixtures/core/` (`wallet-me`, `transacciones`, `notificaciones`, todas provisionales) |
| Código | Front: `apps/web/src/core/` (`saldo.ts`, `notificaciones.ts`, `cargaSaldo.ts`). Errores del Gateway: `apps/bff/src/gateway/gateway.client.ts`, `apps/bff/src/modulos/comun.ts` y `apps/web/src/api/errores.ts` (`UPSTREAM_INVALID` es supuesto). CORE falso: `saldo.ts`, `notificaciones.ts`, `gateway.ts` |
| Contrato | No toca `openapi.yaml`: el front consume a CORE directo |
| Si cambian las rutas | Actualizar la tabla "Rutas detrás del Gateway" de `integraciones.md`, los `PREFIJO_*` (`.env.example`, `docker-compose.yml`) y el CORE falso |
| Trello | "[CORE] Pedir contracts/openapi.yaml…" (Backlog) e "[Integración] CORE" |

#### Módulo 2 — Docente

| | |
| --- | --- |
| Falta confirmar | Todo: endpoints y respuesta de asistencia y notas, formato del `actionUrl`, límite de inasistencias, ids compartidos con el Módulo 9 |
| Fixtures | `packages/fixtures/teacher/asistencia.provisional.json`, `notas.provisional.json` |
| Adaptador | `apps/bff/src/modulos/docente/`. Lo usa `apps/bff/src/cursadas/` (detalle de cursada y de nota) |
| Front | `apps/web/src/notificaciones/destino.ts` (único lugar que conoce el `actionUrl`); `apps/web/src/cursadas/IndicadorFaltas.tsx` (umbral de la alerta) |
| Contrato | `Asistencia`, `NotaResumen`, `InstanciaExamen`, `ResultadoExamen` y `NotaDetalle`: suposición nuestra; es lo más probable que cambie |
| Decisiones | **12**: el `examId` del `actionUrl` es el `notaId`; un 404 del Módulo 2 cuenta como falla de `DOCENTE`; asistencia y notas fallan por separado; alerta con 1 o 0 faltas restantes |
| Pruebas y demo | `pruebas.md` "Detalle de cursada y de nota"; `demo-guide.md` pasos 6 y 7 |
| Trello | "[Módulo 2 · Docente]…", "[Módulos 2 y 9] Fuente única de la nota final" e "[Integración] Módulo 2" |

#### Módulo 3 — Biblioteca

| | |
| --- | --- |
| Falta confirmar | URL oficial del detalle de la sanción (adelantaron `/library/{loanId}/penalty`) |
| Código | `apps/web/src/notificaciones/destino.ts` (formato del `actionUrl`) y `VITE_BIBLIOTECA_URL` |
| Fixtures | El ítem `LIBRARY_PENALTY_APPLIED` de `packages/fixtures/core/notificaciones.provisional.json` |
| Trello | "[Módulo 3 · Biblioteca]…" (no tiene tarjeta de integración: es solo una redirección) |

#### Módulo 4 — Comedor

| | |
| --- | --- |
| Falta confirmar | Hora del turno en `slot.date`, campos de `slot` y `campus`, ruta definitiva |
| Fixtures | `packages/fixtures/dining/reservations-me.provisional.json`, `reservations-me-vacio.provisional.json` |
| Adaptador | `apps/bff/src/modulos/comedor/`. Si llega la hora, el mapper deja de marcar los turnos con `todoElDia` |
| Pruebas y demo | `pruebas.md` "Calendario" (hoy "todo el día"); `demo-guide.md` paso 4 |
| Trello | "[Módulo 4 · Comedor]…" e "[Integración] Módulo 4" |

#### Módulo 5 — Tienda

| | |
| --- | --- |
| Falta confirmar | Campos del listado y del detalle, filtro por sede, ruta definitiva |
| Fixtures | `packages/fixtures/store/orders-me.provisional.json` |
| Adaptador | `apps/bff/src/modulos/tienda/`. Lo usa `apps/bff/src/compras/` |
| Contrato | Parámetro de sede de `GET /compras` y `CompraResumen` (`x-provisional`). Si no suman el filtro por sede, se quita el parámetro |
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
| Falta confirmar | Campos de `GET /api/v1/backoffice/users/{userId}` y si incluye `planId` |
| Fixtures | `packages/fixtures/backoffice/users.provisional.json` |
| Adaptador | `apps/bff/src/modulos/backoffice/`. Lo usan `apps/bff/src/perfil/` y `apps/bff/src/inscripcion/` (para el `planId`) |
| Contrato | `Perfil`: `nombre`, `apellido`, `legajo`, `carrera`, `planId` (`x-provisional`) |
| Decisiones | **11**: oferta sin filtrar por plan si no hay `planId` (`filtradaPorPlan`, en `apps/bff/src/inscripcion/oferta.ts`). Si Backoffice lo trae siempre, revisar si el caso sigue haciendo falta |
| Pruebas y demo | `pruebas.md` "Home y perfil" e "Inscripción" (caso "Sin plan" con `j.perez`); `demo-guide.md` pasos 3 y 5 |
| Trello | "[Módulo 8 · Backoffice]…" e "[Integración] Módulo 8" |

#### Módulo 9 — Gestión Académica

| | |
| --- | --- |
| Falta confirmar | Que estén disponibles los endpoints comprometidos (filtro `planId`, `asignatura` anidada, inscripciones por alumno); códigos de error del POST; horarios anidados; sede; regularidad |
| Fixtures | Todas las de `packages/fixtures/academic/` (cursos, correlatividades, períodos, turnos de examen, inscripciones del alumno, inscripción creada y rechazos) |
| Adaptador | `apps/bff/src/modulos/academico/`. La traducción de códigos de rechazo está solo en `academico.mapper.ts` (hoy es identidad). Lo usan `inscripcion/`, `cursadas/` y `calendario/` |
| Contrato | `Comision.sede`, `Comision.horarios`, `ProblemaInscripcion.code` (`x-provisional`) |
| Decisiones | **11** (filtro por plan) |
| Pendiente propio | T16 (Backlog): simular `SIN_REGULARIDAD` y `FUERA_DE_FECHA` en el CORE falso; conviene hacerlo con los códigos reales |
| Pruebas y demo | `pruebas.md` "Inscripción" e "Historial"; `demo-guide.md` pasos 5 y 6 |
| Trello | "[Módulo 9 · Gestión Académica]…", "[Módulos 2 y 9] Fuente única de la nota final" e "[Integración] Módulo 9" |
