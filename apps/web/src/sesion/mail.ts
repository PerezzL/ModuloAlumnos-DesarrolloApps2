const DOMINIO = '@uade.edu.ar';

/** El login solo acepta mails institucionales; se valida antes de llamar a CORE. */
export function esMailInstitucional(email: string) {
  const limpio = email.trim().toLowerCase();
  return /^[^\s@]+@uade\.edu\.ar$/.test(limpio);
}

export { DOMINIO };
