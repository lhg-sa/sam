// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("PMT Boleta", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('PMT Boleta', {
    refresh: function(frm) {
        // Cambiar tamaño de letra del campo (input)
       $(frm.fields_dict.boleta_id.wrapper).find('input').css({
            'font-size': '26px',
            'text-align': 'center',
            'border': '2px solid red',        // ← ¡Aquí va el borde!
            'border-radius': '6px',           // opcional: bordes redondeados
            'padding': '8px'                  // opcional: más espacio interno
        });        

        // Cambiar color de la ETIQUETA a rojo
          $(frm.fields_dict.boleta_id.label_area).css({
            'color': 'red',
            'text-align': 'center',
            'width': '100%',
            'font-size': '20px',
            'font-weight': 'bold'  // opcional: para hacerla más visible
        });
    },

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
