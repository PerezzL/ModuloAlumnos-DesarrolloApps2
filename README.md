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
| `docs/instalacion.md` | Cómo instalar y levantar el proyecto desde cero |
| `docs/plan.md` | Decisiones tomadas, pasos de armado y pendientes |
| `docs/arquitectura.md` | Capas, recorrido de un pedido, auth, mocks, despliegue |
| `docs/requisitos.md` | Los 9 requisitos funcionales |
| `docs/pantallas.md` | Pantallas y de qué endpoint sale cada una |
| `docs/integraciones.md` | Qué expone cada módulo y qué falta confirmar |
| `docs/core/CORE_INTEGRACION.md` | Contrato de integración de CORE |
| `AGENTS.md` | Reglas para trabajar en el repo, con o sin asistentes de IA |

## Instalar y ejecutar

**Guía completa desde cero (Mac y Windows), Node vs. Docker y qué es Prism:
[`docs/instalacion.md`](docs/instalacion.md).**

Resumen, con Node 24 instalado:

```bash
npm install
cp .env.example .env   # Windows: Copy-Item .env.example .env
npm run dev
```

O con Docker: `docker compose up --build`.

Portal en http://localhost:5173 · usuario de prueba `v.moreno@uade.edu.ar` / `uade2026`.

Antes de subir cambios: `npm run verify` (lo mismo que corre el CI). Con el stack de Docker
levantado, `scripts/smoke-docker.sh` corre los chequeos del job `docker`.
