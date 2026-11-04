import { Bell, BookX, CalendarClock, GraduationCap, type LucideIcon } from 'lucide-react';

/** Variante visual por `type`. Un tipo que no conocemos usa la genérica. */
const VARIANTES: Record<string, { etiqueta: string; icono: LucideIcon; clases: string }> = {
  TEACHER_EXAM_RESULT_PUBLISHED: {
    etiqueta: 'Nota publicada',
    icono: GraduationCap,
    clases: 'bg-examen/10 text-examen',
  },
  LIBRARY_PENALTY_APPLIED: {
    etiqueta: 'Sanción de biblioteca',
    icono: BookX,
    clases: 'bg-peligro-fondo text-peligro-texto',
  },
  EVENT_REMINDER: {
    etiqueta: 'Recordatorio de evento',
    icono: CalendarClock,
    clases: 'bg-evento/10 text-evento',
  },
};

const GENERICA = { etiqueta: 'Notificación', icono: Bell, clases: 'bg-fondo text-etiqueta' };

export const varianteDe = (tipo: string) => VARIANTES[tipo] ?? GENERICA;
