// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("PMT Boleta", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('PMT Boleta', {
    boleta_id: function(frm) {
        if (frm.doc.boleta_id) {
            frappe.call({
                method: 'sam.sam.pmt_utils.obtener_datos_boleta',
                args: { boleta_id: frm.doc.boleta_id }
            }).then(r => {
                if (r.message) {
                    const { estado_boleta, agente_asignado_detalle, talonario_id } = r.message;

                    // Mostrar mensaje
                    //frappe.msgprint(`
                    //    Estado: ${estado_boleta || 'N/A'}<br>
                    //    Agente: ${agente_asignado_detalle || 'N/A'}<br>
                    //    Talonario ID: ${talonario_id || 'N/A'}
                    //`, 'Datos de Boleta');

                    // Asignar valores a campos del formulario principal
                    frm.set_value('estado_boleta', estado_boleta || '');
                    frm.set_value('agente', agente_asignado_detalle || '');
                }
            });
        }
    }
});
