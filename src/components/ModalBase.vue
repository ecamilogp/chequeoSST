<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
const props = defineProps({ cerrable: { type: Boolean, default: true } });
const emit = defineEmits(['cerrar']);
const caja = ref(null);
const tecla = e => { if (e.key === 'Escape' && props.cerrable) emit('cerrar'); };
onMounted(() => {
  document.addEventListener('keydown', tecla);
  setTimeout(() => caja.value?.querySelector('input,select,textarea,button')?.focus(), 30);
});
onBeforeUnmount(() => document.removeEventListener('keydown', tecla));
</script>

<template>
  <Teleport to="body">
    <div class="modal-bg" @click.self="cerrable && emit('cerrar')">
      <div class="modal" role="dialog" aria-modal="true" ref="caja"><slot /></div>
    </div>
  </Teleport>
</template>
