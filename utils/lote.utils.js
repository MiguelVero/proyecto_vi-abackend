// src/utils/lote.utils.js
import db from "../config/db.js";

/**
 * Verifica si un lote debe ser desactivado y lo desactiva si es necesario
 * @param {number} id_lote - ID del lote a verificar
 * @param {object} connection - Conexión de base de datos (para transacciones)
 * @returns {Promise<boolean>} - true si se desactivó, false si no
 */
export const desactivarLoteSiEsNecesario = async (id_lote, connection) => {
  try {
    // Usar la conexión proporcionada o crear una nueva
    const conn = connection || await db.getConnection();
    
    // Obtener estado actual del lote
    const [lote] = await conn.query(
      'SELECT cantidad_actual, activo FROM lote_producto WHERE id_lote = ?',
      [id_lote]
    );
    
    if (lote.length === 0) return false;
    
    // Si cantidad_actual = 0 y está activo, desactivarlo
    if (lote[0].cantidad_actual === 0 && lote[0].activo === 1) {
      await conn.query(
        'UPDATE lote_producto SET activo = 0 WHERE id_lote = ?',
        [id_lote]
      );
      console.log(`✅ Lote #${id_lote} desactivado automáticamente (stock agotado)`);
      
      if (!connection) conn.release();
      return true;
    }
    
    if (!connection) conn.release();
    return false;
  } catch (error) {
    console.error(`Error al desactivar lote #${id_lote}:`, error);
    return false;
  }
};

/**
 * Desactiva todos los lotes agotados (para mantenimiento)
 * @param {object} connection - Conexión de base de datos (opcional)
 * @returns {Promise<number>} - Número de lotes desactivados
 */
export const desactivarTodosLosLotesAgotados = async (connection) => {
  try {
    const conn = connection || await db.getConnection();
    
    const [result] = await conn.query(`
      UPDATE lote_producto 
      SET activo = 0 
      WHERE cantidad_actual = 0 AND activo = 1
    `);
    
    if (!connection) conn.release();
    
    console.log(`✅ ${result.affectedRows} lotes agotados desactivados`);
    return result.affectedRows;
  } catch (error) {
    console.error('Error al desactivar lotes agotados:', error);
    return 0;
  }
};