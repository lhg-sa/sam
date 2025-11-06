// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

frappe.ui.form.on("PMT Boleta", {
    refresh: function(frm) {
        // === Estilo para el campo 'boleta_id' (input) ===
        $(frm.fields_dict.boleta_id.wrapper).find('input').css({
            'font-size': '26px',
            'text-align': 'center',
            'border': '2px solid red',
            'border-radius': '6px',
            'padding': '8px'
        });

        // Estilo para la etiqueta (label) de 'boleta_id'
        $(frm.fields_dict.boleta_id.label_area).css({
            'color': 'green',
            'text-align': 'center',
            'width': '100%',
            'font-size': '20px',
            'font-weight': 'bold'
        });

        // === Centrar el campo SELECT 'estado_boleta' ===
        $(frm.fields_dict.estado_boleta.wrapper).find('select').css({
            'text-align': 'center',
            'text-align-last': 'center',
            '-moz-text-align-last': 'center',
            'font-size': '10px',
            'border': '2px solid green',
            'border-radius': '6px',
            'padding': '6px'
        });

        // Estilo para la etiqueta (label) de 'estado_boleta'
        $(frm.fields_dict.estado_boleta.label_area).css({
            'color': 'green',
            'text-align': 'center',
            'width': '100%',
            'font-size': '12px',
            'font-weight': 'bold'
        });

        // === Agregar borde azul a la columna que comienza en 'column_break_mvvo' ===
        const colBreak = frm.fields_dict.column_break_mvvo?.wrapper;
        if (colBreak) {
            const columnContainer = $(colBreak).closest('.form-column');
            if (columnContainer.length) {
                columnContainer.css({
                    'border-left': '3px solid green',
                    'padding-left': '15px',
                    'padding-right': '15px',
                    'border-radius': '4px'
                });
            }
        }

        // Add "Guardar y Crear Nueva" button only for new documents
        if (frm.is_new()) {
            frm.page.add_inner_button(__('Guardar y Crear Nueva'), function() {
                frm.save(null, null, () => {
                    frappe.new_doc('PMT Boleta');
                });
            });
        }

        // === Establecer fecha de ayer en 'fecha_infraccion' (solo en documentos nuevos y si está vacío) ===
        if (frm.is_new() && !frm.doc.fecha_infraccion) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const yyyy = yesterday.getFullYear();
            const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
            const dd = String(yesterday.getDate()).padStart(2, '0');

            frm.set_value('fecha_infraccion', `${yyyy}-${mm}-${dd}`);
        }
        
        // Check estado_boleta to set fields as read-only
        toggleFieldsBasedOnEstadoBoleta(frm);
    },

    // 🔁 Se ejecuta cuando cambia "fecha_infraccion"
    fecha_infraccion: function(frm) {
        if (frm.doc.fecha_infraccion) {
            const startDate = frappe.datetime.str_to_obj(frm.doc.fecha_infraccion);
            const dueDate = addBusinessDays(startDate, 5);
            frm.set_value('fecha_infraccion_descuento', frappe.datetime.obj_to_str(dueDate));
        } else {
            // Si se borra la fecha, limpiar el campo de descuento
            frm.set_value('fecha_infraccion_descuento', '');
        }
    },

    boleta_id: function(frm) {
        if (frm.doc.boleta_id) {
            frappe.call({
                method: 'sam.sam.pmt_utils.obtener_datos_boleta',
                args: { boleta_id: frm.doc.boleta_id }
            }).then(r => {
                if (r.message) {
                    const { estado_boleta, agente_asignado_detalle, talonario_id } = r.message;
                    frm.set_value('estado_boleta', estado_boleta || '');
                    frm.set_value('agente', agente_asignado_detalle || '');
                    // Set focus to vehiculo_id field when search returns valid data
                    frm.fields_dict.vehiculo_id?.df.fieldname && frm.fields_dict.vehiculo_id.$input?.focus();
                }
            });
        }
    },

    // Add focus change to cui field when vehiculo_id changes
    vehiculo_id: function(frm) {
        // Set focus to cui field when vehiculo_id value changes
        frm.fields_dict.cui?.df.fieldname && frm.fields_dict.cui.$input?.focus();
    },

    // Add focus change to articulo_codigo field when cui changes
    cui: function(frm) {
        // Set focus to articulo_codigo field when cui value changes
        frm.fields_dict.articulo_codigo?.df.fieldname && frm.fields_dict.articulo_codigo.$input?.focus();
    },
    
    // Handle estado_boleta changes to toggle fields read-only status
    estado_boleta: function(frm) {
        toggleFieldsBasedOnEstadoBoleta(frm);
    }
});

// 📅 Función auxiliar: sumar N días hábiles (lunes-viernes)
function addBusinessDays(date, days) {
    let result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        // 0 = domingo, 6 = sábado → solo contar lunes (1) a viernes (5)
        if (day !== 0 && day !== 6) {
            addedDays++;
        }
    }
    return result;
}

// Function to toggle fields read-only status based on estado_boleta value
function toggleFieldsBasedOnEstadoBoleta(frm) {
    // Fields to toggle read-only status
    const fieldsToToggle = ['agente', 'vehiculo_id', 'fecha_infraccion', 'cui', 'articulo_codigo', 'fecha_infraccion_descuento'];
    
    // Check if estado_boleta is NOT "DISPONIBLE" or "DIGITADA"
    const readOnlyStatus = !(frm.doc.estado_boleta === "DISPONIBLE" || frm.doc.estado_boleta === "DIGITADA");
    
    // Set read-only status for each field
    fieldsToToggle.forEach(field => {
        if (frm.fields_dict[field]) {
            frm.fields_dict[field].df.read_only = readOnlyStatus ? 1 : 0;
            frm.fields_dict[field].refresh();
        }
    });
}