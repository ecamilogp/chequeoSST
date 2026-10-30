<script setup>
// Pantalla del owner y los administradores: ver, validar o devolver, y descargar el Excel.
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { sb } from '../lib/supabase.js';
import { ALL } from '../lib/catalogo.js';
import { hoy, mesDe, rangoMes, sumarDias, fmtFecha, fmtMes, fmtHora, fmtFechaHora } from '../lib/fechas.js';
import { estadoDe, msgError } from '../lib/textos.js';
import { urlFirma, subirFirma, blobADataURL } from '../lib/firmas.js';
import { lsGet, lsSet, lsDel } from '../lib/almacen.js';
import { destino } from '../composables/useNotificaciones.js';
import { miembro } from '../composables/useSesion.js';
import { toast } from '../composables/useToast.js';
import FirmaPad from '../components/FirmaPad.vue';
import PlanillaMes from '../components/PlanillaMes.vue';
import ExcelModal from '../components/ExcelModal.vue';
import ValidarDiaModal from '../components/ValidarDiaModal.vue';

const yo = miembro.value;
const fecha = ref(hoy());
const miembros = ref([]);
const lista = ref([]);
const sel = ref(null);
const dias = ref({});
const dia = ref(null);
const firmas = ref({ emp: null, rev: null });
const cargandoLista = ref(false);
const cargandoDet = ref(false);
const verExcel = ref(false);
const verValidarDia = ref(false);
const atrasados = ref([]); // [{ fecha, n }] días con inspecciones por validar
const rev = ref({ nombre: yo.nombre, cargo: yo.cargo || 'Administrador', nota: '', recordar: false });
const errRev = ref('');
const guardando = ref(false);
const padRev = ref(null);
const detalle = ref(null);
const claveFirma = `chequeosst-firma-rev-${yo.id}`;
let timer;

const ordenada = computed(() => lista.value.slice().sort((a, b) =>
  (!!b.dia - !!a.dia) || ((b.dia?.total_no_cumple || 0) - (a.dia?.total_no_cumple || 0)) || a.nombre.localeCompare(b.nombre)));
const kpi = computed(() => {
  const k = { rep: 0, nc: 0, pend: 0, val: 0 };
  for (const t of lista.value) {
    const d = t.dia; if (!d) continue;
    k.rep++; if (d.total_no_cumple) k.nc++;
    if (d.estado === 'validada') k.val++; else if (d.estado !== 'devuelta') k.pend++;
  }
  return k;
});
// Inspecciones del día elegido que se pueden validar en bloque (no la propia, no devueltas).
const pendientesDia = computed(() => lista.value
  .filter(t => t.dia && t.id !== yo.id && (t.dia.estado === 'pendiente' || t.dia.estado === 'corregida'))
  .map(t => ({ id: t.dia.id, nombre: t.nombre, total_no_cumple: t.dia.total_no_cumple })));
const persona = computed(() => miembros.value.find(m => m.id === sel.value));
const propia = computed(() => sel.value === yo.id);
const puedeRevisar = computed(() => dia.value && dia.value.estado !== 'validada' && !propia.value);
const noCumplen = computed(() => dia.value ? ALL.filter(e => dia.value.respuestas[e.id] === 'N') : []);
const cuenta = v => dia.value ? ALL.filter(e => dia.value.respuestas[e.id] === v).length : 0;

async function cargarLista(silencioso) {
  if (!silencioso) cargandoLista.value = true;
  try {
    const [m, i] = await Promise.all([
      sb.from('miembros').select('id, email, nombre, cargo, area, rol, activo').order('nombre'),
      sb.from('inspecciones').select('id, miembro_id, estado, total_no_cumple, enviada_at').eq('fecha', fecha.value)
    ]);
    if (m.error) throw m.error; if (i.error) throw i.error;
    miembros.value = m.data;
    const porM = Object.fromEntries(i.data.map(x => [x.miembro_id, x]));
    lista.value = m.data.filter(p => (p.activo && p.rol === 'empleado') || porM[p.id]).map(p => ({ ...p, dia: porM[p.id] || null }));
  } catch (e) { toast(msgError(e)); }
  cargandoLista.value = false;
  cargarAtrasados();
}

// Días (de los últimos 60) que tienen inspecciones por validar, separados por fecha.
async function cargarAtrasados() {
  const { data, error } = await sb.from('inspecciones').select('fecha')
    .in('estado', ['pendiente', 'corregida']).neq('miembro_id', yo.id)
    .gte('fecha', sumarDias(hoy(), -60)).order('fecha', { ascending: false });
  if (error) return;
  const n = {};
  for (const { fecha: f } of data) n[f] = (n[f] || 0) + 1;
  atrasados.value = Object.entries(n).map(([f, c]) => ({ fecha: f, n: c }));
}

async function diaValidado(n) {
  verValidarDia.value = false;
  toast(n ? `Se validaron ${n} inspecciones del ${fmtFecha(fecha.value)}` : 'No había inspecciones por validar ese día');
  await cargarLista(true);
  if (sel.value) await abrir(sel.value, true);
}

async function abrir(id, silencioso) {
  sel.value = id;
  // En celular el detalle queda debajo de la lista: lo traemos a la vista.
  if (!silencioso && window.innerWidth < 900) setTimeout(() => detalle.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  if (!silencioso) cargandoDet.value = true;
  try {
    const { desde, hasta } = rangoMes(mesDe(fecha.value));
    const [m, d] = await Promise.all([
      sb.from('inspecciones').select('fecha, respuestas, obs_items, estado').eq('miembro_id', id).gte('fecha', desde).lte('fecha', hasta),
      sb.from('inspecciones').select('*').eq('miembro_id', id).eq('fecha', fecha.value).maybeSingle()
    ]);
    if (m.error) throw m.error; if (d.error) throw d.error;
    if (sel.value !== id) return;
    dias.value = Object.fromEntries(m.data.map(x => [x.fecha, x]));
    dia.value = d.data;
    firmas.value = d.data ? { emp: await urlFirma(d.data.firma_path), rev: await urlFirma(d.data.firma_revisor_path) } : { emp: null, rev: null };
    errRev.value = ''; rev.value.nota = '';
    const guardada = lsGet(claveFirma);
    rev.value.recordar = !!guardada;
    if (guardada) setTimeout(() => padRev.value?.cargar(guardada), 50);
  } catch (e) { toast(msgError(e)); }
  cargandoDet.value = false;
}

async function cambiarFecha(f) {
  if (!f || f > hoy()) return;
  fecha.value = f;
  await cargarLista();
  if (sel.value) await abrir(sel.value);
}

async function revisar(estado) {
  errRev.value = !rev.value.nombre.trim() ? 'Escribe tu nombre.'
    : padRev.value.estaVacia() ? 'Falta tu firma.'
    : estado === 'devuelta' && !rev.value.nota.trim() ? 'Escribe una nota explicando qué debe corregir.' : '';
  if (errRev.value) return;
  guardando.value = true;
  try {
    const blob = await padRev.value.blob();
    const path = await subirFirma(`rev/${yo.id}/${dia.value.id}-${Date.now()}.png`, blob);
    const { error } = await sb.rpc('revisar_inspeccion', {
      p_id: dia.value.id, p_estado: estado, p_nombre: rev.value.nombre.trim(), p_cargo: rev.value.cargo.trim(), p_nota: rev.value.nota.trim(), p_firma_path: path
    });
    if (error) throw error;
    if (rev.value.recordar) lsSet(claveFirma, await blobADataURL(blob)); else lsDel(claveFirma);
    toast(estado === 'validada' ? 'Inspección validada' : 'Inspección devuelta al empleado');
    await cargarLista(true); await abrir(sel.value, true);
  } catch (e) { errRev.value = msgError(e); }
  guardando.value = false;
}

function elegirDia(f) { if (f <= hoy()) cambiarFecha(f); }

// Un aviso de "corregida" abre ese día con el empleado seleccionado.
async function irAlDestino(d) {
  if (!d || d.pestana !== 'revision') return;
  destino.value = null;
  fecha.value = d.fecha;
  await cargarLista();
  if (d.empleadoId) await abrir(d.empleadoId);
}
watch(destino, irAlDestino);

onMounted(() => {
  if (destino.value?.pestana === 'revision') irAlDestino(destino.value); else cargarLista();
  timer = setInterval(() => { if (document.visibilityState === 'visible') cargarLista(true); }, 60000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <section class="stack">
    <div class="row barra">
      <label class="f" style="flex:0 1 190px">Día<input type="date" :value="fecha" :max="hoy()" @change="cambiarFecha($event.target.value)"></label>
      <span class="spacer"></span>
      <button class="btn" type="button" @click="cargarLista()">Actualizar</button>
      <button class="btn primary" type="button" @click="verExcel = true">Descargar Excel</button>
    </div>

    <div v-if="atrasados.length" class="card atrasados">
      <div class="eyebrow">Días con inspecciones por validar</div>
      <div class="chips">
        <button v-for="a in atrasados" :key="a.fecha" type="button" class="chip-dia" :aria-current="a.fecha === fecha" @click="cambiarFecha(a.fecha)">
          {{ fmtFecha(a.fecha).replace(/^./, c => c.toUpperCase()) }} <b>{{ a.n }}</b>
        </button>
      </div>
    </div>

    <div v-if="pendientesDia.length" class="banner validar-dia">
      <span><b>{{ pendientesDia.length }}</b> {{ pendientesDia.length === 1 ? 'inspección' : 'inspecciones' }} por validar el {{ fmtFecha(fecha) }}.</span>
      <button class="btn ok" type="button" @click="verValidarDia = true">Validar todo el día</button>
    </div>

    <div class="kpis">
      <div class="kpi"><b>{{ kpi.rep }}/{{ lista.length }}</b><span>Empleados que reportaron</span></div>
      <div class="kpi"><b style="color:var(--bad)">{{ kpi.nc }}</b><span>Con elementos que no cumplen</span></div>
      <div class="kpi"><b style="color:var(--accent)">{{ kpi.pend }}</b><span>Por validar</span></div>
      <div class="kpi"><b style="color:var(--ok)">{{ kpi.val }}</b><span>Validadas</span></div>
    </div>

    <div class="sup">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:12px 14px;border-bottom:1px solid var(--line)"><h2 style="margin:0">Empleados</h2><p class="hint">Primero los que tienen novedades.</p></div>
        <div class="tlist">
          <div v-if="cargandoLista" class="empty"><span class="spin"></span> Cargando…</div>
          <div v-else-if="!ordenada.length" class="empty">No hay empleados activos. Regístralos en la pestaña <b>Usuarios</b>.</div>
          <button v-for="t in ordenada" :key="t.id" type="button" class="tech" :aria-current="sel === t.id" @click="abrir(t.id)">
            <span class="who"><b>{{ t.nombre }}</b><small>{{ t.cargo }}<template v-if="t.area"> · {{ t.area }}</template></small></span>
            <span v-if="t.dia?.total_no_cumple" class="pill p-bad">{{ t.dia.total_no_cumple }} no cumple</span>
            <span class="pill" :class="estadoDe(t.dia).c">{{ t.dia ? estadoDe(t.dia).t.replace(' · por validar', '') : 'Sin reporte' }}</span>
          </button>
        </div>
      </div>

      <div class="card stack detalle" style="min-width:0" ref="detalle">
        <div v-if="!persona" class="empty">Selecciona un empleado para ver su inspección y validarla.</div>
        <div v-else-if="cargandoDet" class="empty"><span class="spin"></span> Cargando…</div>
        <template v-else>
          <div class="row">
            <div style="min-width:0"><div class="eyebrow">{{ fmtFecha(fecha) }}</div><h2 style="margin:2px 0 0">{{ persona.nombre }}</h2><p class="hint">{{ persona.cargo }}<template v-if="persona.area"> · {{ persona.area }}</template> · {{ persona.email }}</p></div>
            <span class="spacer"></span><span class="pill" :class="estadoDe(dia).c">{{ estadoDe(dia).t }}</span>
          </div>

          <div v-if="!dia" class="banner warn">No ha enviado la inspección de este día.</div>
          <template v-else>
            <div class="grid2" style="align-items:start">
              <div>
                <div class="eyebrow">Resultado</div>
                <p style="margin:4px 0 0">{{ cuenta('C') }} cumplen · <b style="color:var(--bad)">{{ noCumplen.length }} no cumplen</b> · {{ cuenta('NA') }} no aplican</p>
                <ul v-if="noCumplen.length" class="ncl"><li v-for="e in noCumplen" :key="e.id"><b>{{ e.n }}</b><small>Sección {{ e.s }} · {{ dia.obs_items?.[e.id] }}</small></li></ul>
                <p v-if="dia.observaciones" class="hint" style="margin-top:8px"><b>Observaciones:</b> {{ dia.observaciones }}</p>
                <p class="hint" style="margin-top:6px">Enviada a las {{ fmtHora(dia.enviada_at) }}<template v-if="dia.ubicacion"> · <a :href="`https://www.google.com/maps?q=${encodeURIComponent(dia.ubicacion)}`" target="_blank" rel="noopener">ver ubicación</a></template></p>
              </div>
              <div><div class="eyebrow" style="margin-bottom:4px">Firma del empleado</div><img v-if="firmas.emp" class="sigimg" :src="firmas.emp" :alt="`Firma de ${persona.nombre}`"><p v-else class="hint">Sin imagen</p></div>
            </div>

            <div v-if="dia.revisor_nombre" class="grid2" style="align-items:start">
              <p class="hint">{{ dia.estado === 'validada' ? 'Validada' : 'Última revisión: devuelta' }} por <b>{{ dia.revisor_nombre }}</b><template v-if="dia.revisor_cargo"> · {{ dia.revisor_cargo }}</template> el {{ fmtFechaHora(dia.revisada_at) }}<template v-if="dia.nota_revisor"> · “{{ dia.nota_revisor }}”</template></p>
              <img v-if="firmas.rev" class="sigimg" :src="firmas.rev" alt="Firma de quien revisó">
            </div>

            <p v-if="propia && dia.estado !== 'validada'" class="hint">Esta es tu propia inspección: debe revisarla otra persona.</p>

            <details v-if="puedeRevisar" open style="border-top:1px solid var(--line);padding-top:12px">
              <summary>Revisar como quien inspecciona</summary>
              <div class="stack" style="gap:10px;margin-top:10px">
                <div class="grid2">
                  <label class="f">Nombre de quien inspecciona<input type="text" v-model="rev.nombre"></label>
                  <label class="f">Cargo / rol<input type="text" v-model="rev.cargo"></label>
                </div>
                <label class="f">Nota para el empleado (obligatoria si la devuelves)<input type="text" v-model="rev.nota" maxlength="500" placeholder="Ej. Cambiar filtro de máscara antes del viernes"></label>
                <div>
                  <div class="row" style="margin-bottom:6px"><span class="eyebrow">Tu firma</span><span class="spacer"></span><button class="btn small" type="button" @click="padRev.limpiar()">Borrar firma</button></div>
                  <FirmaPad ref="padRev" texto="Firma aquí" />
                  <label class="chk" style="margin-top:8px"><input type="checkbox" v-model="rev.recordar"> Recordar mi firma en este dispositivo</label>
                </div>
                <p class="err" v-if="errRev">{{ errRev }}</p>
                <div class="row">
                  <button class="btn ok" type="button" :disabled="guardando" @click="revisar('validada')">Validar inspección</button>
                  <button class="btn danger" type="button" :disabled="guardando" @click="revisar('devuelta')">Devolver para corregir</button>
                </div>
              </div>
            </details>
          </template>

          <div class="stack" style="gap:8px;min-width:0">
            <span class="eyebrow">Planilla de {{ fmtMes(mesDe(fecha)) }} · toca un día para abrirlo</span>
            <PlanillaMes :mes="mesDe(fecha)" :dias="dias" :sel="fecha" @elegir="elegirDia" />
          </div>
        </template>
      </div>
    </div>

    <ValidarDiaModal v-if="verValidarDia" :fecha="fecha" :pendientes="pendientesDia" :yo="yo" :clave-firma="claveFirma"
      @cerrar="verValidarDia = false" @hecho="diaValidado" />
    <ExcelModal v-if="verExcel" :miembros="miembros" :mes-inicial="mesDe(fecha)" @cerrar="verExcel = false" />
  </section>
</template>
