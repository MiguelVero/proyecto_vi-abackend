import db from "../config/db.js";

// Obtener todas las personas
export const getAllPersonas = async (req, res) => {
    try {
        const query = 'SELECT * FROM persona WHERE activo = 1';
        const [personas] = await db.query(query);
        res.json(personas);
    } catch (error) {
        console.error('Error al obtener personas:', error);
        res.status(500).json({ message: "Error al obtener las personas" });
    }
};

// Obtener una persona por ID
export const getPersonaById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = 'SELECT * FROM persona WHERE id_persona = ?';
        const [persona] = await db.query(query, [id]);

        if (persona.length === 0) {
            return res.status(404).json({ message: "Persona no encontrada" });
        }

        res.json(persona[0]);
    } catch (error) {
        console.error('Error al obtener la persona:', error);
        res.status(500).json({ message: "Error al obtener la persona" });
    }
};

// Crear una nueva persona
export const createPersona = async (req, res) => {
    try {
        const { 
            tipo_documento, 
            numero_documento, 
            nombre_completo, 
            telefono, 
            direccion, 
            coordenadas 
        } = req.body;

        // Verificar si ya existe una persona con el mismo número de documento
        const [existingPerson] = await db.query(
            'SELECT id_persona FROM persona WHERE numero_documento = ?',
            [numero_documento]
        );

        if (existingPerson.length > 0) {
            return res.status(400).json({ 
                message: "Ya existe una persona con este número de documento" 
            });
        }

        const query = `
            INSERT INTO persona (
                tipo_documento, 
                numero_documento, 
                nombre_completo, 
                telefono, 
                direccion, 
                coordenadas
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(query, [
            tipo_documento,
            numero_documento,
            nombre_completo,
            telefono,
            direccion,
            coordenadas
        ]);

        res.status(201).json({ 
            id_persona: result.insertId,
            message: "Persona creada exitosamente" 
        });
    } catch (error) {
        console.error('Error al crear la persona:', error);
        res.status(500).json({ message: "Error al crear la persona" });
    }
};

// Actualizar una persona
export const updatePersona = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            tipo_documento, 
            numero_documento, 
            nombre_completo, 
            telefono, 
            direccion, 
            coordenadas 
        } = req.body;

        // Verificar si existe la persona
        const [existingPerson] = await db.query(
            'SELECT id_persona FROM persona WHERE id_persona = ?',
            [id]
        );

        if (existingPerson.length === 0) {
            return res.status(404).json({ message: "Persona no encontrada" });
        }

        // Verificar si el nuevo número de documento ya existe en otra persona
        if (numero_documento) {
            const [duplicateDoc] = await db.query(
                'SELECT id_persona FROM persona WHERE numero_documento = ? AND id_persona != ?',
                [numero_documento, id]
            );

            if (duplicateDoc.length > 0) {
                return res.status(400).json({ 
                    message: "El número de documento ya está en uso por otra persona" 
                });
            }
        }

        const query = `
            UPDATE persona 
            SET tipo_documento = ?,
                numero_documento = ?,
                nombre_completo = ?,
                telefono = ?,
                direccion = ?,
                coordenadas = ?
            WHERE id_persona = ?
        `;

        await db.query(query, [
            tipo_documento,
            numero_documento,
            nombre_completo,
            telefono,
            direccion,
            coordenadas,
            id
        ]);

        res.json({ message: "Persona actualizada exitosamente" });
    } catch (error) {
        console.error('Error al actualizar la persona:', error);
        res.status(500).json({ message: "Error al actualizar la persona" });
    }
};

// Eliminar una persona (desactivar)
export const deletePersona = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar si existe la persona
        const [persona] = await db.query(
            'SELECT id_persona FROM persona WHERE id_persona = ?',
            [id]
        );

        if (persona.length === 0) {
            return res.status(404).json({ message: "Persona no encontrada" });
        }

        // Desactivar la persona en lugar de eliminarla
        const query = 'UPDATE persona SET activo = 0 WHERE id_persona = ?';
        await db.query(query, [id]);

        res.json({ message: "Persona eliminada exitosamente" });
    } catch (error) {
        console.error('Error al eliminar la persona:', error);
        res.status(500).json({ message: "Error al eliminar la persona" });
    }
};

// Buscar personas por número de documento o nombre
export const searchPersonas = async (req, res) => {
    try {
        const { term } = req.query;
        
        const query = `
            SELECT * FROM persona 
            WHERE (numero_documento LIKE ? OR nombre_completo LIKE ?) 
            AND activo = 1
        `;
        
        const [personas] = await db.query(query, [`%${term}%`, `%${term}%`]);
        
        res.json(personas);
    } catch (error) {
        console.error('Error al buscar personas:', error);
        res.status(500).json({ message: "Error al buscar personas" });
    }
};

