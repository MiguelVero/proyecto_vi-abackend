// routes/test.routes.js
import express from 'express';
const router = express.Router();

router.get('/fecha-test', (req, res) => {
  const ahora = new Date();
  const offsetPeru = -5 * 60;
  const fechaPeru = new Date(ahora.getTime() + offsetPeru * 60 * 1000);
  
  res.json({
    serverTime: ahora.toString(),
    serverISO: ahora.toISOString(),
    peruTime: fechaPeru.toString(),
    peruDate: fechaPeru.getUTCDate(),
    peruMonth: fechaPeru.getUTCMonth() + 1,
    peruYear: fechaPeru.getUTCFullYear(),
    peruHours: fechaPeru.getUTCHours(),
    peruMinutes: fechaPeru.getUTCMinutes(),
    formattedDate: `${fechaPeru.getUTCFullYear()}-${(fechaPeru.getUTCMonth() + 1).toString().padStart(2, '0')}-${fechaPeru.getUTCDate().toString().padStart(2, '0')}`,
    formattedTime: `${fechaPeru.getUTCHours().toString().padStart(2, '0')}:${fechaPeru.getUTCMinutes().toString().padStart(2, '0')}:${fechaPeru.getUTCSeconds().toString().padStart(2, '0')}`,
    timezone: process.env.TZ || 'No configurado'
  });
});

export default router;