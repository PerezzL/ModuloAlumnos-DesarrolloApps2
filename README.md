# UADEnet — Módulo 1: Portal del Estudiante

Frontend (SPA) y BFF del Portal del Estudiante de UADEnet, el sistema de gestión de campus
que construyen 10 grupos en Desarrollo de Aplicaciones II (UADE, 2° cuatrimestre 2026).

El portal no es dueño de datos académicos: consulta y agrega información de los demás
módulos a través del Gateway de CORE.

## Estado

Bloque A (esqueleto) terminado: login, sesión, BFF con health, guard JWT y errores,
CORE falso con auth y Gateway, mock del contrato con Prism y CI. Las pantallas con datos
llegan en los bloques siguientes (ver `docs/plan.md`).

## Stack

- **Frontend:** React con Vite y TypeScript.
- **BFF:** Node.js con TypeScript y NestJS.
- **Contrato:** `openapi.yaml` (OpenAPI 3.0), fuente de verdad de la API entre front y BFF.

## Por dónde empezar

| Archivo | Para qué |
| --- | --- |
| `docs/plan.md` | Decisiones tomadas, pasos de armado y pendientes |
| `docs/arquitectura.md` | Capas, recorrido de un pedido, auth, mocks, despliegue |
| `docs/requisitos.md` | Los 9 requisitos funcionales |
| `docs/pantallas.md` | Pantallas y de qué endpoint sale cada una |
| `docs/integraciones.md` | Qué expone cada módulo y qué falta confirmar |
| `docs/core/CORE_INTEGRACION.md` | Contrato de integración de CORE |
| `AGENTS.md` | Reglas para trabajar en el repo, con o sin asistentes de IA |

## Instalar y ejecutar

### Con Node (desarrollo diario)

Requiere Node 24 (`.nvmrc`).

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` levanta tres procesos:

| Proceso | URL | Qué es |
| --- | --- | --- |
| web | http://localhost:5173 | Front (Vite) |
| core-falso | http://localhost:4000 | CORE de mentira: auth, JWKS y Gateway |
| bff | http://localhost:3000 | BFF (NestJS). Swagger UI en http://localhost:3000/docs |

Usuario de prueba: `v.moreno@uade.edu.ar` / `uade2026` (hay más en
`apps/core-falso/src/usuarios.ts`, incluida una cuenta suspendida).

El navegador solo habla con el Gateway (`:4000`), que reenvía `/api/v1/student/*` al BFF.
Para que el front reciba los ejemplos del contrato en lugar del BFF:

```bash
npm run mock
```

y en `.env`: `STUDENT_SERVICE_URL=http://localhost:4010` (reiniciar `npm run dev`).

### Con Docker

```bash
docker compose up --build
```

Levanta web (http://localhost:5173), CORE falso (`:4000`), BFF (`:3000`) y Prism (`:4010`).
Para usar Prism detrás del Gateway: `STUDENT_SERVICE_URL=http://prism:4010 docker compose up --build`.

### Verificar

```bash
npm run verify
```

Tipos, lint, `redocly lint` del contrato y tests. Es lo mismo que corre el CI en cada PR.
