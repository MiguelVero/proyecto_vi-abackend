// src/controllers/repartidor.controller.js
import db from '../config/db.js';

// Obtener todos los repartidores
export const getRepartidores = async (req, res) => {
    try {
        const [repartidores] = await db.execute(`
            SELECT 
                r.*,
                p.nombre_completo,
                p.telefono,
                p.numero_documento,
                p.direccion
            FROM repartidor r
            JOIN persona p ON r.id_persona = p.id_persona
            ORDER BY p.nombre_completo ASC
        `);
        
        // Formatear la respuesta para incluir datos de persona
        const repartidoresFormateados = repartidores.map(repartidor => ({
            id_repartidor: repartidor.id_repartidor,
            id_persona: repartidor.id_persona,
            placa_furgon: repartidor.placa_furgon,
            activo: Boolean(repartidor.activo),
            fecha_contratacion: repartidor.fecha_contratacion,
            fecha_creacion: repartidor.fecha_creacion,
            persona: {
                nombre_completo: repartidor.nombre_completo,
                telefono: repartidor.telefono,
                numero_documento: repartidor.numero_documento,
                direccion: repartidor.direccion
            }
        }));
        
        res.json(repartidoresFormateados);
    } catch (error) {
        console.error('Error obteniendo repartidores:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener repartidores activos
export const getRepartidoresActivos = async (req, res) => {
    try {
        const [repartidores] = await db.execute(`
            SELECT 
                r.*,
                p.nombre_completo,
                p.telefono,
                p.numero_documento,
                p.direccion
            FROM repartidor r
            JOIN persona p ON r.id_persona = p.id_persona
            WHERE r.activo = 1
            ORDER BY p.nombre_completo ASC
        `);
        
        const repartidoresFormateados = repartidores.map(repartidor => ({
            id_repartidor: repartidor.id_repartidor,
            id_persona: repartidor.id_persona,
            placa_furgon: repartidor.placa_furgon,
            activo: Boolean(repartidor.activo),
            fecha_contratacion: repartidor.fecha_contratacion,
            fecha_creacion: repartidor.fecha_creacion,
            persona: {
                nombre_completo: repartidor.nombre_completo,
                telefono: repartidor.telefono,
                numero_documento: repartidor.numero_documento,
                direccion: repartidor.direccion
            }
        }));
        
        res.json(repartidoresFormateados);
    } catch (error) {
        console.error('Error obteniendo repartidores activos:', error);
        res.status(500).json({ error: error.message });
    }
};

// Obtener repartidor por ID
export const getRepartidorById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [repartidores] = await db.execute(`
            SELECT 
                r.*,
                p.nombre_completo,
                p.telefono,
                p.numero_documento,
                p.direccion
            FROM repartidor r
            JOIN persona p ON r.id_persona = p.id_persona
            WHERE r.id_repartidor = ?
        `, [id]);

        if (repartidores.length === 0) {
            return res.status(404).json({ error: 'Repartidor no encontrado' });
        }

        const repartidor = repartidores[0];
        const repartidorFormateado = {
            id_repartidor: repartidor.id_repartidor,
            id_persona: repartidor.id_persona,
            placa_furgon: repartidor.placa_furgon,
            activo: Boolean(repartidor.activo),
            fecha_contratacion: repartidor.fecha_contratacion,
            fecha_creacion: repartidor.fecha_creacion,
            persona: {
                nombre_completo: repartidor.nombre_completo,
                telefono: repartidor.telefono,
                numero_documento: repartidor.numero_documento,
                direccion: repartidor.direccion
            }
        };
        
        res.json(repartidorFormateado);
    } catch (error) {
        console.error('Error obteniendo repartidor:', error);
        res.status(500).json({ error: error.message });
    }
};

// Crear nuevo repartidor
export const createRepartidor = async (req, res) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const {
            id_persona,
            placa_furgon,
            activo = true,
            fecha_contratacion = new Date().toISOString().split('T')[0]
        } = req.body;

        // Validaciones
        if (!id_persona) {
            return res.status(400).json({ error: 'ID de persona es requerido' });
        }

        if (!placa_furgon) {
            return res.status(400).json({ error: 'Placa del furgón es requerida' });
        }

        // Verificar si la persona ya es repartidor
        const [existe] = await connection.execute(
            'SELECT id_repartidor FROM repartidor WHERE id_persona = ?',
            [id_persona]
        );

        if (existe.length > 0) {
            return res.status(400).json({ error: 'Esta persona ya está registrada como repartidor' });
        }

        // Insertar repartidor
        const [result] = await connection.execute(`
            INSERT INTO repartidor (id_persona, placa_furgon, activo, fecha_contratacion)
            VALUES (?, ?, ?, ?)
        `, [id_persona, placa_furgon, activo, fecha_contratacion]);

        await connection.commit();

        // Obtener el repartidor creado
        const [nuevoRepartidor] = await db.execute(`
            SELECT 
                r.*,
                p.nombre_completo,
                p.telefono,
                p.numero_documento,
                p.direccion
            FROM repartidor r
            JOIN persona p ON r.id_persona = p.id_persona
            WHERE r.id_repartidor = ?
        `, [result.insertId]);

        const repartidorFormateado = {
            id_repartidor: nuevoRepartidor[0].id_repartidor,
            id_persona: nuevoRepartidor[0].id_persona,
            placa_furgon: nuevoRepartidor[0].placa_furgon,
            activo: Boolean(nuevoRepartidor[0].activo),
            fecha_contratacion: nuevoRepartidor[0].fecha_contratacion,
            fecha_creacion: nuevoRepartidor[0].fecha_creacion,
            persona: {
                nombre_completo: nuevoRepartidor[0].nombre_completo,
                telefono: nuevoRepartidor[0].telefono,
                numero_documento: nuevoRepartidor[0].numero_documento,
                direccion: nuevoRepartidor[0].direccion
            }
        };

        res.status(201).json(repartidorFormateado);

    } catch (error) {
        await connection.rollback();
        console.error('Error creando repartidor:', error);
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// Actualizar repartidor
export const updateRepartidor = async (req, res) => {
    try {
        const { id } = req.params;
        const { placa_furgon, activo, fecha_contratacion } = req.body;

        const campos = [];
        const valores = [];

        if (placa_furgon !== undefined) {
            campos.push('placa_furgon = ?');
            valores.push(placa_furgon);
        }

        if (activo !== undefined) {
            campos.push('activo = ?');
            valores.push(activo);
        }

        if (fecha_contratacion !== undefined) {
            campos.push('fecha_contratacion = ?');
            valores.push(fecha_contratacion);
        }

        if (campos.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        valores.push(id);

        const [result] = await db.execute(`
            UPDATE repartidor 
            SET ${campos.join(', ')} 
            WHERE id_repartidor = ?
        `, valores);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Repartidor no encontrado' });
        }

        // Obtener repartidor actualizado
        const [repartidorActualizado] = await db.execute(`
            SELECT 
                r.*,
                p.nombre_completo,
                p.telefono,
                p.numero_documento,
                p.direccion
            FROM repartidor r
            JOIN persona p ON r.id_persona = p.id_persona
            WHERE r.id_repartidor = ?
        `, [id]);

        const repartidorFormateado = {
            id_repartidor: repartidorActualizado[0].id_repartidor,
            id_persona: repartidorActualizado[0].id_persona,
            placa_furgon: repartidorActualizado[0].placa_furgon,
            activo: Boolean(repartidorActualizado[0].activo),
            fecha_contratacion: repartidorActualizado[0].fecha_contratacion,
            fecha_creacion: repartidorActualizado[0].fecha_creacion,
            persona: {
                nombre_completo: repartidorActualizado[0].nombre_completo,
                telefono: repartidorActualizado[0].telefono,
                numero_documento: repartidorActualizado[0].numero_documento,
                direccion: repartidorActualizado[0].direccion
            }
        };

        res.json(repartidorFormateado);

    } catch (error) {
        console.error('Error actualizando repartidor:', error);
        res.status(500).json({ error: error.message });
    }
};

// Desactivar repartidor
export const desactivarRepartidor = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.execute(`
            UPDATE repartidor 
            SET activo = 0 
            WHERE id_repartidor = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Repartidor no encontrado' });
        }

        res.json({ message: 'Repartidor desactivado correctamente' });

    } catch (error) {
        console.error('Error desactivando repartidor:', error);
        res.status(500).json({ error: error.message });
    }
};

// Activar repartidor
export const activarRepartidor = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.execute(`
            UPDATE repartidor 
            SET activo = 1 
            WHERE id_repartidor = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Repartidor no encontrado' });
        }

        res.json({ message: 'Repartidor activado correctamente' });

    } catch (error) {
        console.error('Error activando repartidor:', error);
        res.status(500).json({ error: error.message });
    }
};

// Eliminar repartidor
export const deleteRepartidor = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si el repartidor tiene ventas asociadas
        const [ventas] = await db.execute(
            'SELECT id_venta FROM venta WHERE id_repartidor = ?',
            [id]
        );

        if (ventas.length > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar el repartidor porque tiene ventas asociadas' 
            });
        }

        const [result] = await db.execute(
            'DELETE FROM repartidor WHERE id_repartidor = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Repartidor no encontrado' });
        }

        res.json({ message: 'Repartidor eliminado correctamente' });

    } catch (error) {
        console.error('Error eliminando repartidor:', error);
        res.status(500).json({ error: error.message });
    }
};