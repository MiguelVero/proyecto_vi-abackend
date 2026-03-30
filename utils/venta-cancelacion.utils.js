// src/utils/venta-cancelacion.utils.js
import db from '../config/db.js';

/**
 * Cancela una venta y restaura el stock
 * @param {number} id_venta - ID de la venta a cancelar
 * @param {number} id_usuario - ID del usuario que cancela
 * @param {string} motivo - Motivo de la cancelación
 * @param {object} connection - Conexión a BD (para transacciones)
 * @returns {Promise<object>} Resultado de la cancelación
 */
export const cancelarVentaConStock = async (id_venta, id_usuario, motivo, connection) => {
    try {
        // Obtener detalles de la venta con lotes
        const [detallesLotes] = await connection.execute(`
            SELECT 
                vd.id_producto,
                vdl.id_lote,
                vdl.cantidad,
                lp.numero_lote,
                lp.cantidad_actual as stock_actual_lote,
                p.stock as stock_actual_producto,
                p.nombre as nombre_producto
            FROM venta_detalle vd
            JOIN venta_detalle_lote vdl ON vd.id_detalle = vdl.id_detalle_venta
            JOIN lote_producto lp ON vdl.id_lote = lp.id_lote
            JOIN producto p ON vd.id_producto = p.id_producto
            WHERE vd.id_venta = ?
        `, [id_venta]);

        if (detallesLotes.length === 0) {
            throw new Error('No se encontraron detalles de la venta');
        }

        console.log(`📦 Restaurando stock para venta #${id_venta}:`, detallesLotes.length, 'lotes');

        // Restaurar stock de cada lote y crear movimientos
        for (const detalle of detallesLotes) {
            // 1. Restaurar stock del lote
            await connection.execute(`
                UPDATE lote_producto 
                SET cantidad_actual = cantidad_actual + ? 
                WHERE id_lote = ?
            `, [detalle.cantidad, detalle.id_lote]);

            // 2. Restaurar stock del producto
            await connection.execute(`
                UPDATE producto 
                SET stock = stock + ? 
                WHERE id_producto = ?
            `, [detalle.cantidad, detalle.id_producto]);

            // 3. Registrar movimiento de devolución
            await connection.execute(`
                INSERT INTO movimiento_stock 
                (id_producto, tipo_movimiento, cantidad, descripcion, id_usuario, id_lote, fecha) 
                VALUES (?, 'devolucion', ?, ?, ?, ?, NOW())
            `, [
                detalle.id_producto,
                detalle.cantidad,
                `Devolución por cancelación de venta #${id_venta} - ${motivo || 'Sin motivo'} - Lote ${detalle.numero_lote}`,
                id_usuario,
                detalle.id_lote
            ]);

            console.log(`✅ Stock restaurado: ${detalle.cantidad} unidades de ${detalle.nombre_producto} al lote ${detalle.numero_lote}`);
        }

        // 4. Actualizar estado de la venta
        await connection.execute(`
            UPDATE venta 
            SET id_estado_venta = 8, 
                notas = CONCAT(COALESCE(notas, ''), ' CANCELACIÓN: ', ?),
                fecha_actualizacion = NOW()
            WHERE id_venta = ?
        `, [motivo || 'Cancelación manual', id_venta]);

        return {
            success: true,
            message: `Venta #${id_venta} cancelada correctamente`,
            lotes_restaurados: detallesLotes.length,
            detalles: detallesLotes
        };

    } catch (error) {
        console.error('Error en cancelarVentaConStock:', error);
        throw error;
    }
};