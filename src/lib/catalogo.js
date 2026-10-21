// Elementos de la planilla FO-CG-42. Debe coincidir con la tabla "elementos" de supabase/schema.sql.
export const SECCIONES = [
  { k: 'A', t: 'EPP generales', flag: null, items: [
    ['A01', 'Gafas de seguridad lente claro'], ['A02', 'Gafas lente oscuro'], ['A03', 'Monogafa de seguridad LC'],
    ['A04', 'Tapaoídos de inserción'], ['A05', 'Tapaoídos de copa'], ['A06', 'Guantes de poliuretano'],
    ['A07', 'Guantes anticorte CAT 5'], ['A08', 'Guantes de carnaza'], ['A09', 'Casco de seguridad tipo II'],
    ['A10', 'Máscara respirador media cara'], ['A11', 'Filtro para máscara'], ['A12', 'Botas de seguridad dieléctricas']] },
  { k: 'B', t: 'EPP para actividades de energía', flag: 'energia', items: [
    ['B01', 'Guante protector de carnaza'], ['B02', 'Guantín de algodón'], ['B03', 'Guante caucho aislado CL0'],
    ['B04', 'Guante caucho aislado CL2'], ['B05', 'Guante caucho aislado CL4'], ['B06', 'Careta arco eléctrico'],
    ['B07', 'Monja balaclava'], ['B08', 'Overol ignífugo']] },
  { k: 'C', t: 'EPP para actividades de agua', flag: 'agua', items: [
    ['C01', 'Rodilleras'], ['C02', 'Guantes de caucho'], ['C03', 'Máscara full face'], ['C04', 'Overol de trabajo'], ['C05', 'Impermeable']] },
  { k: 'D', t: 'EPP para moto', flag: 'moto', items: [
    ['D01', 'Rodilleras'], ['D02', 'Coderas'], ['D03', 'Casco de motociclista'], ['D04', 'Chaleco airbag'],
    ['D05', 'Guante protector para motocicleta'], ['D06', 'Botas para motocicleta'], ['D07', 'Bala de repuesto']] },
  { k: 'E', t: 'Dotación', flag: null, items: [['E01', 'Camibuso gris'], ['E02', 'Pantalón']] }
];
export const ALL = SECCIONES.flatMap(s => s.items.map(([id, n]) => ({ id, n, s: s.k, st: s.t, flag: s.flag })));
export const SYM = { C: '✓', N: '✗', NA: '—' };
export const TXT = { C: 'Cumple', N: 'No cumple', NA: 'No aplica' };
