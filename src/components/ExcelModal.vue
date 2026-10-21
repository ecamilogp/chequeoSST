<script setup>
import { ref, computed } from 'vue';
import { APP } from '../empresa.js';
import { sb } from '../lib/supabase.js';
import { hoy, mesDe, rangoMes } from '../lib/fechas.js';
import { msgError } from '../lib/textos.js';
import { descargarFirmas } from '../lib/firmas.js';
import ModalBase from './ModalBase.vue';

const props = defineProps({ miembros: Array, mesInicial: String });
const emit = defineEmits(['cerrar']);
const mes = ref(props.mesInicial);
const quien = ref('');
const estado = ref('');
const trabajando = ref(false);
const ordenados = computed(() => props.miembros.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)));

async function descargar() {
  if (!mes.value) return;
  trabajando.value = true;
  try {
    estado.value = 'Buscando inspecciones…';
    const { desde, hasta } = rangoMes(mes.value);
    let q = sb.from('inspecciones').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha');
    if (quien.value) q = q.eq('miembro_id', quien.value);
    const { data, error } = await q;
    if (error) throw error;
    if (!data.length) { estado.value = 'No hay inspecciones en ese mes.'; trabajando.value = false; return; }
    estado.value = `Descargando ${data.length} firmas…`;
    const firmas = await descargarFirmas(data.map(i => i.firma_path));
    estado.value = 'Armando el Excel…';
    const { generarExcel } = await import('../lib/excel.js');
    const blob = await generarExcel({ mes: mes.value, miembros: props.miembros, inspecciones: data, firmas });
    const nombre = quien.value ? (props.miembros.find(m => m.id === quien.value)?.nombre || 'empleado').replace(/[^\wÁÉÍÓÚÑáéíóúñ]+/g, '_') : 'todos';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${APP.formato.codigo}_${mes.value}_${nombre}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    estado.value = 'Listo. Revisa tus descargas.';
  } catch (e) { estado.value = msgError(e); }
  trabajando.value = false;
}
</script>

<template>
  <ModalBase @cerrar="emit('cerrar')">
    <h2>Descargar Excel</h2>
    <p class="hint">Incluye un resumen del mes y la planilla de cada empleado con sus firmas, igual a la de papel.</p>
    <label class="f">Mes<input type="month" v-model="mes" :max="mesDe(hoy())"></label>
    <label class="f">Empleado<select v-model="quien"><option value="">Todos</option><option v-for="m in ordenados" :key="m.id" :value="m.id">{{ m.nombre }}</option></select></label>
    <p class="hint" v-if="estado">{{ estado }}</p>
    <div class="row">
      <button class="btn primary" type="button" :disabled="trabajando" @click="descargar">Descargar</button>
      <button class="btn" type="button" @click="emit('cerrar')">Cerrar</button>
    </div>
  </ModalBase>
</template>
