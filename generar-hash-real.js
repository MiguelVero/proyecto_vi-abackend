// // generar-hash-real.js
// import bcrypt from 'bcryptjs';

// async function generarHashReal() {
//     console.log('🔐 GENERANDO HASH REAL...');
    
//     // Generar hash para admin123
//     const hash = await bcrypt.hash('admin123', 10);
    
//     console.log('✅ HASH GENERADO:');
//     console.log(hash);
    
//     console.log('\n📋 COMANDO SQL:');
//     console.log(`DELETE FROM usuario WHERE nombre_usuario = 'admin';`);
//     console.log(`INSERT INTO usuario (nombre_usuario, email, password, id_rol, id_persona, activo) VALUES ('admin', 'admin@sistemaagua.com', '${hash}', 1, 6, 1);`);
    
//     // Verificar que funciona
//     const esValido = await bcrypt.compare('admin123', hash);
//     console.log('\n🧪 VERIFICACIÓN:', esValido ? '✅ HASH VÁLIDO' : '❌ HASH INVÁLIDO');
// }

// generarHashReal();