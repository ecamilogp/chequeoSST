<script setup>
// Validar con una sola firma todas las inspecciones pendientes de UN día.
import { ref, onMounted } from 'vue';
import { sb } from '../lib/supabase.js';
import { fmtFecha } from '../lib/fechas.js';
import { msgError } from '../lib/textos.js';
import { subirFirma, blobADataURL } from '../lib/firmas.js';
import { lsGet, lsSet, lsDel } from '../lib/almacen.js';
import ModalBase from './ModalBase.vue';
import FirmaPad from './FirmaPad.vue';

const props = defineProps({
  fecha: String,      // el único día que se valida
  pendientes: Array,  // [{ id, nombre, total_no_cumple }] de ese día
  yo: Object,
  claveFirma: String
});
const emit = defineEmits(['cerrar', 'hecho']);
const nombre = ref(props.yo.nombre);
const cargo = ref(props.yo.cargo || 'Administrador');
const recordar = ref(false);
const pad = ref(null);
const err = ref('');
const guardando = ref(false);
const conNovedad = props.pendientes.filter(p => p.total_no_cumple > 0).length;

onMounted(() => {
  const guardada = lsGet(props.claveFirma);
  recordar.value = !!guardada;
  if (guardada) setTimeout(() => pad.value?.cargar(guardada), 80);
});

async function validar() {
  err.value = !nombre.value.trim() ? 'Escribe tu nombre.' : pad.value.estaVacia() ? 'Falta tu firma.' : '';
  if (err.value) return;
  guardando.value = true;
  try {
    const blob = await pad.value.blob();
    const path = await subirFirma(`rev/${props.yo.id}/dia-${props.fecha}-${Date.now()}.png`, blob);
    const { data, error } = await sb.rpc('validar_dia', {
      p_fecha: props.fecha, p_nombre: nombre.value.trim(), p_cargo: cargo.value.trim(), p_firma_path: path
    });
    if (error) throw error;
    if (recordar.value) lsSet(props.claveFirma, await blobADataURL(blob)); else lsDel(props.claveFirma);
    emit('hecho', data);
  } catch (e) { err.value = msgError(e); }
  guardando.value = false;
}
</script>

<template>
  <ModalBase :cerrable="!guardando" @cerrar="emit('cerrar')">
    <h2>Validar todo el día</h2>
    <p class="hint">Se validarán con tu firma las <b>{{ pendientes.length }}</b> inspecciones por validar del
      <b>{{ fmtFecha(fecha) }}</b>. Solo este día; los demás días no se tocan.</p>

    <ul class="vd-lista">
      <li v-for="p in pendientes" :key="p.id">
        <span>{{ p.nombre }}</span>
        <span v-if="p.total_no_cumple" class="pill p-bad">{{ p.total_no_cumple }} no cumple</span>
      </li>
    </ul>
    <p v-if="conNovedad" class="banner warn" style="margin:0">
      {{ conNovedad }} {{ conNovedad === 1 ? 'tiene' : 'tienen' }} elementos que no cumplen. Si alguna debe corregirse,
      ciérrala aquí y devuélvela una por una antes de validar el día.
    </p>
    <p class="hint" style="margin:0">Las devueltas, las ya validadas y tu propia inspección no se incluyen.</p>

    <div class="grid2">
      <label class="f">Nombre de quien inspecciona<input type="text" v-model="nombre"></label>
      <label class="f">Cargo / rol<input type="text" v-model="cargo"></label>
    </div>
    <div>
      <div class="row" style="margin-bottom:6px"><span class="eyebrow">Tu firma</span><span class="spacer"></span><button class="btn small" type="button" @click="pad.limpiar()">Borrar firma</button></div>
      <FirmaPad ref="pad" texto="Firma aquí" />
      <label class="chk" style="margin-top:8px"><input type="checkbox" v-model="recordar"> Recordar mi firma en este dispositivo</label>
    </div>
    <p class="err" v-if="err">{{ err }}</p>
    <div class="row">
      <button class="btn" type="button" :disabled="guardando" @click="emit('cerrar')">Cancelar</button>
      <span class="spacer"></span>
      <button class="btn ok" type="button" :disabled="guardando" @click="validar">
        <span v-if="guardando" class="spin"></span> Validar {{ pendientes.length }} inspecciones
      </button>
    </div>
  </ModalBase>
</template>

<style scoped>
.vd-lista{flex-shrink:0;list-style:none;margin:0;padding:0;max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:var(--r)}
.vd-lista li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}
.vd-lista li:last-child{border-bottom:0}
</style>
