import express from 'express';
import usuarioController from '../controllers/usuario.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Rutas protegidas - solo admins (rol 1) y módulo 'usuarios'
// Listar todos los usuarios
router.get('/', verifyToken, requireRole([1], 'usuarios'), usuarioController.getAllUsers);

// Obtener personas disponibles para asignar usuario
router.get('/personas-disponibles', verifyToken, requireRole([1]), usuarioController.getPersonasDisponibles);

// Obtener usuario por id (admin o el propio usuario podría llamarlo; aquí admin)
router.get('/:id', verifyToken, requireRole([1]), usuarioController.getUserById);

// Crear usuario (admin)
router.post('/', verifyToken, requireRole([1]), usuarioController.createUser);

// Actualizar rol (admin)
router.patch('/:id/rol', verifyToken, requireRole([1]), usuarioController.updateUserRole);

// Activar / Desactivar (admin)
router.patch('/:id/activo', verifyToken, requireRole([1]), usuarioController.toggleUserActive);

// Cambiar contraseña (admin o el propio usuario)
router.patch('/:id/password', verifyToken, usuarioController.changeUserPassword);

// Eliminar usuario (admin)
router.delete('/:id', verifyToken, requireRole([1]), usuarioController.deleteUser);
// Actualizar usuario completo (admin)
router.patch('/:id', verifyToken, requireRole([1]), usuarioController.updateUser);

export default router;
