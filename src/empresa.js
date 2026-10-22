// Datos de la empresa y del formato que muestra la app y el Excel.
// Para mostrar el logo, pon el archivo en public/logo-empresa.png.
export const APP = {
  nombre: 'ChequeoSST',
  empresa: 'Gatria',
  formato: {
    titulo: 'Inspección EPP y dotación',
    tituloLargo: 'Formato inspección elementos de protección personal y dotación',
    codigo: 'FO-CG-42',
    version: '5',
    fecha: '10/04/2026',
    proceso: 'Proceso Control de Gestión',
    nota: 'La inspección de los elementos de protección se deberá realizar antes del inicio de cada actividad o tarea, con el fin de corroborar el buen estado de los mismos.'
  },
  zonaHoraria: 'America/Bogota',
  // Debe coincidir con el "- 7" de la función enviar_inspeccion en supabase/schema.sql.
  diasAtrasPermitidos: 7
};
