// Guardado local (solo este dispositivo): borradores y preferencias.
export function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
export function lsDel(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
