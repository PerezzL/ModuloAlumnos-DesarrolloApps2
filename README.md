# UADEnet — Módulo 1: Portal del Estudiante

Frontend (SPA) y BFF del Portal del Estudiante de UADEnet, el sistema de gestión de campus
que construyen 10 grupos en Desarrollo de Aplicaciones II (UADE, 2° cuatrimestre 2026).

El portal no es dueño de datos académicos: consulta y agrega información de los demás
módulos a través del Gateway de CORE.

## Estado

Los 9 requisitos funcionales están implementados y funcionan contra el CORE falso, que
simula CORE y los módulos externos (bloques A a E, ver [`docs/plan.md`](docs/plan.md)). La integración con
los módulos reales depende de que confirmen sus contratos (ver [`docs/integraciones.md`](docs/integraciones.md)).
Para mostrar el portal de punta a punta: [`docs/demo-guide.md`](docs/demo-guide.md).

## Stack

- **Frontend:** React con Vite y TypeScript.
- **BFF:** Node.js con TypeScript y NestJS.
- **Contrato:** [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0), fuente de verdad de la API entre front y BFF.

## Por dónde empezar

Para entender la app, en este orden: [`docs/arquitectura.md`](docs/arquitectura.md) (cómo
funciona), [`docs/codigo.md`](docs/codigo.md) (dónde está cada cosa y cómo son los mocks),
[`docs/instalacion.md`](docs/instalacion.md) (cómo levantarla) y [`docs/pruebas.md`](docs/pruebas.md)
(cómo probarla). El resto se consulta cuando hace falta.

| Archivo | Para qué |
| --- | --- |
| [`openapi.yaml`](openapi.yaml) | Contrato entre el front y el BFF (fuente de verdad de la API propia) |
| [`docs/instalacion.md`](docs/instalacion.md) | Cómo instalar y levantar el proyecto desde cero |
| [`docs/plan.md`](docs/plan.md) | Decisiones tomadas, pasos de armado y pendientes |
| [`docs/pruebas.md`](docs/pruebas.md) | Usuarios de prueba, fallas simuladas y casos por pantalla |
| [`docs/demo-guide.md`](docs/demo-guide.md) | Guion para la demo de la segunda entrega |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Capas, recorrido de un pedido, auth, mocks, despliegue |
| [`docs/codigo.md`](docs/codigo.md) | Mapa del código: qué hay en cada app y paquete, y todas las piezas de mock |
| [`docs/requisitos.md`](docs/requisitos.md) | Los 9 requisitos funcionales |
| [`docs/pantallas.md`](docs/pantallas.md) | Pantallas y de qué endpoint sale cada una |
| [`docs/integraciones.md`](docs/integraciones.md) | Qué expone cada módulo y qué falta confirmar |
| [`docs/integracion-real.md`](docs/integracion-real.md) | Cómo conectar al CORE real y qué tocar cuando un módulo confirma |
| [`docs/core/CORE_INTEGRACION.md`](docs/core/CORE_INTEGRACION.md) | Contrato de integración de CORE |
| [`packages/fixtures/README.md`](packages/fixtures/README.md) | Qué son las fixtures y por qué casi todas son provisionales |
| [`AGENTS.md`](AGENTS.md) | Reglas para trabajar en el repo, con o sin asistentes de IA |

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
