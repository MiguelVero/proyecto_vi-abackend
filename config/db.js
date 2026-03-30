// src/config/db.js - VERSIÓN CORREGIDA
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// FORZAR ZONA HORIA AMÉRICA/LIMA EN TODO EL POOL
const db = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST, // Railway usa MYSQLHOST
  user: process.env.MYSQLUSER || process.env.DB_USER,
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
  database: process.env.MYSQLDATABASE || process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'SYSTEM', // Usar la del sistema
  charset: 'utf8mb4',
  dateStrings: true,
  // Agregar opción para manejar fechas consistentemente
  typeCast: function (field, next) {
    if (field.type === 'DATE') {
      return field.string();
    }
    if (field.type === 'DATETIME' || field.type === 'TIMESTAMP') {
      return field.string();
    }
    return next();
  }
});

// Configurar zona horaria explícita para cada conexión
db.on('connection', (connection) => {
  connection.query("SET time_zone = '-05:00'");
  connection.query("SET @@session.time_zone = '-05:00'");
});

// Test de conexión con hora
db.getConnection().then(conn => {
  conn.query("SELECT NOW() as ahora, @@session.time_zone as tz").then(([rows]) => {
    console.log('🕐 MySQL Configurado:', rows[0]);
    conn.release();
  }).catch(err => {
    console.error('Error test MySQL:', err);
  });
});

export default db;