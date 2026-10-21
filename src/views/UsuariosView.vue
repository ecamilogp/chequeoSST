<script setup>
// Registro de correos autorizados. El owner gestiona administradores y empleados;
// los administradores solo empleados. Las reglas se aplican también en la base de datos.
import { ref, computed, onMounted } from 'vue';
import { APP } from '../empresa.js';
import { sb } from '../lib/supabase.js';
import { ROLES, msgError } from '../lib/textos.js';
import { miembro, esOwner } from '../composables/useSesion.js';
import { toast } from '../composables/useToast.js';
import ModalBase from '../components/ModalBase.vue';

const yo = miembro.value;
const lista = ref([]);
const cargando = ref(false);
const filtro = ref('');
const form = ref(null);       // datos del formulario abierto
const confirmar = ref(null);  // miembro a activar o desactivar
const error = ref('');
const guardando = ref(false);

const visibles = computed(() => {
  const f = filtro.value.trim().toLowerCase();
  return lista.value.filter(m => !f || m.nombre.toLowerCase().includes(f) || m.email.includes(f));
});
const puedeEditar = m => m.rol !== 'owner' && (esOwner.value || m.rol === 'empleado');
const actividades = m => ['Generales', m.energia && 'Energía', m.agua && 'Agua', m.moto && 'Moto'].filter(Boolean).join(', ');

async function cargar() {
  cargando.value = true;
  const { data, error: e } = await sb.from('miembros').select('*').order('nombre');
  cargando.value = false;
  if (e) return toast(msgError(e));
  lista.value = data;
}

function nuevo() { error.value = ''; form.value = { id: null, email: '', nombre: '', cargo: 'Técnico', area: '', rol: 'empleado', energia: false, agua: false, moto: false }; }
function editar(m) { error.value = ''; form.value = { ...m }; }

async function guardar() {
  const f = form.value;
  error.value = !f.email.trim() ? 'Escribe el correo de Google.' : !f.nombre.trim() ? 'Escribe el nombre.' : '';
  if (error.value) return;
  guardando.value = true;
  const { error: e } = await sb.rpc('guardar_miembro', {
    p_id: f.id, p_email: f.email, p_nombre: f.nombre, p_cargo: f.cargo, p_area: f.area, p_rol: f.rol,
    p_energia: f.energia, p_agua: f.agua, p_moto: f.moto
  });
  guardando.value = false;
  if (e) { error.value = msgError(e); return; }
  toast(f.id ? 'Cambios guardados' : `${f.nombre} ya puede entrar con ${f.email.trim().toLowerCase()}`);
  form.value = null;
  cargar();
}

async function cambiarEstado() {
  const m = confirmar.value;
  guardando.value = true;
  const { error: e } = await sb.rpc('activar_miembro', { p_id: m.id, p_activo: !m.activo });
  guardando.value = false;
  if (e) { error.value = msgError(e); return; }
  toast(m.activo ? 'Usuario desactivado' : 'Usuario activado');
  confirmar.value = null;
  cargar();
}

async function copiarEnlace() {
  try { await navigator.clipboard.writeText(location.origin); toast('Enlace copiado'); }
  catch { toast(location.origin); }
}

onMounted(cargar);
</script>

<template>
  <section class="stack">
    <div class="row barra">
      <h2 style="margin:0;font-family:var(--f-display)">Usuarios</h2>
      <span class="spacer"></span>
      <button class="btn" type="button" @click="copiarEnlace">Copiar enlace de la app</button>
      <button class="btn primary" type="button" @click="nuevo">Registrar correo</button>
    </div>
    <p class="hint">
      Registra el correo de Google de cada persona. Después solo tiene que abrir la app y tocar <b>Continuar con Google</b>.
      <template v-if="!esOwner"> Como administrador puedes registrar y editar empleados; los administradores los gestiona el owner.</template>
    </p>
    <input type="text" v-model="filtro" placeholder="Buscar por nombre o correo" style="max-width:360px">

    <div class="scroll tabla-usuarios">
      <table class="users">
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Cargo</th><th>Área</th><th>Actividades</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr v-if="cargando"><td colspan="8"><span class="spin"></span> Cargando…</td></tr>
          <tr v-for="m in visibles" :key="m.id" :class="{ off: !m.activo }">
            <td data-l="Nombre" class="u-nombre">{{ m.nombre }}</td><td data-l="Correo" class="u-correo">{{ m.email }}</td><td data-l="Rol">{{ ROLES[m.rol] }}</td><td data-l="Cargo">{{ m.cargo }}</td><td data-l="Área">{{ m.area }}</td><td data-l="Actividades">{{ actividades(m) }}</td>
            <td data-l="Estado">
              <span v-if="!m.activo" class="pill p-pend">Inactivo</span>
              <span v-else-if="!m.user_id" class="pill p-warn">No ha ingresado</span>
              <span v-else class="pill p-ok">Activo</span>
            </td>
            <td class="u-acc">
              <div v-if="puedeEditar(m) && m.id !== yo.id" class="row" style="flex-wrap:nowrap">
                <button class="btn small" type="button" @click="editar(m)">Editar</button>
                <button class="btn small" :class="{ danger: m.activo }" type="button" @click="error = ''; confirmar = m">{{ m.activo ? 'Desactivar' : 'Activar' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ModalBase v-if="form" @cerrar="form = null">
      <h2>{{ form.id ? `Editar a ${form.nombre}` : 'Registrar correo' }}</h2>
      <label class="f">Correo de Google<input type="email" v-model="form.email" autocapitalize="none" spellcheck="false" placeholder="nombre@gmail.com" :disabled="!!form.user_id"></label>
      <p v-if="form.user_id" class="hint">El correo no se puede cambiar porque esta persona ya ingresó.</p>
      <label class="f">Nombre completo<input type="text" v-model="form.nombre"></label>
      <div class="grid2">
        <label class="f">Cargo<input type="text" v-model="form.cargo"></label>
        <label class="f">Área o zona<input type="text" v-model="form.area"></label>
      </div>
      <label class="f">Rol
        <select v-model="form.rol" :disabled="!esOwner">
          <option value="empleado">Empleado</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <div>
        <div class="eyebrow" style="margin-bottom:6px">Actividades que realiza</div>
        <div class="chips">
          <label class="chk"><input type="checkbox" v-model="form.energia"> Energía</label>
          <label class="chk"><input type="checkbox" v-model="form.agua"> Agua</label>
          <label class="chk"><input type="checkbox" v-model="form.moto"> Moto</label>
        </div>
      </div>
      <p class="hint"><b>Empleado:</b> llena y firma su inspección. <b>Administrador:</b> además revisa las de todos, descarga el Excel y registra empleados.</p>
      <p class="err" v-if="error">{{ error }}</p>
      <div class="row">
        <button class="btn primary" type="button" :disabled="guardando" @click="guardar">{{ form.id ? 'Guardar cambios' : 'Registrar' }}</button>
        <button class="btn" type="button" @click="form = null">Cancelar</button>
      </div>
    </ModalBase>

    <ModalBase v-if="confirmar" @cerrar="confirmar = null">
      <h2>{{ confirmar.activo ? 'Desactivar' : 'Activar' }} a {{ confirmar.nombre }}</h2>
      <p class="hint">{{ confirmar.activo ? `No podrá volver a entrar a ${APP.nombre}. Sus inspecciones se conservan.` : 'Podrá volver a entrar con su cuenta de Google.' }}</p>
      <p class="err" v-if="error">{{ error }}</p>
      <div class="row">
        <button class="btn" :class="confirmar.activo ? 'danger' : 'primary'" type="button" :disabled="guardando" @click="cambiarEstado">{{ confirmar.activo ? 'Desactivar' : 'Activar' }}</button>
        <button class="btn" type="button" @click="confirmar = null">Cancelar</button>
      </div>
    </ModalBase>
  </section>
</template>
