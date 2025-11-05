// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Inscripcion de Programa", {
// 	refresh(frm) {

// 	},
// });
// Función helper para mensajes en la parte superior
function top_message(msg, type='success') {
    let color_map = {
        'success': '#28a745',   // verde
        'warning': '#ff9800',   // naranja
        'error': '#dc3545'      // rojo
    };
    let color = color_map[type] || '#28a745';

    let wrapper = $('<div>')
        .text(msg)
        .css({
            position: 'fixed',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            'background-color': color,
            color: 'white',
            padding: '10px 20px',
            'border-radius': '5px',
            'z-index': 9999,
            'box-shadow': '0px 2px 10px rgba(0,0,0,0.3)',
            'font-weight': 'bold'
        });
    $('body').append(wrapper);
    setTimeout(() => { wrapper.fadeOut(500, () => wrapper.remove()); }, 2000); // 2 segundos
}

frappe.ui.form.on("Inscripcion de Programa", {
    cui_dpi: function(frm) {
        if (!frm.doc.cui_dpi || frm.doc.cui_dpi.length !== 13 || !/^\d{13}$/.test(frm.doc.cui_dpi)) return;

        let parent_doc = frm.doc.programa_o_evento;

        if (!parent_doc) {
            top_message(__('❌ Por favor seleccione un Programa o Evento antes de continuar.'), 'error');
            frm.set_value('cui_dpi', '');
            return;
        }

        frappe.db.get_value("Customer", { "custom_cui__dpi": frm.doc.cui_dpi }, ["name", "customer_name"])
        .then(r => {
            if (!r || !r.message || !r.message.name) {
                top_message(__('❌ Customer no encontrado'), 'error');
                frm.set_value('cui_dpi', '');
                return;
            }

            let customer_id = r.message.name;
            let customer_name = r.message.customer_name || '';
            let cui_dpi = frm.doc.cui_dpi;

            top_message(__('✅ Customer encontrado: ' + customer_id), 'success');

            frappe.db.get_doc("Programa Social y Evento", parent_doc)
            .then(doc => {
                let exists = doc.programa_afiliado.some(d => d.beneficiario_id === customer_id);
                if (exists) {
                    top_message(__('⚠️ Este beneficiario ya está inscrito en este programa.'), 'warning');
                    frm.set_value('cui_dpi', '');
                    return;
                }

                let row = frappe.model.add_child(doc, "Programa Social y Evento Detalle", "programa_afiliado");
                row.beneficiario_id = customer_id;
                row.customer_name = customer_name;
                row.cui_beneficiario = cui_dpi;
                row.name = parent_doc + "-" + customer_id;
                row.doc_link = frm.doc.name;

                frappe.call({
                    method: "frappe.client.save",
                    args: { doc: doc },
                    callback: function(save_res) {
                        if (!save_res.exc) {
                            top_message(__('🎉 Registro agregado correctamente: ' + row.name), 'success');
                            frm.reload_doc();

                            if (frm.fields_dict.html_inscripcion) {
                                let rows = doc.programa_afiliado.slice(-5);
                                let html = `
                                    <table class="table table-bordered table-sm">
                                        <thead>
                                            <tr>
                                                <th>CUI Beneficiario</th>
                                                <th>Nombre</th>
                                                <th>Fecha Registro</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                `;
                                rows.forEach(r => {
                                    html += `<tr>
                                                <td>${r.cui_beneficiario || ''}</td>
                                                <td>${r.customer_name || ''}</td>
                                                <td>${frappe.datetime.str_to_user(r.creation || frappe.datetime.now_datetime())}</td>
                                            </tr>`;
                                });
                                html += `</tbody></table>`;
                                frm.fields_dict.html_inscripcion.$wrapper.html(html);
                            }

                        } else {
                            top_message(__('❌ Error al guardar el Programa con el nuevo beneficiario'), 'error');
                        }
                    }
                });
            });

            frm.set_value('cui_dpi', '');
        });
    }
});

