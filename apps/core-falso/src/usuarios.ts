/**
 * Usuarios de prueba del CORE falso. Las contraseñas son solo de desarrollo.
 * Los ids imitan los de Backoffice (UUID v4), pero el portal los trata como strings opacos.
 */
export interface UsuarioPrueba {
  id: string;
  email: string;
  password: string;
  roles: string[];
  permissions: string[];
  status: 'ACTIVE' | 'SUSPENDED';
}

const permisosAlumno = ['wallet:read:self', 'wallet:credit:self'];

export const USUARIOS: UsuarioPrueba[] = [
  {
    id: 'ba310c57-a684-4dbf-a4a4-905fcfbefa08',
    email: 'v.moreno@uade.edu.ar',
    password: 'uade2026',
    roles: ['STUDENT'],
    permissions: permisosAlumno,
    status: 'ACTIVE',
  },
  {
    id: '6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
    email: 'j.perez@uade.edu.ar',
    password: 'uade2026',
    roles: ['STUDENT'],
    permissions: permisosAlumno,
    status: 'ACTIVE',
  },
  {
    id: '0d9e8f7a-6b5c-4d3e-9f2a-1b0c9d8e7f6a',
    email: 'suspendido@uade.edu.ar',
    password: 'uade2026',
    roles: ['STUDENT'],
    permissions: permisosAlumno,
    status: 'SUSPENDED',
  },
];

export const buscarPorEmail = (email: string) =>
  USUARIOS.find((u) => u.email.toLowerCase() === email.toLowerCase());

export const buscarPorId = (id: string) => USUARIOS.find((u) => u.id === id);
