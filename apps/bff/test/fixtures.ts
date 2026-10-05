import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(__dirname, '../../../packages/fixtures/');

/** Lee una fixture de `packages/fixtures`: las mismas que sirve el CORE falso. */
export function fixture<T = unknown>(ruta: string): T {
  return JSON.parse(readFileSync(`${DIR}${ruta}`, 'utf8')) as T;
}
