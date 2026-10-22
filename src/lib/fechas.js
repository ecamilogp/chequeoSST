import { APP } from '../empresa.js';

export const pad = n => String(n).padStart(2, '0');
export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Fecha de hoy en la zona horaria de la empresa (no la del celular). AAAA-MM-DD
export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: APP.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function sumarDias(f, n) {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
export const mesDe = f => f.slice(0, 7);
export function rangoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${pad(n)}`, dias: n };
}
export function fmtFecha(f) {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}
export function fmtMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const fmtHora = iso => iso ? new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: APP.zonaHoraria }) : '';
export const fmtFechaHora = iso => iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short', timeZone: APP.zonaHoraria }) : '';
