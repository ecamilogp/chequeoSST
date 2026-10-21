# ChequeoSST · Inspección diaria de EPP y dotación

App web para que los empleados de **Gatria** llenen y firmen desde el celular la planilla
**FO-CG-42 · Formato inspección elementos de protección personal y dotación**, y para que el owner y
los administradores la revisen con su firma y descarguen el informe del mes en Excel.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Owner** | Todo: registra administradores y empleados, revisa, descarga informes. |
| **Administrador** | Revisa (valida o devuelve con firma), descarga el Excel y registra empleados. |
| **Empleado** | Llena y firma su inspección diaria y ve solo la suya. |

Todos entran con **"Continuar con Google"**. Solo pueden entrar los correos registrados en la pestaña
**Usuarios**; cualquier otra cuenta de Google es rechazada.

## Cómo está construida

| Parte | Tecnología |
|---|---|
| Pantallas y lógica | [Vue 3](https://vuejs.org) (JavaScript) + [Vite](https://vitejs.dev) |
| Diseño | CSS propio (`src/styles.css`) |
| Base de datos, ingreso con Google y firmas | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage) |
| Publicación | [Netlify](https://netlify.com), conectado a este repositorio |
| Excel | [ExcelJS](https://github.com/exceljs/exceljs), se genera en el navegador |

La seguridad está en la base de datos (`supabase/schema.sql`): cada empleado solo ve lo suyo, desde la
app no se puede escribir directo en las tablas, y todas las reglas (elementos completos, observación
obligatoria en "No cumple", fechas permitidas, no editar lo validado, no revisar lo propio, quién puede
registrar a quién) se revisan en el servidor.

```
index.html                    Página base
src/App.vue                   Cabecera, pestañas y sesión
src/views/LoginView.vue       Ingreso con Google
src/views/InspeccionView.vue  Planilla del empleado
src/views/RevisionView.vue    Revisión y Excel (owner y administradores)
src/views/UsuariosView.vue    Registro de correos y roles
src/components/               Firma, planilla del mes, ventanas
src/composables/              Sesión y avisos
src/lib/                      Supabase, elementos, fechas, Excel, firmas
src/empresa.js                Empresa, código y versión del formato
supabase/schema.sql           Tablas, reglas de seguridad y funciones
public/                       Íconos (y logo-empresa.png si lo agregas)
```

---

## Puesta en marcha (una sola vez)

### 1. Supabase

1. Crea una cuenta en supabase.com y un proyecto nuevo (región sugerida: **South America (São Paulo)**).
2. **SQL Editor → New query**: pega todo `supabase/schema.sql` y dale **Run**.
3. Regístrate como owner. En **SQL Editor** ejecuta, con tu correo de Google:

   ```sql
   insert into public.miembros (email, nombre, cargo, rol, energia, moto)
   values ('tucorreo@gmail.com', 'Edward Camilo García Quintes', 'Técnico', 'owner', true, true);
   ```
4. En **Project Settings → API** copia la **Project URL** y la clave **anon public**.

### 2. Inicio de sesión con Google

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) y crea un proyecto (por ejemplo "ChequeoSST").
2. **APIs y servicios → Pantalla de consentimiento de OAuth**: tipo **Externo**, nombre de la app
   "ChequeoSST", tu correo de soporte. Al final, **Publicar app** (si queda "en prueba", solo entran
   los correos que agregues como usuarios de prueba).
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes de JavaScript autorizados:** la dirección de Netlify (ej. `https://chequeosst-gatria.netlify.app`) y `http://localhost:5173`.
   - **URI de redireccionamiento autorizados:** `https://TU-PROYECTO.supabase.co/auth/v1/callback`
     (la encuentras en Supabase → Authentication → Sign In / Providers → Google).
4. Copia el **ID de cliente** y el **secreto**. En Supabase → **Authentication → Sign In / Providers → Google**:
   actívalo y pégalos.
5. En Supabase → **Authentication → URL Configuration**:
   - **Site URL:** la dirección de Netlify.
   - **Redirect URLs:** la dirección de Netlify y `http://localhost:5173`.
6. (Recomendado) **Authentication → Hooks → Before User Created → Postgres** y elige la función
   `public.hook_antes_de_crear_usuario`. Así Supabase rechaza desde el inicio a cualquier correo no
   registrado. Deja activado "Allow new users to sign up": lo necesita el ingreso con Google la primera vez.

### 3. Netlify

1. **Add new site → Import an existing project → GitHub** → este repositorio. La configuración se toma
   de `netlify.toml`.
2. **Site configuration → Environment variables**:

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL de Supabase |
   | `VITE_SUPABASE_ANON_KEY` | clave anon public |

3. **Deploys → Trigger deploy**. En **Domain management** cambia el nombre del sitio (ej. `chequeosst-gatria`)
   y usa esa dirección en los pasos de Google y Supabase.

### 4. Primer uso

1. Abre la dirección de Netlify y entra con tu cuenta de Google.
2. En **Usuarios** registra los correos de administradores y empleados.
3. Comparte el enlace. En el celular: abrir en Chrome o Safari → **Agregar a pantalla de inicio**.

Para mostrar el logo de la empresa, agrega el archivo `public/logo-empresa.png`.

---

## Prueba antes de usarla con todos

- [ ] Un correo no registrado intenta entrar y es rechazado.
- [ ] Un empleado entra con Google, llena la planilla, marca un "No cumple" con observación y firma.
- [ ] Ve su envío en "Mi planilla del mes" y no ve las inspecciones de nadie más.
- [ ] Un administrador la **devuelve** con una nota; el empleado la ve, corrige y reenvía.
- [ ] El administrador la **valida** con su firma; el empleado ya no puede modificarla.
- [ ] Nadie puede validar su propia inspección.
- [ ] El administrador registra un empleado, pero no puede crear administradores.
- [ ] Se descarga el Excel del mes con la planilla y las firmas.
- [ ] Al desactivar a alguien, deja de poder entrar.

## Trabajar en el código

```bash
npm install
cp .env.example .env    # y llena las dos variables
npm run dev             # http://localhost:5173
```

## Cambiar el formato

- Empresa, código, versión o nota del formato: `src/empresa.js`.
- Agregar o quitar elementos: `src/lib/catalogo.js` **y** la tabla `elementos` en Supabase
  (para retirar uno sin perder historial, ponle `activo = false`).
- Días hacia atrás permitidos: `diasAtrasPermitidos` en `src/empresa.js` y el `- 7` de la función
  `enviar_inspeccion` en `supabase/schema.sql`.

## Datos personales

La app guarda nombre, correo, inspecciones, firmas y la ubicación del celular al enviar, con el fin de
llevar el control de EPP del SG-SST (Ley 1581 de 2012). El aviso se muestra en la pantalla de ingreso.
