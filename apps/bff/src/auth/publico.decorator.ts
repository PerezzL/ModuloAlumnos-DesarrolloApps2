import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

/** Marca un endpoint que no exige token (solo health). */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
