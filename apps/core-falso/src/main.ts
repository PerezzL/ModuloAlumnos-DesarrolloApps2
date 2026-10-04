import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { crearApp } from './app.js';
import { cargarConfig } from './config.js';

const env = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(env)) process.loadEnvFile(env);

const config = cargarConfig();
const { app } = await crearApp(config);
app.listen(config.puerto, () => {
  console.log(`CORE falso en http://localhost:${config.puerto}`);
  console.log(`  Gateway /api/v1/student/* → ${config.studentServiceUrl}/*`);
  for (const [modulo, url] of Object.entries(config.servicios)) {
    console.log(`  Gateway /api/v1/${modulo}/* → ${url ? `${url}/*` : 'módulo falso (fixtures)'}`);
  }
  if (config.fallas) console.log(`  Fallas simuladas: ${config.fallas}`);
  console.log('  Usuario de prueba: v.moreno@uade.edu.ar / uade2026');
});
