import createClient from 'openapi-fetch';
import type { paths } from '@uadenet/api-types';
import { config } from '@/config';
import { crearFetchConSesion } from './fetchConSesion';

/** Cliente tipado del BFF (contrato: openapi.yaml), por el Gateway de CORE. */
export const api = createClient<paths>({
  baseUrl: config.bffUrl,
  fetch: crearFetchConSesion(),
  // Las listas en la query van separadas por coma (`style: form`, `explode: false` en el contrato)
  querySerializer: { array: { style: 'form', explode: false } },
});
