import { Controller, Get, Query } from '@nestjs/common';
import type { Calendario } from '@uadenet/api-types';
import { CalendarioService } from './calendario.service';
import { parsearCategorias, parsearRango } from './parametros';

/** `GET /calendario?desde=&hasta=&categorias=` (RF7, pantalla 4.9) */
@Controller('calendario')
export class CalendarioController {
  constructor(private readonly calendario: CalendarioService) {}

  @Get()
  obtener(
    @Query('desde') desde: unknown,
    @Query('hasta') hasta: unknown,
    @Query('categorias') categorias: unknown,
  ): Promise<Calendario> {
    return this.calendario.calendario(parsearRango(desde, hasta), parsearCategorias(categorias));
  }
}
