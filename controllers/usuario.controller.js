import bcrypt from 'bcryptjs';
import db from '../config/db.js';

// Listar todos los usuarios (solo admins)
// En usuario.controller.js - método getAllUsers
// En usuario.controller.js - método getAllUsers - CORREGIDO
export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.email, u.id_rol, r.rol, u.activo, 
              u.id_persona, p.nombre_completo
       FROM usuario u
       LEFT JOIN rol r ON u.id_rol = r.id_rol
       LEFT JOIN persona p ON u.id_persona = p.id_persona`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error getAllUsers:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Obtener usuario por id
// En usuario.controller.js - método getUserById - VERIFICAR
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      `SELECT u.id_usuario, u.nombre_usuario, u.email, u.id_rol, r.rol, u.activo, 
              p.id_persona, p.nombre_completo, p.tipo_documento, p.numero_documento,
              p.telefono, p.direccion, p.coordenadas
       FROM usuario u
       LEFT JOIN rol r ON u.id_rol = r.id_rol
       LEFT JOIN persona p ON u.id_persona = p.id_persona
       WHERE u.id_usuario = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(rows[0]);
  } catch (error) {
    console.error('Error getUserById:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Obtener personas disponibles para crear usuario
export const getPersonasDisponibles = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.* 
       FROM persona p
       LEFT JOIN usuario u ON p.id_persona = u.id_persona
       WHERE u.id_usuario IS NULL AND p.activo = 1`
    );
    
    res.json(rows);
  } catch (error) {
    console.error('Error getPersonasDisponibles:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Crear usuario (solo admin)
export const createUser = async (req, res) => {
  try {
    const { nombre_usuario, email, password, id_rol, id_persona } = req.body;
    
    // Validar campos obligatorios
    if (!nombre_usuario || !email || !password || !id_rol || !id_persona) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    // Verificar si la persona existe y está activa
    const [persona] = await db.execute(
      'SELECT id_persona FROM persona WHERE id_persona = ? AND activo = 1',
      [id_persona]
    );

    if (persona.length === 0) {
      return res.status(404).json({ message: 'La persona no existe o está inactiva' });
    }

    // Verificar si la persona ya tiene usuario
    const [existingUserPerson] = await db.execute(
      'SELECT id_usuario FROM usuario WHERE id_persona = ?',
      [id_persona]
    );

    if (existingUserPerson.length > 0) {
      return res.status(400).json({ message: 'La persona ya tiene un usuario asignado' });
    }

    // Verificar si ya existe el usuario o email
    const [existing] = await db.execute(
      'SELECT * FROM usuario WHERE nombre_usuario = ? OR email = ?',
      [nombre_usuario, email]
    );
    if (existing.length > 0) return res.status(409).json({ message: 'Usuario o correo ya registrado' });

    const hashed = await bcrypt.hash(password, 10);

    // Si no se proporcionó id_persona, crear una persona mínima y usar su id
    let personaId = id_persona;
    if (!personaId) {
      // Si el frontend envía un objeto persona con datos, usarlo
      const personaPayload = req.body.persona;
      if (personaPayload) {
        const tipoDocumento = personaPayload.tipo_documento || 'DNI';
        const numeroDocumento = (personaPayload.numero_documento && personaPayload.numero_documento.trim() !== '') ? personaPayload.numero_documento.trim() : null;
        const nombreCompleto = personaPayload.nombre_completo || nombre_usuario;
        const telefono = personaPayload.telefono || null;
        const direccion = personaPayload.direccion || null;
        const coordenadas = personaPayload.coordenadas || null;

        const [pResult] = await db.execute(
          'INSERT INTO persona (tipo_documento, numero_documento, nombre_completo, telefono, direccion, coordenadas, activo) VALUES (?, ?, ?, ?, ?, ?, 1)',
          [tipoDocumento, numeroDocumento, nombreCompleto, telefono, direccion, coordenadas]
        );
        personaId = pResult.insertId;
      } else {
        const nombreCompleto = nombre_usuario; // fallback
        const tipoDocumento = 'DNI';
        // Usar NULL cuando no se dispone de número de documento para evitar duplicados
        const numeroDocumento = null;
        const [pResult] = await db.execute(
          'INSERT INTO persona (tipo_documento, numero_documento, nombre_completo, activo) VALUES (?, ?, ?, 1)',
          [tipoDocumento, numeroDocumento, nombreCompleto]
        );
        personaId = pResult.insertId;
      }
    }

    const [result] = await db.execute(
      'INSERT INTO usuario (nombre_usuario, email, password, id_rol, id_persona, activo) VALUES (?, ?, ?, ?, ?, 1)',
      [nombre_usuario, email, hashed, id_rol, personaId]
    );

    res.status(201).json({ message: 'Usuario creado', id: result.insertId });
  } catch (error) {
    console.error('Error createUser:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Actualizar rol de usuario (solo admin)
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_rol } = req.body;
    if (!id_rol) return res.status(400).json({ message: 'Falta id_rol' });

    const [result] = await db.execute('UPDATE usuario SET id_rol = ? WHERE id_usuario = ?', [id_rol, id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({ message: 'Rol actualizado' });
  } catch (error) {
    console.error('Error updateUserRole:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Activar / Desactivar usuario (solo admin)
export const toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body; // esperar 0 o 1
    if (typeof activo === 'undefined') return res.status(400).json({ message: 'Falta campo activo' });

    const [result] = await db.execute('UPDATE usuario SET activo = ? WHERE id_usuario = ?', [activo ? 1 : 0, id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({ message: activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (error) {
    console.error('Error toggleUserActive:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Cambiar contraseña (admin o el mismo usuario)
export const changeUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'Falta newPassword' });
    // Permisos: solo admin (id_rol = 1) o el propio usuario puede cambiar su contraseña
    const requester = req.user; // provisto por middleware verifyToken
    if (!requester) return res.status(401).json({ message: 'No autenticado' });

    const isAdmin = requester.id_rol === 1;
    const isSelf = Number(requester.id_usuario) === Number(id);
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: 'No tienes permisos para cambiar esta contraseña' });
    }

    // Si no es admin, exigir la contraseña actual para evitar secuestro de sesión
    if (!isAdmin) {
      const { currentPassword } = req.body;
      if (!currentPassword) return res.status(400).json({ message: 'Falta currentPassword' });

      const [rows] = await db.execute('SELECT password FROM usuario WHERE id_usuario = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

      const valid = await bcrypt.compare(currentPassword, rows[0].password);
      if (!valid) return res.status(400).json({ message: 'Contraseña actual incorrecta' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const [result] = await db.execute('UPDATE usuario SET password = ? WHERE id_usuario = ?', [hashed, id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    console.error('Error changeUserPassword:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Eliminar usuario (opcional)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.execute('DELETE FROM usuario WHERE id_usuario = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error deleteUser:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// En usuario.controller.js - agregar este método
// En usuario.controller.js - modificar el método updateUser
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_usuario, email, password, id_rol, id_persona } = req.body;
    
    console.log('Datos recibidos para actualizar:', { nombre_usuario, email, id_rol, id_persona }); // Debug

    // Verificar si el usuario existe
    const [userExists] = await db.execute(
      'SELECT * FROM usuario WHERE id_usuario = ?',
      [id]
    );
    
    if (userExists.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si el nuevo nombre de usuario o email ya existen (excluyendo el usuario actual)
    const [existing] = await db.execute(
      'SELECT * FROM usuario WHERE (nombre_usuario = ? OR email = ?) AND id_usuario != ?',
      [nombre_usuario, email, id]
    );
    
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Usuario o correo ya registrado' });
    }

    // ✅ NUEVA VALIDACIÓN: Verificar que id_persona existe si se proporciona
    if (id_persona !== undefined && id_persona !== null) {
      const [personaExists] = await db.execute(
        'SELECT id_persona FROM persona WHERE id_persona = ? AND activo = 1',
        [id_persona]
      );
      
      if (personaExists.length === 0) {
        return res.status(400).json({ message: 'La persona seleccionada no existe o está inactiva' });
      }

      // ✅ Verificar que la persona no esté asignada a otro usuario (excepto el actual)
      const [personaEnUso] = await db.execute(
        'SELECT id_usuario FROM usuario WHERE id_persona = ? AND id_usuario != ?',
        [id_persona, id]
      );
      
      if (personaEnUso.length > 0) {
        return res.status(400).json({ message: 'La persona ya está asignada a otro usuario' });
      }
    }

    let updateFields = [];
    let updateValues = [];

    // Construir dinámicamente la consulta UPDATE
    if (nombre_usuario !== undefined) {
      updateFields.push('nombre_usuario = ?');
      updateValues.push(nombre_usuario);
    }
    
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    
    if (id_rol !== undefined) {
      updateFields.push('id_rol = ?');
      updateValues.push(id_rol);
    }
    
    if (id_persona !== undefined) {
      updateFields.push('id_persona = ?');
      updateValues.push(id_persona);
    }
    
    // Si se proporciona nueva contraseña, hashearla
    if (password && password.trim() !== '') {
      const hashed = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      updateValues.push(hashed);
    }

    // Agregar fecha de actualización
    updateFields.push('fecha_actualizacion = CURRENT_TIMESTAMP');

    // Agregar el ID al final de los valores
    updateValues.push(id);

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    const query = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id_usuario = ?`;
    console.log('Query ejecutado:', query, updateValues); // Debug
    
    const [result] = await db.execute(query, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error('Error updateUser:', error);
    
    // Mejorar mensaje de error
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ 
        message: 'Error de integridad referencial: La persona seleccionada no existe' 
      });
    }
    
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};


// Al final de usuario.controller.js - VERIFICAR EXPORT
export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserRole,
  toggleUserActive,
  changeUserPassword,
  deleteUser,
  getPersonasDisponibles
};