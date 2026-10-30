<script setup>
// Campana de la cabecera con los avisos del usuario.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { avisos, sinLeer, marcarLeido, destino, cargarAvisos } from '../composables/useNotificaciones.js';
import { esRevisor } from '../composables/useSesion.js';
import { fmtFecha } from '../lib/fechas.js';

const abierta = ref(false);
const caja = ref(null);

function alternar() { abierta.value = !abierta.value; if (abierta.value) cargarAvisos(); }
function abrirAviso(a) {
  if (!a.leida_at) marcarLeido(a.id);
  abierta.value = false;
  destino.value = a.tipo === 'corregida' && esRevisor.value
    ? { pestana: 'revision', fecha: a.fecha, empleadoId: a.empleado_id, t: Date.now() }
    : { pestana: 'inspeccion', fecha: a.fecha, t: Date.now() };
}
function hace(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}
const fuera = e => { if (abierta.value && caja.value && !caja.value.contains(e.target)) abierta.value = false; };
const tecla = e => { if (e.key === 'Escape') abierta.value = false; };
onMounted(() => { document.addEventListener('pointerdown', fuera); document.addEventListener('keydown', tecla); });
onBeforeUnmount(() => { document.removeEventListener('pointerdown', fuera); document.removeEventListener('keydown', tecla); });
</script>

<template>
  <div class="campana" ref="caja">
    <button class="iconbtn" type="button" @click="alternar" :aria-expanded="abierta"
      :aria-label="sinLeer ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'" title="Notificaciones">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9zM10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span v-if="sinLeer" class="campana-n">{{ sinLeer > 9 ? '9+' : sinLeer }}</span>
    </button>
    <div v-if="abierta" class="campana-panel" role="dialog" aria-label="Notificaciones">
      <div class="campana-top">
        <b>Notificaciones</b>
        <button v-if="sinLeer" class="btn small" type="button" @click="marcarLeido()">Marcar todas como leídas</button>
      </div>
      <div v-if="!avisos.length" class="campana-vacia">No tienes notificaciones.</div>
      <button v-for="a in avisos" :key="a.id" type="button" class="aviso" :class="[a.tipo, { nueva: !a.leida_at }]" @click="abrirAviso(a)">
        <span class="aviso-punto" aria-hidden="true"></span>
        <span class="aviso-txt">
          <b>{{ a.titulo }}</b>
          <span>{{ a.detalle }}</span>
          <small>Inspección del {{ fmtFecha(a.fecha) }} · {{ hace(a.creada_at) }}</small>
        </span>
      </button>
    </div>
  </div>
</template>
