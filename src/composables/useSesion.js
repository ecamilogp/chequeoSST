import { ref, computed } from 'vue';
import { sb } from '../lib/supabase.js';
import { msgError } from '../lib/textos.js';

// estado: 'cargando' | 'fuera' | 'no_autorizado' | 'dentro'
export const estado = ref('cargando');
export const miembro = ref(null);
export const correo = ref('');
export const errorIngreso = ref('');
export const esRevisor = computed(() => ['owner', 'admin'].includes(miembro.value?.rol));
export const esOwner = computed(() => miembro.value?.rol === 'owner');

let iniciado = false;

export async function iniciarSesion() {
  if (iniciado || !sb) { if (!sb) estado.value = 'fuera'; return; }
  iniciado = true;

  // Si Google o el filtro de correos rechazó el ingreso, el motivo llega en la dirección.
  const q = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
  const err = q.get('error_description') || q.get('error');
  if (err) {
    errorIngreso.value = /not authorized|no está autorizado|403|Hook/i.test(err)
      ? 'Tu correo no está autorizado. Pide a tu administrador que te registre.'
      : decodeURIComponent(err.replace(/\+/g, ' '));
    history.replaceState(null, '', location.pathname);
  }

  sb.auth.onAuthStateChange((ev, session) => {
    if (ev === 'SIGNED_OUT') { miembro.value = null; correo.value = ''; estado.value = 'fuera'; }
    if (ev === 'SIGNED_IN' && session && estado.value !== 'dentro') setTimeout(() => cargarMiembro(session), 0);
  });
  const { data } = await sb.auth.getSession();
  if (data.session) await cargarMiembro(data.session);
  else if (estado.value === 'cargando') estado.value = 'fuera';
}

async function cargarMiembro(session) {
  correo.value = session.user?.email || '';
  try {
    const { data, error } = await sb.rpc('entrar');
    if (error) throw error;
    if (data?.id) { miembro.value = data; estado.value = 'dentro'; }
    else { miembro.value = null; estado.value = 'no_autorizado'; }
  } catch (e) {
    errorIngreso.value = msgError(e);
    estado.value = 'fuera';
  }
}

export async function entrarConGoogle() {
  errorIngreso.value = '';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin, queryParams: { prompt: 'select_account' } }
  });
  if (error) errorIngreso.value = msgError(error);
}

export async function salir() {
  await sb.auth.signOut();
  miembro.value = null; estado.value = 'fuera';
}
