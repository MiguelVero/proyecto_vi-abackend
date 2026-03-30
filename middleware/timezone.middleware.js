// middleware/timezone.middleware.js
export const forcePeruTimezone = (req, res, next) => {
  // Forzar zona horaria Perú en todas las respuestas
  req.timezone = 'America/Lima';
  next();
};

// En tu app.js
app.use(forcePeruTimezone);