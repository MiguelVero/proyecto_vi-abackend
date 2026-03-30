// src/routes/repartidor.routes.js
import express from 'express';
import {
    getRepartidores,
    getRepartidoresActivos,
    getRepartidorById,
    createRepartidor,
    updateRepartidor,
    desactivarRepartidor,
    activarRepartidor,
    deleteRepartidor
} from '../controllers/repartidor.controller.js';

const router = express.Router();

// Rutas para repartidores
router.get('/', getRepartidores);
router.get('/activos', getRepartidoresActivos);
router.get('/:id', getRepartidorById);
router.post('/', createRepartidor);
router.put('/:id', updateRepartidor);
router.patch('/:id/desactivar', desactivarRepartidor);
router.patch('/:id/activar', activarRepartidor);
router.delete('/:id', deleteRepartidor);

export default router;