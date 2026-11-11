# UADEnet — Módulo 1: Portal del Estudiante

Frontend (SPA) y BFF del Portal del Estudiante de UADEnet, el sistema de gestión de campus
que construyen 10 grupos en Desarrollo de Aplicaciones II (UADE, 2° cuatrimestre 2026).

**Integrantes:** 
- Penalva, Santiago Nicolás - 1182245
- Alvarez Russo, Matias - 1127552
- Artimiak, Jonathan - 1187099 
- Pérez Márquez, Lucas - 1148703
- Martinez Blanco, Abril - 1156495
- Cóceres Antun, José Ignacio - 1131108




El portal no es dueño de datos académicos: consulta y agrega información de los demás
módulos a través del Gateway de CORE. Los 9 requisitos funcionales están implementados.

## Cómo correrlo

Como los demás módulos todavía no están integrados, el portal se levanta junto con un
**CORE falso** (`apps/core-falso`): hace de Gateway, login, notificaciones y saldo, y responde
como los módulos externos con datos de prueba. Con un solo comando quedan corriendo las tres
piezas: portal, BFF y CORE falso.

### Opción A: Docker (no hace falta instalar Node)

Con Docker Desktop (o OrbStack) abierto, en la carpeta del proyecto:

```bash
docker compose up --build
```

La primera vez tarda unos minutos porque descarga imágenes y compila. Para bajar todo:
`Ctrl+C` y después `docker compose down`.

### Opción B: Node 24

```bash
npm install
cp .env.example .env
npm run dev
```

En Windows (PowerShell), el segundo comando es `Copy-Item .env.example .env`.
`npm run dev` deja corriendo los tres procesos en la misma terminal; se cortan con `Ctrl+C`.

### Entrar

Abrir **http://localhost:5173** (con `localhost`, no `127.0.0.1`: la cookie de sesión y el
CORE falso dependen de ese nombre).

| Usuario | Contraseña | Para qué |
| --- | --- | --- |
| `v.moreno@uade.edu.ar` | `uade2026` | Alumna con datos en todos los módulos |
| `j.perez@uade.edu.ar` | `uade2026` | Alumno sin datos: muestra los estados vacíos |
| `suspendido@uade.edu.ar` | `uade2026` | Cuenta suspendida: el login lo rechaza |

| Servicio | URL |
| --- | --- |
| Portal | http://localhost:5173 |
| BFF (documentación de la API, Swagger UI) | http://localhost:3000/docs |
| CORE falso (Gateway) | http://localhost:4000 |

Para simular la caída de un módulo, disparar una notificación en tiempo real o probar la
carga de saldo, ver [`docs/pruebas.md`](docs/pruebas.md). Si algo no levanta, la sección
"Problemas comunes" de [`docs/instalacion.md`](docs/instalacion.md).

## Stack

- **Frontend:** React con Vite y TypeScript (`apps/web`).
- **BFF:** Node.js con TypeScript y NestJS (`apps/bff`).
- **Contrato:** [`openapi.yaml`](openapi.yaml) (OpenAPI 3.0), fuente de verdad de la API entre front y BFF.
- **CORE falso:** Express y socket.io (`apps/core-falso`), solo para desarrollo y demo.

## Documentación

| Archivo | Para qué |
| --- | --- |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Capas, recorrido de un pedido, seguridad, resiliencia, integraciones y stack |
| [`docs/codigo.md`](docs/codigo.md) | Mapa del código: qué hay en cada app y paquete, y las piezas de mock |
| [`docs/instalacion.md`](docs/instalacion.md) | Instalación detallada (Mac y Windows), Node vs. Docker, problemas comunes |
| [`docs/pruebas.md`](docs/pruebas.md) | Usuarios de prueba, fallas simuladas y casos preparados por pantalla |
| [`docs/requisitos.md`](docs/requisitos.md) | Los 9 requisitos funcionales |
| [`docs/pantallas.md`](docs/pantallas.md) | Pantallas y de qué endpoint sale cada una |
| [`docs/integraciones.md`](docs/integraciones.md) | Qué consume el portal de cada módulo y qué está confirmado |
| [`packages/fixtures/README.md`](packages/fixtures/README.md) | Las respuestas de ejemplo de los módulos externos |
| [`AGENTS.md`](AGENTS.md) | Reglas técnicas del repo, para personas y asistentes de IA |

## Comandos útiles

| Comando | Qué hace |
| --- | --- |
| `npm run verify` | Genera los tipos, typecheck, ESLint, valida el contrato y corre los tests (lo mismo que el CI) |
| `npm test` | Solo los tests |
| `npm run mock` | Prism en :4010: un mock del BFF armado con los ejemplos de [`openapi.yaml`](openapi.yaml) |
