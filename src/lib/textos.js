export const ROLES = { owner: 'Owner', admin: 'Administrador', empleado: 'Empleado' };

export function estadoDe(d) {
  if (!d) return { c: 'p-pend', t: 'Pendiente' };
  return ({
    validada: { c: 'p-ok', t: 'Validada' },
    devuelta: { c: 'p-bad', t: 'Devuelta para corregir' },
    corregida: { c: 'p-warn', t: 'Corregida · por validar' }
  })[d.estado] || { c: 'p-sent', t: 'Enviada · por validar' };
}

// Mensajes de error entendibles.
export function msgError(e) {
  const m = String(e?.message || e || '');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión. Revisa tu internet e intenta de nuevo.';
  if (/JWT|expired|session/i.test(m)) return 'Tu sesión terminó. Ingresa de nuevo.';
  if (/row-level security/i.test(m)) return 'No tienes permiso para hacer esto.';
  return m.replace(/^Error:\s*/, '') || 'Ocurrió un error. Intenta de nuevo.';
}
