import { describe, expect, it } from 'vitest';
import { destinoDe } from './destino';

const portales = { biblioteca: 'https://biblioteca.test', eventos: 'https://eventos.test/' };

describe('traducción de actionUrl', () => {
  it.each([
    ['provisoria del Módulo 2', '/student/courses/curso-bd1/exams/101'],
    ['propuesta por nosotros', '/cursadas/curso-bd1/notas/101'],
  ])('nota de examen, ruta %s → pantalla propia del detalle de la nota', (_caso, url) => {
    expect(destinoDe('TEACHER_EXAM_RESULT_PUBLISHED', url, portales)).toEqual({
      tipo: 'interno',
      ruta: '/cursadas/curso-bd1/notas/101',
    });
  });

  it('sanción → portal de Biblioteca configurado', () => {
    expect(destinoDe('LIBRARY_PENALTY_APPLIED', '/library/loan-1/penalty', portales)).toEqual({
      tipo: 'externo',
      url: 'https://biblioteca.test/library/loan-1/penalty',
      portal: 'Biblioteca',
    });
  });

  it('recordatorio → portal de Eventos, relativo o absoluto al mismo origen', () => {
    const esperado = {
      tipo: 'externo',
      url: 'https://eventos.test/events/ev-1',
      portal: 'Eventos',
    };
    expect(destinoDe('EVENT_REMINDER', '/events/ev-1', portales)).toEqual(esperado);
    expect(destinoDe('EVENT_REMINDER', 'https://eventos.test/events/ev-1', portales)).toEqual(
      esperado,
    );
  });

  it.each([
    ['vacío', 'EVENT_REMINDER', ''],
    ['null', 'EVENT_REMINDER', null],
    ['otro origen', 'EVENT_REMINDER', 'https://malicioso.test/events/ev-1'],
    ['protocolo relativo', 'EVENT_REMINDER', '//malicioso.test/events/ev-1'],
    ['javascript:', 'LIBRARY_PENALTY_APPLIED', 'javascript:alert(1)'],
    ['formato desconocido', 'TEACHER_EXAM_RESULT_PUBLISHED', '/teacher/exams/123'],
    ['formato anterior', 'TEACHER_EXAM_RESULT_PUBLISHED', '/teacher/courses/c/exams/1'],
    ['path traversal', 'TEACHER_EXAM_RESULT_PUBLISHED', '/student/courses/../exams/x'],
    ['tipo anterior', 'EXAM_RESULT_PUBLISHED', '/student/courses/c/exams/1'],
    ['tipo desconocido', 'NUEVO_TIPO', '/events/ev-1'],
    ['ruta de otro tipo', 'LIBRARY_PENALTY_APPLIED', '/events/ev-1'],
  ])('%s → no navega', (_caso, tipo, url) => {
    expect(destinoDe(tipo, url, portales)).toBeNull();
  });

  it('sin portal configurado no sale del portal', () => {
    expect(
      destinoDe('EVENT_REMINDER', '/events/ev-1', { biblioteca: undefined, eventos: undefined }),
    ).toBeNull();
  });
});
