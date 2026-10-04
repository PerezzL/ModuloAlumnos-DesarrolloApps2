import { describe, expect, it } from 'vitest';
import { esMailInstitucional } from './mail';

describe('esMailInstitucional', () => {
  it.each(['v.moreno@uade.edu.ar', ' J.Perez@UADE.edu.ar '])('acepta %s', (mail) => {
    expect(esMailInstitucional(mail)).toBe(true);
  });

  it.each([
    'v.moreno@gmail.com',
    'v.moreno@uade.edu.ar.com',
    'v.moreno@alumnos.uade.edu.ar',
    '@uade.edu.ar',
    'v moreno@uade.edu.ar',
    'a@a.a',
    '',
  ])('rechaza %j', (mail) => {
    expect(esMailInstitucional(mail)).toBe(false);
  });
});
