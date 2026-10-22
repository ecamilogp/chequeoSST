import { ref } from 'vue';
import { lsGet, lsSet } from '../lib/almacen.js';

// Tema claro u oscuro. Si la persona no ha elegido, se usa el del celular o computador.
const sistemaOscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;
export const tema = ref(lsGet('chequeosst-tema') || (sistemaOscuro() ? 'oscuro' : 'claro'));

export function aplicarTema() {
  document.documentElement.dataset.theme = tema.value === 'oscuro' ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema.value === 'oscuro' ? '#17202a' : '#ffffff');
}
export function cambiarTema() {
  tema.value = tema.value === 'oscuro' ? 'claro' : 'oscuro';
  lsSet('chequeosst-tema', tema.value);
  aplicarTema();
}
