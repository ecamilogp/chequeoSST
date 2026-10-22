import { ref } from 'vue';

export const toastMsg = ref('');
let t;
export function toast(msg) {
  toastMsg.value = msg;
  clearTimeout(t);
  t = setTimeout(() => { toastMsg.value = ''; }, 3200);
}
