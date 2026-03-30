// src/middleware/fecha.middleware.js - CREAR este archivo
export const convertirFechasPeru = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    if (Array.isArray(data)) {
      data = data.map(item => convertirFechasItem(item));
    } else if (data && typeof data === 'object') {
      data = convertirFechasItem(data);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

function convertirFechasItem(item) {
  if (!item || typeof item !== 'object') return item;
  
  // Crear copia del objeto
  const nuevoItem = { ...item };
  
  // Convertir campos de fecha
  if (nuevoItem.fecha && typeof nuevoItem.fecha === 'string') {
    // Si la fecha es '2026-01-15', asegurar que mantenga ese formato
    // (la BD ya almacena en fecha local del servidor que está en Perú)
    // Solo asegurarnos que no tiene problemas de timezone
    if (!nuevoItem.fecha.includes('T')) {
      // Añadir mediodía Perú para evitar problemas
      nuevoItem.fecha = `${nuevoItem.fecha}T12:00:00-05:00`;
    }
  }
  
  // Convertir otros campos de fecha si existen
  ['fecha_creacion', 'fecha_actualizacion', 'fecha_inicio_ruta', 'fecha_fin_ruta'].forEach(campo => {
    if (nuevoItem[campo] && typeof nuevoItem[campo] === 'string') {
      if (!nuevoItem[campo].endsWith('-05:00') && !nuevoItem[campo].endsWith('Z')) {
        nuevoItem[campo] = `${nuevoItem[campo].replace(' ', 'T')}-05:00`;
      }
    }
  });
  
  return nuevoItem;
}
