# UADEnet — Módulo 1: Portal del Estudiante

Frontend (SPA) y BFF del Portal del Estudiante de UADEnet, el sistema de gestión de campus
que construyen 10 grupos en Desarrollo de Aplicaciones II (UADE, 2° cuatrimestre 2026).

El portal no es dueño de datos académicos: consulta y agrega información de los demás
módulos a través del Gateway de CORE.

## Estado

En armado. Todavía no hay código: el repo tiene el contrato de la API, la documentación y
el plan de construcción.

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

Pendiente: se completa cuando esté armado el esqueleto (ver `docs/plan.md`).
