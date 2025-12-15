// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Estudio Socio Economico", {
// 	refresh(frm) {

// 	},
// });
// Script for parent doctype: Estudio Socio Economico (Actualizado)
frappe.ui.form.on('Estudio Socio Economico', {
    onload: function(frm) {
        // Disable total fields so user can't edit them
        frm.set_df_property('total_ingresos', 'read_only', 1);
        frm.set_df_property('total_gastos', 'read_only', 1);
        frm.set_df_property('diferencia_ingreso_gasto', 'read_only', 1); // 🔹 Nuevo

        style_cui_dpi_label(frm);
        lock_cui_dpi_if_saved(frm);
        focus_cui_dpi(frm);
    },

    cui_dpi: function(frm) {
        // Check if the field exists
        if (!frm.fields_dict['cui_dpi']) {
            frappe.msgprint({
                title: __('Campo no encontrado'),
                message: __('El campo "cui_dpi" no existe en este documento.'),
                indicator: 'red'
            });
            return; // Stop execution if field does not exist
        }

        let search_value = frm.doc.cui_dpi;
        if (!search_value) return; // Exit if empty

        // Check for duplicates
        frappe.db.get_list('Estudio Socio Economico', {
            filters: { cui_dpi: search_value },
            fields: ['cui_dpi'],
            limit: 1
        }).then(records => {
            if (records.length > 0) {
                frappe.show_alert({
                    message: `El registro ya existe con Id "${search_value}" y NO podrá agregarlo!`,
                    indicator: 'red'
                });
            } else {
                frappe.show_alert({
                    message: `El registro con Id "${search_value}". No existe y SI puede ser agregado!`,
                    indicator: 'green'
                });
            }
        });
    },

    turno_ticket: function(frm) {
        if (frm.doc.turno_ticket) {
            frappe.model.set_value(frm.doc.doctype, frm.doc.name, 'turno_ticket', frm.doc.turno_ticket.toUpperCase());
        }
    },

    refresh: function(frm) {
        // Recalculate on load/refresh
        calculate_total_ingresos(frm);
        calculate_total_gastos(frm);
        calculate_diferencia(frm); // 🔹 Nuevo

        // Ensure fields remain read-only
        frm.set_df_property('total_ingresos', 'read_only', 1);
        frm.set_df_property('total_gastos', 'read_only', 1);
        frm.set_df_property('diferencia_ingreso_gasto', 'read_only', 1);

        // Add "Guardar y Crear" button
        add_save_and_new_button(frm);

        style_cui_dpi_label(frm);
        lock_cui_dpi_if_saved(frm);
        focus_cui_dpi(frm);
    }
});

// Script for child doctype: Estudio Socio Economico Ingreso Familia
frappe.ui.form.on('Estudio Socio Economico Ingreso Familia', {
    nombre_apellido: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.nombre_apellido) {
            frappe.model.set_value(cdt, cdn, 'nombre_apellido', row.nombre_apellido.toUpperCase());
        }
    },
    ocupacion: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.ocupacion) {
            frappe.model.set_value(cdt, cdn, 'ocupacion', row.ocupacion.toUpperCase());
        }
    },
    aporte_mensual: function(frm, cdt, cdn) {
        calculate_total_ingresos(frm);
        calculate_diferencia(frm); // 🔹 Nuevo
    },
    tabla_ingresos_add: function(frm) {
        calculate_total_ingresos(frm);
        calculate_diferencia(frm); // 🔹 Nuevo
    },
    tabla_ingresos_remove: function(frm) {
        calculate_total_ingresos(frm);
        calculate_diferencia(frm); // 🔹 Nuevo
    }
});

// Script for child doctype: Estudio Socio Economico Gasto Familia
frappe.ui.form.on('Estudio Socio Economico Gasto Familia', {
    monto_gasto: function(frm, cdt, cdn) {
        calculate_total_gastos(frm);
        calculate_diferencia(frm); // 🔹 Nuevo
    },
    tabla_gastos_add: function(frm) {
        calculate_total_gastos(frm);
        calculate_diferencia(frm); // 🔹 Nuevo
    },
    tabla_gastos_remove: function(frm) {
        calculate_total_gastos(frm);
        calculate_diferencia(frm); // 🔹 Nuevo
    }
});

// -------------------- Helper Functions --------------------

// Add "Guardar y Crear" button
function add_save_and_new_button(frm) {
    // Remove previous button to avoid duplicates
    frm.remove_custom_button(__('Guardar y Crear'));
    
    // Add the button
    frm.add_custom_button(__('Guardar y Crear'), function() {
        frm.save().then(() => {
            frappe.show_alert({
                message: __('Registro guardado exitosamente'),
                indicator: 'green'
            });
            
            // Wait a moment for the alert to be visible
            setTimeout(() => {
                frappe.new_doc('Estudio Socio Economico');
            }, 500);
        }).catch(err => {
            frappe.msgprint({
                title: __('Error al guardar'),
                message: err.message || __('Ocurrió un error al guardar el registro'),
                indicator: 'red'
            });
        });
    }).addClass('btn-primary');
}

// Sum aportes in tabla_ingresos → total_ingresos
function calculate_total_ingresos(frm) {
    let total = 0;
    (frm.doc.tabla_ingresos || []).forEach(row => {
        total += flt(row.aporte_mensual);
    });
    frm.set_value('total_ingresos', total);
}

// Sum gastos in tabla_gastos → total_gastos
function calculate_total_gastos(frm) {
    let total = 0;
    (frm.doc.tabla_gastos || []).forEach(row => {
        total += flt(row.monto_gasto);
    });
    frm.set_value('total_gastos', total);
}

// 🔹 Nuevo: Calcular diferencia entre ingresos y gastos
function calculate_diferencia(frm) {
    let ingresos = flt(frm.doc.total_ingresos) || 0;
    let gastos = flt(frm.doc.total_gastos) || 0;
    frm.set_value('diferencia_ingreso_gasto', ingresos - gastos);
}

// Apply custom styling to cui_dpi label
function style_cui_dpi_label(frm) {
    const field = frm.get_field('cui_dpi');
    if (!field || !field.$wrapper) {
        return;
    }

    const label = field.$wrapper.find('.control-label');
    const input = field.$input || field.$wrapper.find('input');

    if (label.length) {
        label.css({
            color: '#0d6efd',
            padding: '2px 6px',
            'font-size': '18px',
            display: 'inline-block',
            width: '100%',
            'text-align': 'center'
        });
    }

    if (input && input.length) {
        input.css({
            border: '2px solid #dc3545',
            'text-align': 'center',
            'font-weight': 'bold',
            'border-radius': '4px'
        });

        // Center the field block itself
        input.closest('.control-input').css({
            display: 'flex',
            'justify-content': 'center'
        });
    }

    field.$wrapper.css({
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center'
    });
}

function focus_cui_dpi(frm) {
    const field = frm.get_field('cui_dpi');
    if (!field) {
        return;
    }

    const input = field.$input || field.$wrapper.find('input');
    if (!input || !input.length) {
        return;
    }

    setTimeout(() => {
        input[0].focus();
    }, 0);
}

function lock_cui_dpi_if_saved(frm) {
    const should_lock = !frm.doc.__islocal && frm.doc.name;
    frm.set_df_property('cui_dpi', 'read_only', should_lock ? 1 : 0);
}
