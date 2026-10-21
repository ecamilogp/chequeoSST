<script setup>
// Pantalla del empleado: llenar, firmar y enviar la inspección del día.
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { APP } from '../empresa.js';
import { sb } from '../lib/supabase.js';
import { SECCIONES, ALL, SYM, TXT } from '../lib/catalogo.js';
import { hoy, sumarDias, mesDe, rangoMes, fmtFecha, fmtHora } from '../lib/fechas.js';
import { estadoDe, msgError } from '../lib/textos.js';
import { urlFirma, subirFirma } from '../lib/firmas.js';
import { lsGet, lsSet, lsDel } from '../lib/almacen.js';
import { miembro } from '../composables/useSesion.js';
import { toast } from '../composables/useToast.js';
import FirmaPad from '../components/FirmaPad.vue';
import PlanillaMes from '../components/PlanillaMes.vue';

const yo = miembro.value;
const fechaMin = sumarDias(hoy(), -APP.diasAtrasPermitidos);
const fecha = ref(hoy());
const mes = ref(mesDe(hoy()));
const dias = ref({});
const diaDoc = ref(null);
const respuestas = ref({});
const obs = ref({});
const obsGen = ref('');
const perfil = ref({ cargo: yo.cargo, area: yo.area, B: yo.energia, C: yo.agua, D: yo.moto });
const editandoPerfil = ref(false);
const error = ref('');
const enviando = ref(false);
const cargando = ref(false);
const firma = ref(null);
const autoNA = new Set();
// Texto que aparece al pasar el mouse (o al tocar) cada opción.
const AYUDA = { C: 'Cumple · lo tengo y está en buen estado', N: 'No cumple · dañado o no lo tengo', NA: 'No aplica · no lo uso en mi labor' };

const activas = computed(() => ({ A: true, E: true, B: perfil.value.B, C: perfil.value.C, D: perfil.value.D }));
const dia = computed(() => dias.value[fecha.value]);
const bloqueada = computed(() => dia.value?.estado === 'validada');
const est = computed(() => estadoDe(dia.value));
const resumenPerfil = computed(() => {
  const acts = ['Generales', perfil.value.B && 'Energía', perfil.value.C && 'Agua', perfil.value.D && 'Moto'].filter(Boolean).join(', ');
  return `${yo.nombre} · ${perfil.value.cargo || 'Sin cargo'} · ${perfil.value.area || 'Sin zona'} · Actividades: ${acts}`;
});
const avance = computed(() => {
  const total = ALL.filter(e => activas.value[e.s]).length;
  const hechos = ALL.filter(e => activas.value[e.s] && respuestas.value[e.id]).length;
  return { total, hechos };
});

const claveBorrador = () => `chequeosst-borrador-${yo.id}-${fecha.value}`;
function guardarBorrador() { if (!diaDoc.value) lsSet(claveBorrador(), { a: respuestas.value, o: obs.value, g: obsGen.value }); }

function aplicarNA() {
  for (const s of SECCIONES) {
    if (!activas.value[s.k]) s.items.forEach(([id]) => { if (!respuestas.value[id] || respuestas.value[id] === 'NA') { respuestas.value[id] = 'NA'; autoNA.add(id); } });
    else s.items.forEach(([id]) => { if (autoNA.has(id)) { if (respuestas.value[id] === 'NA') delete respuestas.value[id]; autoNA.delete(id); } });
  }
}
watch(() => [perfil.value.B, perfil.value.C, perfil.value.D], () => { aplicarNA(); guardarBorrador(); });

function marcar(id, v) {
  if (bloqueada.value) return;
  respuestas.value[id] = v; autoNA.delete(id); guardarBorrador();
  if (v === 'N') nextTick(() => document.getElementById(`obs-${id}`)?.focus());
}
function todoCumple(k) {
  SECCIONES.find(s => s.k === k).items.forEach(([id]) => { respuestas.value[id] = 'C'; autoNA.delete(id); });
  guardarBorrador();
}

async function cargarMes(m) {
  mes.value = m;
  const { desde, hasta } = rangoMes(m);
  const { data, error: e } = await sb.from('inspecciones')
    .select('fecha, respuestas, obs_items, estado, nota_revisor, enviada_at, total_no_cumple')
    .eq('miembro_id', yo.id).gte('fecha', desde).lte('fecha', hasta);
  if (e) return toast(msgError(e));
  dias.value = Object.fromEntries(data.map(d => [d.fecha, d]));
}

async function cargarDia() {
  diaDoc.value = null; respuestas.value = {}; obs.value = {}; obsGen.value = ''; autoNA.clear(); error.value = '';
  firma.value?.limpiar();
  if (dias.value[fecha.value]) {
    cargando.value = true;
    try {
      const { data, error: e } = await sb.from('inspecciones').select('*').eq('miembro_id', yo.id).eq('fecha', fecha.value).maybeSingle();
      if (e) throw e;
      if (data) {
        diaDoc.value = data; respuestas.value = { ...data.respuestas }; obs.value = { ...data.obs_items }; obsGen.value = data.observaciones || '';
        firma.value?.cargar(await urlFirma(data.firma_path));
      }
    } catch (e) { toast(msgError(e)); }
    cargando.value = false;
  }
  if (!diaDoc.value) {
    const b = lsGet(claveBorrador());
    if (b) { respuestas.value = b.a || {}; obs.value = b.o || {}; obsGen.value = b.g || ''; }
    aplicarNA();
  }
}

async function cambiarFecha(f) {
  if (!f) return;
  if (f > hoy()) return toast('No puedes registrar días futuros.');
  if (f < fechaMin && !dias.value[f]) return toast(`Solo puedes registrar hasta ${APP.diasAtrasPermitidos} días atrás.`);
  fecha.value = f;
  if (mesDe(f) !== mes.value) await cargarMes(mesDe(f));
  await cargarDia();
}
function elegirDia(f) { if (f <= hoy()) { cambiarFecha(f); window.scrollTo({ top: 0, behavior: 'smooth' }); } }

async function copiarAnterior() {
  cargando.value = true;
  try {
    const { data, error: e } = await sb.from('inspecciones').select('fecha, respuestas, obs_items')
      .eq('miembro_id', yo.id).lt('fecha', fecha.value).order('fecha', { ascending: false }).limit(1).maybeSingle();
    if (e) throw e;
    if (!data) toast('No hay una inspección anterior para copiar.');
    else {
      respuestas.value = { ...data.respuestas }; obs.value = { ...data.obs_items }; autoNA.clear(); aplicarNA(); guardarBorrador();
      toast(`Respuestas copiadas del ${fmtFecha(data.fecha)}. Revísalas y firma.`);
    }
  } catch (e) { toast(msgError(e)); }
  cargando.value = false;
}

function ubicacion() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`), () => res(null), { timeout: 6000, maximumAge: 300000 });
  });
}

async function enviar() {
  error.value = '';
  const falt = [], sinObs = [];
  for (const it of ALL) {
    if (!activas.value[it.s]) continue;
    const v = respuestas.value[it.id];
    if (!v) falt.push(it.n);
    if (v === 'N' && !(obs.value[it.id] || '').trim()) sinObs.push(it.n);
  }
  error.value = falt.length ? `Faltan ${falt.length} elementos por marcar (ej. ${falt[0]}).`
    : sinObs.length ? `Explica qué falla en: ${sinObs.join(', ')}.`
    : firma.value.estaVacia() ? 'Falta tu firma.'
    : !navigator.onLine ? 'No tienes conexión. Tus respuestas quedan guardadas en este celular; envíala cuando tengas señal.' : '';
  if (error.value) return;

  const r = {}, o = {};
  for (const it of ALL) { r[it.id] = activas.value[it.s] ? respuestas.value[it.id] : 'NA'; if (r[it.id] === 'N') o[it.id] = obs.value[it.id].trim(); }
  enviando.value = true;
  try {
    const [blob, ub] = await Promise.all([firma.value.blob(), ubicacion()]);
    const path = await subirFirma(`${yo.id}/${fecha.value}-${Date.now()}.png`, blob);
    const { data, error: e } = await sb.rpc('enviar_inspeccion', {
      p_fecha: fecha.value, p_respuestas: r, p_obs: o, p_observaciones: obsGen.value.trim(), p_firma_path: path, p_ubicacion: ub,
      p_cargo: perfil.value.cargo.trim(), p_area: perfil.value.area.trim(), p_energia: perfil.value.B, p_agua: perfil.value.C, p_moto: perfil.value.D
    });
    if (e) throw e;
    lsDel(claveBorrador());
    Object.assign(miembro.value, { cargo: perfil.value.cargo.trim(), area: perfil.value.area.trim(), energia: perfil.value.B, agua: perfil.value.C, moto: perfil.value.D });
    diaDoc.value = data; editandoPerfil.value = false;
    await cargarMes(mes.value);
    toast(data.total_no_cumple ? `Enviada con ${data.total_no_cumple} elemento(s) que no cumplen. Tu administrador lo verá en su panel.` : 'Inspección enviada. ¡Buen turno!');
  } catch (e) { error.value = msgError(e); }
  enviando.value = false;
}

onMounted(async () => { await cargarMes(mes.value); await cargarDia(); });
</script>

<template>
  <section class="stack">
    <div class="card">
      <div class="row"><h2>Mis datos</h2><span class="spacer"></span><button class="btn small" type="button" @click="editandoPerfil = !editandoPerfil">{{ editandoPerfil ? 'Listo' : 'Editar' }}</button></div>
      <p class="hint">{{ resumenPerfil }}</p>
      <div v-if="editandoPerfil" class="stack" style="margin-top:12px">
        <div class="grid2">
          <label class="f">Cargo / rol<input type="text" v-model="perfil.cargo"></label>
          <label class="f">Área o zona de trabajo<input type="text" v-model="perfil.area" placeholder="Ej. Zona norte"></label>
        </div>
        <div>
          <div class="eyebrow" style="margin-bottom:6px">Actividades que realizo</div>
          <div class="chips">
            <label class="chk"><input type="checkbox" v-model="perfil.B"> Energía</label>
            <label class="chk"><input type="checkbox" v-model="perfil.C"> Agua</label>
            <label class="chk"><input type="checkbox" v-model="perfil.D"> Moto</label>
          </div>
          <p class="hint" style="margin-top:6px">Las secciones que no realizas se marcan solas como “No aplica”. Los cambios se guardan al enviar la inspección.</p>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="row">
        <label class="f" style="flex:0 1 190px">Fecha de inspección<input type="date" :value="fecha" :min="fechaMin" :max="hoy()" @change="cambiarFecha($event.target.value)"></label>
        <div class="stack" style="gap:4px">
          <span class="eyebrow">Estado</span>
          <span class="pill" :class="est.c">{{ est.t }}<template v-if="dia?.enviada_at"> · {{ fmtHora(dia.enviada_at) }}</template></span>
        </div>
        <span class="spacer"></span>
        <span class="hint" v-if="!bloqueada">{{ avance.hechos }}/{{ avance.total }} marcados</span>
      </div>
      <p class="hint" style="margin-top:10px">{{ APP.formato.nota }}</p>
      <div class="legend" style="margin-top:8px">
        <span><i class="mk C">✓</i>Cumple</span><span><i class="mk N">✗</i>No cumple</span><span><i class="mk NA">—</i>No aplica</span>
      </div>
      <div v-if="dia && (dia.estado === 'devuelta' || (dia.nota_revisor && dia.estado === 'validada'))" class="banner warn" style="margin-top:10px">
        {{ dia.estado === 'devuelta' ? 'Tu administrador devolvió esta inspección: ' : 'Nota del administrador: ' }}{{ dia.nota_revisor || 'Revisa y vuelve a enviar.' }}
      </div>
      <div v-if="cargando" class="banner" style="margin-top:10px"><span class="spin"></span> Cargando…</div>
    </div>

    <div v-for="s in SECCIONES" :key="s.k" class="sec" :class="{ off: !activas[s.k] }">
      <div class="sec-h">
        <span class="letter">{{ s.k }}</span><h3>{{ s.t }}</h3><span class="spacer"></span>
        <template v-if="activas[s.k]"><button v-if="!bloqueada" class="btn small" type="button" @click="todoCumple(s.k)">Todo cumple</button></template>
        <span v-else class="pill p-pend">No aplica · no realizo esta actividad</span>
      </div>
      <div class="items">
        <div v-for="[id, nombre] in s.items" :key="id" class="item" :class="{ isN: respuestas[id] === 'N' }">
          <span class="nm">{{ nombre }}</span>
          <div class="seg" role="group" :aria-label="nombre">
            <button v-for="k in ['C', 'N', 'NA']" :key="k" type="button" :class="k" :aria-pressed="respuestas[id] === k" :disabled="bloqueada" :data-tip="AYUDA[k]" :aria-label="`${TXT[k]}: ${AYUDA[k]}`" @click="marcar(id, k)">{{ SYM[k] }}</button>
          </div>
          <input v-if="respuestas[id] === 'N'" :id="`obs-${id}`" type="text" class="obs" maxlength="300" placeholder="¿Qué falla? (obligatorio)" v-model="obs[id]" :disabled="bloqueada" @input="guardarBorrador">
        </div>
      </div>
    </div>

    <div class="card stack">
      <label class="f">Observaciones generales (opcional)<textarea v-model="obsGen" maxlength="1000" placeholder="Ej. Se solicitó reposición de filtros" :disabled="bloqueada" @input="guardarBorrador"></textarea></label>
      <div>
        <div class="row" style="margin-bottom:6px"><span class="eyebrow">Firma del empleado</span><span class="spacer"></span><button class="btn small" type="button" :disabled="bloqueada" @click="firma.limpiar()">Borrar firma</button></div>
        <FirmaPad ref="firma" :bloqueada="bloqueada" />
      </div>
      <p class="err" v-if="error">{{ error }}</p>
      <div class="row">
        <button class="btn primary" type="button" :disabled="bloqueada || enviando" @click="enviar">
          <template v-if="enviando"><span class="spin"></span> Enviando…</template>
          <template v-else>{{ bloqueada ? 'Inspección validada ✓' : dia ? 'Corregir y volver a enviar' : 'Firmar y enviar inspección' }}</template>
        </button>
        <button class="btn" type="button" :disabled="bloqueada" @click="copiarAnterior">Copiar respuestas del día anterior</button>
      </div>
    </div>

    <div class="card stack">
      <div class="row"><h2>Mi planilla del mes</h2><span class="spacer"></span><input type="month" :value="mes" :max="mesDe(hoy())" style="width:auto" @change="$event.target.value && cargarMes($event.target.value)"></div>
      <p class="hint">La misma planilla de papel, armada con tus inspecciones diarias. Toca un día para abrirlo.</p>
      <PlanillaMes :mes="mes" :dias="dias" :sel="fecha" @elegir="elegirDia" />
    </div>
  </section>
</template>
