// Avisos de la campana: devoluciones (empleado) y correcciones (owner y administradores).
import { ref, computed } from 'vue';
import { sb } from '../lib/supabase.js';

export const avisos = ref([]);
export const sinLeer = computed(() => avisos.value.filter(a => !a.leida_at).length);

// A dónde llevar al usuario cuando toca un aviso: { pestana, fecha, empleadoId }.
export const destino = ref(null);

let timer = null;
export async function cargarAvisos() {
  const { data, error } = await sb.from('notificaciones')
    .select('id, tipo, fecha, titulo, detalle, empleado_id, creada_at, leida_at')
    .order('creada_at', { ascending: false }).limit(30);
  if (!error) avisos.value = data;
}

export async function marcarLeido(id) {
  const ahora = new Date().toISOString();
  avisos.value = avisos.value.map(a => (!id || a.id === id) && !a.leida_at ? { ...a, leida_at: ahora } : a);
  await sb.rpc('marcar_notificaciones', id ? { p_id: id } : {});
}

const alVolver = () => { if (document.visibilityState === 'visible') cargarAvisos(); };
export function vigilarAvisos() {
  detenerAvisos();
  cargarAvisos();
  timer = setInterval(alVolver, 45000);
  document.addEventListener('visibilitychange', alVolver);
}
export function detenerAvisos() {
  clearInterval(timer); timer = null;
  document.removeEventListener('visibilitychange', alVolver);
  avisos.value = [];
}
