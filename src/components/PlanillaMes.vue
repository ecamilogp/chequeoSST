<script setup>
// La planilla de papel: elementos por filas y días del mes por columnas.
import { computed } from 'vue';
import { SECCIONES, SYM, TXT } from '../lib/catalogo.js';
import { DIAS, pad, rangoMes, fmtFecha } from '../lib/fechas.js';

const props = defineProps({ mes: String, dias: Object, sel: String });
const emit = defineEmits(['elegir']);
const fechas = computed(() => {
  const [y, m] = props.mes.split('-').map(Number);
  return [...Array(rangoMes(props.mes).dias)].map((_, i) => {
    const wd = new Date(y, m - 1, i + 1).getDay();
    return { f: `${props.mes}-${pad(i + 1)}`, n: i + 1, ini: DIAS[wd][0], finde: wd === 0 || wd === 6 };
  });
});
const v = (f, id) => props.dias[f]?.respuestas?.[id];
</script>

<template>
  <div class="scroll">
    <table class="pl">
      <thead>
        <tr>
          <th class="it">Elemento</th>
          <th v-for="d in fechas" :key="d.f" class="dcol" :class="{ we: d.finde, daysel: d.f === sel }" :title="fmtFecha(d.f)" @click="emit('elegir', d.f)">{{ d.ini }}<br>{{ d.n }}</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="s in SECCIONES" :key="s.k">
          <tr class="grp"><td class="it">{{ s.k }}. {{ s.t }}</td><td :colspan="fechas.length"></td></tr>
          <tr v-for="[id, nombre] in s.items" :key="id">
            <td class="it" :title="nombre">{{ nombre }}</td>
            <td v-for="d in fechas" :key="d.f" :class="{ daysel: d.f === sel }">
              <i v-if="v(d.f, id)" class="mk" :class="v(d.f, id)" :title="dias[d.f]?.obs_items?.[id] || TXT[v(d.f, id)]">{{ SYM[v(d.f, id)] }}</i>
            </td>
          </tr>
        </template>
        <tr class="sig">
          <td class="it">Firma empleado</td>
          <td v-for="d in fechas" :key="d.f" :class="{ daysel: d.f === sel }"><i v-if="dias[d.f]" class="mk C" title="Firmado">✓</i></td>
        </tr>
        <tr class="sig">
          <td class="it">Revisión</td>
          <td v-for="d in fechas" :key="d.f" :class="{ daysel: d.f === sel }">
            <i v-if="dias[d.f]?.estado === 'validada'" class="mk C" title="Validada">✓</i>
            <i v-else-if="dias[d.f]?.estado === 'devuelta'" class="mk N" title="Devuelta">↺</i>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
