import { Module } from '@nestjs/common';
import { EventosAdapter } from './eventos.adapter';

@Module({ providers: [EventosAdapter], exports: [EventosAdapter] })
export class EventosModule {}
