// src/routes/persona.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import {
    getAllPersonas,
    getPersonaById,
    createPersona,
    updatePersona,
    deletePersona,
    searchPersonas
} from "../controllers/persona.controller.js";

const router = express.Router();

// Aplicar autenticación a todas las rutas excepto búsqueda y consulta
router.get('/search', searchPersonas);
router.get('/', getAllPersonas);
router.get('/:id', getPersonaById);

// Rutas protegidas
router.post('/', verifyToken, requireRole([1]), createPersona);
router.put('/:id', verifyToken, requireRole([1]), updatePersona);
router.delete('/:id', verifyToken, requireRole([1]), deletePersona);

export default router;