# Plan de construcción

Estado al 4 de octubre de 2026: **bloque A terminado** (PR `bloque/esqueleto`). Este archivo se actualiza a medida que se cierran decisiones
y pasos. El porqué de cada decisión está en `arquitectura.md`.

## Repositorio

`git@github.com:PerezzL/ModuloAlumnos-DesarrolloApps2.git`

## Decisiones tomadas

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | BFF | Node.js con TypeScript y NestJS |
| 2 | Frontend | React con Vite y TypeScript; Tailwind CSS + shadcn/ui |
| 3 | Repo | Monorepo con npm workspaces; tipos generados desde `openapi.yaml` |
| 4 | Mocks | CORE falso que hace de Gateway + Prism para el contrato del BFF |
| 5 | Testing | Vitest en todo el monorepo; fixtures compartidas; respuestas validadas contra `openapi.yaml`; `npm run verify` (ver abajo) |
| 6 | Forma de trabajo | Bloques grandes: una rama y un PR por bloque, un commit por tarjeta; CI con `verify`; Trello como reflejo (ver abajo) |
| 7 | Orden de features | Home → Calendario → Saldo y Notificaciones → Inscripción → Historial → Compras → Módulo 2 (ver abajo) |
| 8 | Librerías del front | React Router + TanStack Query |
| 9 | Librerías del BFF | `fetch` nativo, `nestjs-pino` (con `X-Correlation-Id`), configuración validada con zod |
| 10 | Caché | En memoria con TTL, por instancia, solo para datos de baja variación |
| — | Docker | Dockerfile por app y docker-compose; el desarrollo diario no depende de él |
| — | Despliegue | Proveedor sin elegir; todo configurable por variables de entorno |
| — | Equipo | Sin reparto: el trabajo lo hace una persona con el agente. Sin revisores obligatorios ni protección de `main` |

Además: base de datos y Redis no se levantan hasta que haya algo que persistir.

## Decisiones pendientes

| Bloque | Tema |
| --- | --- |
| D | Qué hacer si el Módulo 8 no devuelve `planId` |
| Entrega final | Proveedor de despliegue y dominio (cookie de refresh de CORE) |

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
- Plantilla de PR: tarjetas incluidas y checklist (contrato, `integraciones.md`, `verify`).
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

Criterio: primero lo que tiene contrato firme y lo que deja armado un patrón reutilizable.
Calendario es el primer feature del BFF porque obliga a resolver una sola vez las llamadas en
paralelo, la falla parcial y los errores del Gateway. Inscripción va después, sobre mocks,
porque depende de `planId` (Módulo 8) y de endpoints del Módulo 9 que todavía no están.

## Estructura objetivo

```
uadenet-portal-estudiante/
├── AGENTS.md · CLAUDE.md · README.md
├── openapi.yaml
├── docker-compose.yml
├── package.json              ← workspaces y scripts de raíz
├── .env.example
├── docs/
│   ├── plan.md · arquitectura.md · integraciones.md · requisitos.md · pantallas.md
│   └── core/CORE_INTEGRACION.md
├── apps/
│   ├── web/                  ← React + Vite
│   ├── bff/                  ← NestJS
│   └── core-falso/           ← Gateway, auth, notificaciones, saldo y módulos de mentira
└── packages/
    └── api-types/            ← generado, fuera de git
```

## Pasos de armado

Cada paso termina con algo que se puede correr y verificar.

1. **Repo base.** Ya están copiados `AGENTS.md`, `CLAUDE.md`, `README.md`, `.gitignore`,
   `openapi.yaml` y `docs/`. Falta: `git init`, conectar el remoto, `package.json` con
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
   (ver Testing). Agregarlo a la sección "Comandos" de `AGENTS.md`.
9. **docker-compose.** web, BFF, core-falso y Prism con un comando. README con los pasos.
10. **CORE falso, parte 2.** Módulos externos desde fixtures, fallas simuladas,
    notificaciones por socket.io y saldo.
11. **Features**, por bloques (C, D y E).

## Correcciones al contrato

Aplicadas (T03): ítem de comedor con `todoElDia: true` y sin hora; `GET /calendario` devuelve
400 `RANGO_INVALIDO` si el rango supera 62 días; `asistencia` nullable válido en OpenAPI 3.0.

Pendiente para el front: el deep link de la nota depende del `actionUrl` del Módulo 2; la
traducción de `actionUrl` a ruta propia se aísla en un solo lugar.

## Pendientes externos

- **CORE:** dominio de los portales (por la cookie de refresh), URL pública o red compartida,
  ambiente de pruebas, credenciales de servicio si hicieran falta.
- **Módulo 2:** endpoints y respuesta de asistencia y notas; formato del `actionUrl`.
- **Módulo 8:** campos del endpoint de usuarios y si incluye `planId`.
- Resto: ver `integraciones.md`.
