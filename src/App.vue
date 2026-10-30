<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { APP } from './empresa.js';
import { configurado } from './lib/supabase.js';
import { ROLES } from './lib/textos.js';
import { lsGet, lsSet } from './lib/almacen.js';
import { estado, miembro, esRevisor, iniciarSesion, salir } from './composables/useSesion.js';
import { toastMsg } from './composables/useToast.js';
import { tema, cambiarTema, aplicarTema } from './composables/useTema.js';
import LoginView from './views/LoginView.vue';
import InspeccionView from './views/InspeccionView.vue';
import RevisionView from './views/RevisionView.vue';
import UsuariosView from './views/UsuariosView.vue';
import CampanaAvisos from './components/CampanaAvisos.vue';
import { destino, vigilarAvisos, detenerAvisos } from './composables/useNotificaciones.js';

const pestana = ref('inspeccion');
const hayLogo = ref(false);
const logo = "/logo-empresa.png"; // pon el archivo en public/ para mostrarlo

watch(estado, e => {
  if (e !== 'dentro') return detenerAvisos();
  vigilarAvisos();
  const p = lsGet('chequeosst-pestana');
  pestana.value = esRevisor.value && ['revision', 'usuarios'].includes(p) ? p : 'inspeccion';
});
watch(pestana, p => lsSet('chequeosst-pestana', p));
// Al tocar un aviso de la campana: ir a la pestaña que corresponde (la vista abre el día).
watch(destino, d => { if (d && (d.pestana === 'inspeccion' || esRevisor.value)) { pestana.value = d.pestana; window.scrollTo({ top: 0 }); } });

aplicarTema();
const iniciales = n => String(n || '').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const confirmarSalir = ref(false);

// En celular la cabecera se compacta al bajar, para dejar más espacio a la planilla.
const cabecera = ref(null);
const compacta = ref(false);
let ro;
function alDesplazar() {
  const y = window.scrollY;
  if (!compacta.value && y > 140) compacta.value = true;
  else if (compacta.value && y < 30) compacta.value = false;
}
onMounted(() => {
  ro = new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', `${cabecera.value?.offsetHeight || 0}px`));
  ro.observe(cabecera.value);
  window.addEventListener('scroll', alDesplazar, { passive: true });
});
onBeforeUnmount(() => { ro?.disconnect(); window.removeEventListener('scroll', alDesplazar); });

onMounted(() => { document.title = `${APP.nombre} · ${APP.formato.titulo}`; iniciarSesion(); });
</script>

<template>
  <header class="bar" ref="cabecera" :class="{ compacta }">
    <div class="wrap">
      <div class="brand">
        <div class="brand-row">
          <img v-show="hayLogo" :src="logo" alt="" @load="hayLogo = true" @error="hayLogo = false">
          <h1>{{ APP.formato.titulo }}</h1>
        </div>
        <span class="code">{{ APP.empresa }} · {{ APP.formato.codigo }} · v{{ APP.formato.version }} · {{ APP.formato.proceso }}</span>
      </div>
      <template v-if="estado === 'dentro'">
        <div class="tabs" role="tablist">
          <button role="tab" :aria-selected="pestana === 'inspeccion'" @click="pestana = 'inspeccion'">Mi inspección</button>
          <template v-if="esRevisor">
            <button role="tab" :aria-selected="pestana === 'revision'" @click="pestana = 'revision'">Revisión</button>
            <button role="tab" :aria-selected="pestana === 'usuarios'" @click="pestana = 'usuarios'">Usuarios</button>
          </template>
        </div>

      </template>
      <div class="acciones">
        <button class="iconbtn" type="button" @click="cambiarTema" :aria-label="tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'" :title="tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'">
          <svg v-if="tema === 'oscuro'" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
        <template v-if="estado === 'dentro'">
          <CampanaAvisos />
          <div class="userchip" :title="miembro.email">
            <span class="avatar" aria-hidden="true">{{ iniciales(miembro.nombre) }}</span>
            <span class="userinfo"><b>{{ miembro.nombre }}</b><small>{{ ROLES[miembro.rol] }}</small></span>
          </div>
          <button class="btn small salir" type="button" @click="confirmarSalir = true" aria-label="Salir" title="Cerrar sesión">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="salir-txt">Salir</span>
          </button>
        </template>
      </div>
    </div>
  </header>

  <div v-if="confirmarSalir" class="modal-bg" @click.self="confirmarSalir = false">
    <div class="modal" role="dialog" aria-modal="true">
      <h2>¿Cerrar sesión?</h2>
      <p class="hint">Para volver a entrar tendrás que tocar “Continuar con Google”. Los borradores que tengas en este dispositivo se conservan.</p>
      <div class="row">
        <button class="btn primary" type="button" @click="confirmarSalir = false; salir()">Cerrar sesión</button>
        <button class="btn" type="button" @click="confirmarSalir = false">Cancelar</button>
      </div>
    </div>
  </div>

  <main class="wrap">
    <div v-if="!configurado" class="banner warn">Falta configurar la conexión con la base de datos (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY). Revisa el README.</div>
    <div v-if="estado === 'cargando'" class="center"><span class="hint"><span class="spin"></span> Cargando…</span></div>
    <LoginView v-else-if="estado !== 'dentro'" />
    <template v-else>
      <InspeccionView v-if="pestana === 'inspeccion'" />
      <RevisionView v-else-if="pestana === 'revision'" />
      <UsuariosView v-else-if="pestana === 'usuarios'" />
    </template>
  </main>

  <div v-if="toastMsg" class="toast" role="status">{{ toastMsg }}</div>
</template>
