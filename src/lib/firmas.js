import { sb, BUCKET } from './supabase.js';

export async function urlFirma(path) {
  if (!path) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl || null;
}

export async function subirFirma(path, blob) {
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false });
  if (error) throw error;
  return path;
}

// Descarga varias firmas y las devuelve en base64 (para el Excel).
export async function descargarFirmas(paths) {
  const unicos = [...new Set(paths.filter(Boolean))], out = {};
  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(unicos.slice(i, i + 100), 600);
    if (error) throw error;
    await Promise.all(data.filter(d => d.signedUrl).map(async d => {
      try {
        const bytes = new Uint8Array(await (await fetch(d.signedUrl)).arrayBuffer());
        let s = '';
        for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
        out[d.path] = btoa(s);
      } catch { /* una firma que no carga no detiene el Excel */ }
    }));
  }
  return out;
}

export const blobADataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
