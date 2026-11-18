# Plan de construcción

Estado al 5 de octubre de 2026: **bloques A a E mergeados** (PRs #1 a #6). Sigue la
preparación de la segunda entrega (rama `bloque/entrega-2`; guion en [`demo-guide.md`](demo-guide.md)). Este archivo se actualiza a medida que se cierran decisiones
y pasos. El porqué de cada decisión está en [`arquitectura.md`](arquitectura.md).

## Repositorio

`git@github.com:PerezzL/ModuloAlumnos-DesarrolloApps2.git`

## Decisiones tomadas

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | BFF | Node.js con TypeScript y NestJS |
| 2 | Frontend | React con Vite y TypeScript; Tailwind CSS + shadcn/ui |
| 3 | Repo | Monorepo con npm workspaces; tipos generados desde [`openapi.yaml`](../openapi.yaml) |
| 4 | Mocks | CORE falso que hace de Gateway + Prism para el contrato del BFF |
| 5 | Testing | Vitest en todo el monorepo; fixtures compartidas; respuestas validadas contra [`openapi.yaml`](../openapi.yaml); `npm run verify` (ver abajo) |
| 6 | Forma de trabajo | Bloques grandes: una rama y un PR por bloque, un commit por tarjeta; CI con `verify`; Trello como reflejo (ver abajo) |
| 7 | Orden de features | Home → Calendario → Saldo y Notificaciones → Inscripción → Historial → Compras → Módulo 2 (ver abajo) |
| 8 | Librerías del front | React Router + TanStack Query |
| 9 | Librerías del BFF | `fetch` nativo, `nestjs-pino` (con `X-Correlation-Id`), configuración validada con zod |
| 10 | Caché | En memoria con TTL, por instancia, solo para datos de baja variación |
| — | Docker | Dockerfile por app y docker-compose; el desarrollo diario no depende de él |
| — | Despliegue | Proveedor sin elegir; todo configurable por variables de entorno |
| — | Equipo | Sin reparto: el trabajo lo hace una persona con el agente. Sin revisores obligatorios ni protección de `main` |
| 11 | Oferta sin `planId` | Si Backoffice no devuelve el `planId`, se usa el plan activo de la carrera en el Módulo 9. Si tampoco hay carrera, la oferta sale sin materias y con `filtradaPorPlan: false` (ver abajo) |
| 12 | Módulo 2 | El `examId` es el `notaId`; un 404 del Módulo 2 para un curso que el Módulo 9 tiene cuenta como falla de `DOCENTE`; cada llamada falla por separado. Con el contrato confirmado (bloque `docente-contrato`): condición por asistencia contra el mínimo que informa el Módulo 2, sin faltas restantes; nota final desde sus actas; docente desde Backoffice; sin observaciones (ver [`integraciones.md`](integraciones.md)) |

Además: base de datos y Redis no se levantan hasta que haya algo que persistir.

## Decisiones pendientes

| Bloque | Tema |
| --- | --- |
| Entrega final | Proveedor de despliegue y dominio (cookie de refresh de CORE) |

## Oferta sin `planId` (decisión 11)

El Módulo 9 no filtra los cursos por plan ni trae el nombre de la materia: las dos cosas salen
de `GET /academica/planes/{planId}/asignaturas`. Sin plan no hay de dónde sacar los nombres,
así que ya no se puede ofrecer "todo sin filtrar" (lo que hacía esta decisión antes del
pedido del Módulo 9 a CORE, noviembre 2026).

El plan sale de Backoffice (el de la carrera del alumno) y, si no lo informa o no responde,
del plan activo de esa carrera en el Módulo 9 (`/academica/carreras/con-ultimo-plan-activo`).
La carrera sale del token (`careerIds`) o de Backoffice. Si no hay carrera, o el catálogo de
carreras falla, el BFF registra un warning y devuelve la oferta sin materias con
`filtradaPorPlan: false`; la pantalla avisa que no pudo confirmar el plan.

## Testing (decisión 5)

- **Runner:** Vitest en front, BFF y core-falso. En el BFF, `unplugin-swc` para los decoradores de Nest.
- **Fixtures:** `packages/fixtures/<modulo>/*.json`. Las usan los tests de adaptadores y las
  sirve el CORE falso. Las que dependen de un contrato no confirmado se nombran `*.provisional.json`.
- **Adaptadores:** cada uno separado en dos partes:
  - mapper puro (JSON del módulo → modelo del contrato), testeado con fixtures;
  - cliente HTTP, testeado con `msw`: 502, 503, 504 y timeout de 10 s → problem+json con `code`.
- **Contrato:** `redocly lint openapi.yaml` para el YAML. Tests e2e del BFF con `supertest` y
  un helper que valida cada respuesta con ajv contra el schema del YAML (registrando
  `x-provisional` como keyword).
- **Front:** Vitest + Testing Library + `msw`. Prioridad: refresh serializado, token solo en
  memoria, dominio `@uade.edu.ar`, traducción de `actionUrl`, campos provisionales en null.
  Sin objetivo de cobertura de UI.
- **Lint:** ESLint (flat config) + typescript-eslint + Prettier. Reglas propias:
  `no-restricted-globals` para `localStorage`/`sessionStorage` en `apps/web`;
  `no-restricted-imports` para que los tipos crudos de un módulo externo no salgan de su adaptador.
- **`npm run verify`:** `gen` → `tsc -b` → `eslint` → `redocly lint` → `vitest run`.

## Forma de trabajo (decisión 6)

- Se trabaja por **bloque** (ver abajo): un plan por bloque, revisado antes de arrancar.
- Una rama `bloque/<nombre>` y un PR por bloque. Adentro, un commit por tarjeta con su
  código en el título (`T07: guard JWT`). Se mergea sin squash para conservar esos commits.
- CI: GitHub Actions corre `npm run verify` en cada PR. Sin revisores obligatorios: el PR
  queda como registro del bloque. El build de Docker se suma con el paso 9.
- Plantilla de PR: tarjetas incluidas y checklist (contrato, [`integraciones.md`](integraciones.md), `verify`).
- Trello se sincroniza al cerrar cada bloque. No dirige el trabajo; sirve para mostrar la
  organización y para ver qué falta.

## Bloques (decisión 7)

| Bloque | Contenido |
| --- | --- |
| A · Esqueleto | T00–T12, T15 y H01–H05 (login, sesión, rutas protegidas y logout) |
| B · CORE falso parte 2 | T13, T14. Rama `bloque/core-falso-2`, sale de `bloque/esqueleto` mientras el PR #1 no esté mergeado |
| C · Features firmes | Header/Home (`GET /me`), Calendario, Saldo, Centro de notificaciones |
| D · Features provisionales | Inscripción, Historial, Compras |
| E · Módulo 2 | Detalle de cursada y detalle de nota, contra la suposición del contrato |
| Docente contrato | Asistencia, notas, nota final y notificación con el contrato confirmado del Módulo 2 |
| Entrega 2 | Guion de demo (E01) y ajustes que surjan al ensayarla |

Criterio: primero lo que tiene contrato firme y lo que deja armado un patrón reutilizable.
Calendario es el primer feature del BFF porque obliga a resolver una sola vez las llamadas en
paralelo, la falla parcial y los errores del Gateway. Inscripción va después, sobre mocks,
porque depende de `planId` (Módulo 8) y de endpoints del Módulo 9 que todavía no están.

## Estructura

El mapa actual del repo, carpeta por carpeta, está en [`codigo.md`](codigo.md).

## Pasos de armado

Cada paso termina con algo que se puede correr y verificar.

1. **Repo base.** Ya están copiados [`AGENTS.md`](../AGENTS.md), [`CLAUDE.md`](../CLAUDE.md), [`README.md`](../README.md), `.gitignore`,
   [`openapi.yaml`](../openapi.yaml) y `docs/`. Falta: `git init`, conectar el remoto, `package.json` con
   workspaces y `.env.example`.
2. **Tipos.** `packages/api-types` con el script `npm run gen` (openapi-typescript).
   Verificación: el paquete compila.
3. **BFF mínimo.** Proyecto NestJS con `GET /health/live` y `GET /health/ready`, configuración
   por variables de entorno y filtro de errores en problem+json.
4. **CORE falso, parte 1.** Login, refresh, logout, `auth/me`, JWKS y reenvío de
   `/api/v1/student/*` con los headers `X-User-*`.
5. **Guard del BFF.** Validación RS256 contra el JWKS, con caché de claves.
   Verificación: un pedido sin token o con token inválido devuelve 401.
6. **Front mínimo.** Proyecto Vite, cliente `openapi-fetch`, login contra el CORE falso,
   token en memoria, refresh serializado, ruta protegida y header.
7. **Prism.** Mock del contrato del BFF para que las pantallas avancen sin esperar endpoints.
8. **Comando de verificación.** Un único script de raíz: tipos + lint + tests + validación del contrato
   (ver Testing). Agregarlo a la sección "Comandos" de [`AGENTS.md`](../AGENTS.md).
9. **docker-compose.** web, BFF, core-falso y Prism con un comando. README con los pasos.
10. **CORE falso, parte 2.** Módulos externos desde fixtures, fallas simuladas,
    notificaciones por socket.io y saldo.
11. **Features**, por bloques (C, D y E).

## Correcciones al contrato

Aplicadas (T03): ítem de comedor con `todoElDia: true` y sin hora; `GET /calendario` devuelve
400 `RANGO_INVALIDO` si el rango supera 62 días; `asistencia` nullable válido en OpenAPI 3.0.

Pendiente para el front: el Módulo 2 espera que le digamos la ruta del `actionUrl` de la nota
(propuesta: `/cursadas/{courseId}/notas/{examId}`); hasta entonces `destino.ts` acepta las dos.

## Para sumar al calendario

Datos que el Módulo 9 ya expone y RF7 no pide (mensaje de integración, octubre 2026). Se
pueden agregar como ítems de Gestión Académica sin pedirle nada nuevo:

- **Inscripción a finales:** `inscripcionDesde` / `inscripcionHasta` de cada turno de examen
  (mismo endpoint que ya usamos para los turnos).
- **Cuatrimestre:** inicio y fin de cursada (`fechaInicio` / `fechaFin`) y ventana de
  inscripción a materias de cada período.
- **Clases de cada cursada:** día y horario del curso, entre su `fechaInicio` y `fechaFin`.
  Sale del endpoint de inscripciones del alumno, que trae el curso con su horario (forma
  publicada en el pedido del Módulo 9 a CORE, noviembre 2026).

## Pendientes externos

- **CORE:** dominio de los portales (por la cookie de refresh), URL pública o red compartida,
  ambiente de pruebas. Las credenciales de servicio ya están asignadas (`student-service`).
- **Módulo 2:** confirmar la ruta del `actionUrl` que les propusimos. El acceso con el token
  del alumno se ve con CORE.
- **Módulo 8:** campos del endpoint de usuarios y si incluye `planId`.
- Resto: ver [`integraciones.md`](integraciones.md).
