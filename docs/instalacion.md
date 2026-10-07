# Guía de instalación desde cero

Para quien clona el repo por primera vez. Al final de esta guía tenés el portal corriendo en
http://localhost:5173 y podés entrar con un usuario de prueba.

Hay **dos formas** de levantar todo: con Node (a mano) o con Docker. Para programar se usa
Node; Docker sirve para levantar todo igual en cualquier máquina sin instalar nada más.
La sección [Node o Docker](#node-o-docker-qué-cambia) explica la diferencia.

## 1. Qué instalar

| Herramienta | Para qué | Mac | Windows |
| --- | --- | --- | --- |
| **Git** | Clonar el repo | Viene con las Command Line Tools: `xcode-select --install` | [Git for Windows](https://git-scm.com/download/win) o `winget install Git.Git` |
| **Node.js 24** | Correr y desarrollar el proyecto | `brew install node@24` o [nodejs.org](https://nodejs.org) (versión 24 LTS) | `winget install OpenJS.NodeJS.LTS` o [nodejs.org](https://nodejs.org) |
| **Docker** (opcional) | Levantar todo con un comando | [OrbStack](https://orbstack.dev) (`brew install --cask orbstack`) o Docker Desktop | [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pide activar WSL 2; aceptar y reiniciar) |
| **Editor** | — | VS Code recomendado | VS Code recomendado |

Si no tenés Homebrew en Mac: https://brew.sh.

Comprobar en una terminal nueva (en Windows, PowerShell):

```bash
git --version
node --version   # tiene que decir v24.x (o mayor)
npm --version
docker --version # solo si instalaste Docker
```

Si `node --version` muestra otra versión y usás `nvm`, en la carpeta del repo alcanza con
`nvm use` (lee `.nvmrc`).

## 2. Clonar el repo

Necesitás acceso al repo en GitHub (pedíselo a quien lo administra).

```bash
git clone https://github.com/PerezzL/ModuloAlumnos-DesarrolloApps2.git
cd ModuloAlumnos-DesarrolloApps2
```

## 3A. Levantar con Node (para desarrollar)

**Mac (Terminal):**

```bash
npm install
cp .env.example .env
npm run dev
```

**Windows (PowerShell):**

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

`npm install` puede mostrar un aviso de "install scripts not yet covered by allowScripts":
es esperable y no impide que todo funcione.

`npm run dev` deja corriendo tres procesos en la misma terminal (se cortan con `Ctrl+C`):

| Proceso | URL | Qué es |
| --- | --- | --- |
| web | http://localhost:5173 | El portal (lo que se abre en el navegador) |
| core-falso | http://localhost:4000 | Imitación de CORE: login, tokens, Gateway y los módulos externos (ver [CORE falso](#core-falso-módulos-externos-y-fallas)) |
| bff | http://localhost:3000 | Nuestro backend. Documentación de la API en http://localhost:3000/docs |

Abrí http://localhost:5173 y entrá con **`v.moreno@uade.edu.ar` / `uade2026`**.
Hay más usuarios en `apps/core-falso/src/usuarios.ts` (por ejemplo, uno suspendido para
probar ese error).

Al editar código, cada proceso se recarga solo.

## 3B. Levantar con Docker (sin instalar Node)

Con Docker abierto (OrbStack o Docker Desktop corriendo):

```bash
docker compose up --build
```

Es el mismo comando en Mac y en Windows. La primera vez tarda unos minutos porque descarga
imágenes y compila todo. Después: http://localhost:5173, mismo usuario de prueba.

Para bajar todo: `Ctrl+C` y después `docker compose down`.

Si cambiaste código, hay que volver a correr `docker compose up --build`: Docker no recarga
solo.

## 4. Antes de subir cambios

```bash
npm run verify
```

Revisa tipos, lint, el contrato y corre todos los tests. Es lo mismo que corre el CI en
cada PR: si pasa local, pasa en GitHub. Cómo se trabaja (ramas, commits, PR) está en
[`AGENTS.md`](../AGENTS.md).

## Node o Docker: qué cambia

Las dos formas levantan **las mismas piezas** (front, BFF y CORE falso) y se usan igual
desde el navegador. Cambia cómo corren:

| | Con Node (`npm run dev`) | Con Docker (`docker compose up`) |
| --- | --- | --- |
| Qué hay que instalar | Node 24 | Solo Docker |
| Recarga al editar código | Sí, al instante | No: hay que reconstruir |
| Arranque | Segundos | Minutos la primera vez |
| Qué corre | El código fuente, en modo desarrollo | Builds de producción (front servido por nginx, BFF compilado) |
| Variables de entorno | Del archivo `.env` | Definidas en `docker-compose.yml` |
| Incluye Prism | No (se levanta aparte con `npm run mock`) | Sí, siempre en `:4010` |
| Para qué sirve | Programar | Demo, probar como en producción, o levantarlo sin instalar Node |

### Por qué Docker

- **Mismo entorno en todas las máquinas.** No importa si tenés Mac o Windows ni qué versión
  de Node: el contenedor siempre es igual. Evita el "en mi máquina anda".
- **Demo y entrega.** La segunda entrega se muestra en local: con Docker, cualquiera del
  equipo levanta el portal completo con un comando.
- **Se parece a producción.** Corre las versiones compiladas, como se desplegarían. Si un
  Dockerfile se rompe, lo detecta el CI (job `docker`).
- **Formato de despliegue.** Cuando se elija dónde hostear, las imágenes ya están listas.

El desarrollo diario no depende de Docker: es más rápido programar con `npm run dev`.

## Qué es Prism y para qué está

[Prism](https://stoplight.io/open-source/prism) es un servidor de mentira que lee
[`openapi.yaml`](../openapi.yaml) (el contrato entre el front y el BFF) y responde cada endpoint con los
**ejemplos escritos en el contrato**. No tiene lógica: solo devuelve lo que dice el YAML.

**Para qué sirve:** desacoplar el front del BFF. Si una pantalla necesita un endpoint que el
BFF todavía no tiene (por ejemplo `GET /calendario`), el front se puede construir igual
contra Prism, con datos con la forma exacta del contrato. Cuando el BFF lo implementa, se
cambia una variable y el front pasa a usar el real sin tocar código.

**Qué valor aporta:**

- Front y BFF avanzan en paralelo, sin esperarse.
- Obliga a que el contrato tenga ejemplos útiles: si el ejemplo está mal, se nota en la
  pantalla.
- Sirve para mostrar una pantalla aunque el módulo externo del que depende no exista todavía.

**Cómo usarlo:**

- Con Node: en una terminal aparte `npm run mock` (queda en http://localhost:4010) y en
  `.env` cambiar `STUDENT_SERVICE_URL=http://localhost:4010`. Reiniciar `npm run dev`.
  Para volver al BFF: `STUDENT_SERVICE_URL=http://localhost:3000/api/v1`.
- Con Docker: `COMPOSE_STUDENT_SERVICE_URL=http://prism:4010 docker compose up --build`
  (en PowerShell: `$env:COMPOSE_STUDENT_SERVICE_URL="http://prism:4010"; docker compose up --build`).

Una forma rápida de ver que está activo: con Prism, el nombre del alumno en la barra
lateral pasa a ser "Juan Pérez" (el ejemplo del contrato).

**No confundir con el CORE falso:** Prism imita **nuestro BFF** a partir del contrato. El
CORE falso imita **a CORE y a los otros módulos** (login, tokens, Gateway, comedor, eventos,
etc.). Los dos son solo para desarrollo.

## CORE falso: módulos externos y fallas

Detrás del Gateway (`http://localhost:4000`) responden los módulos 2, 4, 5, 6, 8 y 9 con
datos de prueba (las fixtures de `packages/fixtures/`), además de las notificaciones y el
saldo de CORE. Todo el estado vive en memoria: reiniciar el CORE falso o llamar a
`POST /__falso/reset` vuelve a los datos iniciales.

**Cómo probar** (usuarios, cómo apagar un módulo, disparar notificaciones, cargar saldo y
los casos preparados para cada pantalla): ver [`pruebas.md`](pruebas.md).

Para probar contra un módulo real, poné su URL en `{MODULO}_SERVICE_URL` (por ejemplo
`DINING_SERVICE_URL=http://localhost:8080/api/v1`) y el Gateway le reenvía los pedidos.

## Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| `EADDRINUSE` o "port is already in use" | Otro proceso usa el puerto (5173, 4000, 3000 o 4010). Cerrá la otra instancia, o `docker compose down` si quedó Docker corriendo. |
| `npm run dev` falla con "Configuración inválida del BFF" | Falta el `.env`. Copialo desde `.env.example` (paso 3A). |
| El login no responde, o al recargar pide login de nuevo | Abrí `http://localhost:5173`, no `127.0.0.1:5173`: el CORE falso solo acepta pedidos desde `localhost` y la cookie de sesión depende del nombre del sitio. |
| `node --version` no es 24 | Instalá Node 24 o usá `nvm use`. |
| Docker: "Cannot connect to the Docker daemon" | Docker Desktop u OrbStack no está abierto. |
| Windows: Docker Desktop pide WSL | Aceptá instalar WSL 2 y reiniciá. |
