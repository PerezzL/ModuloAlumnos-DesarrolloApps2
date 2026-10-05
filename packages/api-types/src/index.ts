// Punto de entrada de los tipos del contrato. Lo generado vive en ./generated (fuera de git).
import type { components, operations, paths } from './generated/schema.js';

export type { components, operations, paths };

export type Schemas = components['schemas'];

export type Perfil = Schemas['Perfil'];
export type Problema = Schemas['Problema'];
export type ModuloExterno = Schemas['ModuloExterno'];
export type Calendario = Schemas['Calendario'];
export type ItemCalendario = Schemas['ItemCalendario'];
export type CategoriaCalendario = Schemas['CategoriaCalendario'];
export type OfertaInscripcion = Schemas['OfertaInscripcion'];
export type Inscripcion = Schemas['Inscripcion'];
export type CursadaResumen = Schemas['CursadaResumen'];
export type CursadaDetalle = Schemas['CursadaDetalle'];
export type Asistencia = Schemas['Asistencia'];
export type NotaResumen = Schemas['NotaResumen'];
export type InstanciaExamen = Schemas['InstanciaExamen'];
export type ResultadoExamen = Schemas['ResultadoExamen'];
export type NotaDetalle = Schemas['NotaDetalle'];
export type PaginaCompras = Schemas['PaginaCompras'];
export type CompraDetalle = Schemas['CompraDetalle'];
export type Asignatura = Schemas['Asignatura'];
export type Periodo = Schemas['Periodo'];
export type EstadoCursada = Schemas['EstadoCursada'];
export type MateriaOferta = Schemas['MateriaOferta'];
export type Comision = Schemas['Comision'];
export type Horario = Schemas['Horario'];
export type CorrelativaFaltante = Schemas['CorrelativaFaltante'];
export type ProblemaInscripcion = Schemas['ProblemaInscripcion'];
export type CompraResumen = Schemas['CompraResumen'];
