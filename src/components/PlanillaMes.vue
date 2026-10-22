<script setup>
// La planilla de papel: elementos por filas y días del mes por columnas.
import { computed, ref, watch, onMounted, nextTick } from 'vue';
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

// La planilla es más ancha que la pantalla: se desliza hacia los lados.
const caja = ref(null);
const puedeIzq = ref(false), puedeDer = ref(false);
function revisarBordes() {
  const c = caja.value; if (!c) return;
  puedeIzq.value = c.scrollLeft > 4;
  puedeDer.value = c.scrollLeft + c.clientWidth < c.scrollWidth - 4;
}
function mover(dir) {
  const c = caja.value; if (!c) return;
  const col = c.querySelector('th.dcol')?.offsetWidth || 28;
  c.scrollBy({ left: dir * col * 7, behavior: 'smooth' });
}
// Muestra el día elegido (o hoy) al abrir la planilla.
async function centrarDia() {
  await nextTick();
  const c = caja.value; if (!c) return;
  const th = c.querySelector('th.daysel');
  const fija = c.querySelector('th.it')?.offsetWidth || 0;
  if (th) c.scrollLeft = Math.max(0, th.offsetLeft - fija - (c.clientWidth - fija) / 2 + th.offsetWidth / 2);
  revisarBordes();
}
onMounted(() => { centrarDia(); new ResizeObserver(revisarBordes).observe(caja.value); });
watch(() => [props.sel, props.mes], centrarDia);
</script>

<template>
  <div class="planilla">
    <div class="planilla-nav">
      <span class="hint">Desliza hacia los lados para ver todos los días.</span>
      <span class="spacer"></span>
      <button class="iconbtn" type="button" :disabled="!puedeIzq" aria-label="Ver días anteriores" @click="mover(-1)">‹</button>
      <button class="iconbtn" type="button" :disabled="!puedeDer" aria-label="Ver días siguientes" @click="mover(1)">›</button>
    </div>
  <div class="scroll planilla-scroll" ref="caja" @scroll.passive="revisarBordes">
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
  </div>
</template>
