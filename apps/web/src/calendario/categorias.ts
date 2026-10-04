import type { CategoriaCalendario } from '@uadenet/api-types';
import { GraduationCap, Ticket, Utensils, type LucideIcon } from 'lucide-react';

/**
 * Cada categoría se distingue por ícono y nombre además del color, para que el origen no
 * dependa solo del color (accesibilidad).
 */
export const CATEGORIAS: Record<
  CategoriaCalendario,
  { etiqueta: string; singular: string; icono: LucideIcon; clases: string; punto: string }
> = {
  COMEDOR: {
    etiqueta: 'Comedor',
    singular: 'Turno de comedor',
    icono: Utensils,
    clases: 'border-comedor/30 bg-comedor/8 text-comedor',
    punto: 'bg-comedor',
  },
  EVENTO: {
    etiqueta: 'Eventos',
    singular: 'Evento',
    icono: Ticket,
    clases: 'border-evento/30 bg-evento/8 text-evento',
    punto: 'bg-evento',
  },
  EXAMEN: {
    etiqueta: 'Exámenes',
    singular: 'Turno de examen',
    icono: GraduationCap,
    clases: 'border-examen/30 bg-examen/8 text-examen',
    punto: 'bg-examen',
  },
};

export const ORDEN_CATEGORIAS: CategoriaCalendario[] = ['EXAMEN', 'COMEDOR', 'EVENTO'];
