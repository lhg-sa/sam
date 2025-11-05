// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Programa Social y Evento", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('Programa Social y Evento', {
    onload: function(frm) {
        // Make doc_link, cui_beneficiario, and customer_name fields in child table read-only
        let child_table_fields = ['doc_link', 'cui_beneficiario', 'customer_name'];
        child_table_fields.forEach(fieldname => {
            let field = frm.fields_dict['programa_afiliado'].grid.get_field(fieldname);
            if(field) {
                field.df.read_only = 1;
            }
        });
    }
});

frappe.ui.form.on('Programa Social y Evento Detalle', {
    // Triggered when a new row is added to the child table
    programa_afiliado_add: function(frm, cdt, cdn) {
        let child = frappe.get_doc(cdt, cdn);
        // Set the doc_link to the parent document's name
        child.doc_link = frm.doc.name;
        // Refresh the child table to reflect changes
        frm.refresh_field('programa_afiliado');
    }
});
