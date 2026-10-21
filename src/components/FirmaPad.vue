<script setup>
// Recuadro para firmar con el dedo o el mouse.
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({ bloqueada: { type: Boolean, default: false }, texto: { type: String, default: 'Firma aquí con el dedo' } });
const caja = ref(null), lienzo = ref(null), vacia = ref(true);
let ctx, dibujando = false, ultimo = null, fondo = null, ro;

function ajustar() {
  const r = caja.value.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  if (!r.width) return;
  const actual = vacia.value ? null : lienzo.value.toDataURL();
  lienzo.value.width = r.width * dpr; lienzo.value.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  Object.assign(ctx, { lineWidth: 2.4, lineCap: 'round', lineJoin: 'round', strokeStyle: '#16202b' });
  const src = actual || fondo;
  if (src) pintar(src);
}
function pintar(src) {
  const r = caja.value.getBoundingClientRect(), im = new Image();
  im.crossOrigin = 'anonymous';
  im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height);
  im.src = src;
}
const punto = e => { const r = lienzo.value.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function bajar(e) {
  if (props.bloqueada) return;
  dibujando = true; lienzo.value.setPointerCapture(e.pointerId); ultimo = punto(e); vacia.value = false;
  ctx.beginPath(); ctx.arc(ultimo.x, ultimo.y, 1.1, 0, 7); ctx.fillStyle = '#16202b'; ctx.fill();
}
function mover(e) {
  if (!dibujando) return;
  const p = punto(e); ctx.beginPath(); ctx.moveTo(ultimo.x, ultimo.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ultimo = p;
}
const subir = () => { dibujando = false; };

function limpiar() {
  fondo = null; vacia.value = true;
  const r = caja.value.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height);
}
function cargar(src) { limpiar(); if (!src) return; fondo = src; vacia.value = false; pintar(src); }
const estaVacia = () => vacia.value;
// PNG con fondo blanco de 480 px de ancho.
function blob() {
  const c = lienzo.value, out = document.createElement('canvas');
  out.width = 480; out.height = Math.max(1, Math.round(480 * c.height / c.width));
  const o = out.getContext('2d'); o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height); o.drawImage(c, 0, 0, out.width, out.height);
  return new Promise(res => out.toBlob(res, 'image/png'));
}
defineExpose({ limpiar, cargar, estaVacia, blob });

onMounted(() => { ctx = lienzo.value.getContext('2d'); ro = new ResizeObserver(ajustar); ro.observe(caja.value); });
onBeforeUnmount(() => ro?.disconnect());
</script>

<template>
  <div class="sigbox" ref="caja" :class="{ locked: bloqueada }">
    <canvas ref="lienzo" @pointerdown="bajar" @pointermove="mover" @pointerup="subir" @pointercancel="subir"></canvas>
    <div class="line"></div>
    <div class="ph" v-show="vacia">{{ texto }}</div>
  </div>
</template>
