// backend_dsi6/test-sunat-completo.js
import sunatService from './sunat/sunat.service.js';

async function testServicioCompleto() {
    console.log('🧪 Probando servicio SUNAT completo...');
    
    try {
        // Usa el ID de venta que creaste en el paso 1
        const idVenta = 39; // Cambia esto por el ID real
        
        console.log(`📄 Emitiendo comprobante para venta ${idVenta}...`);
        
        const resultado = await sunatService.emitirComprobante(idVenta);
        
        console.log('🎉 ✅ COMPROBANTE EMITIDO EXITOSAMENTE!');
        console.log('Resultado:', JSON.stringify(resultado, null, 2));
        
    } catch (error) {
        console.error('❌ Error en servicio completo:');
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
        
        // Verificar errores específicos
        if (error.message.includes('Venta no encontrada')) {
            console.error('\n⚠️  Crea una venta pagada primero con:');
            console.error('   id_estado_venta = 7 (Pagado)');
            console.error('   comprobante_emitido = 0');
        }
    }
}

testServicioCompleto();