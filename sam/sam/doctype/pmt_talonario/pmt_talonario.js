// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("PMT Talonario", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on('PMT Talonario', {
    refresh(frm) {
        // Botón solo después de guardar
        if (!frm.is_new()) {
            if (!frm.custom_buttons_added) {
                frm.add_custom_button(__('Generar Boletas'), () => generar_boletas(frm));
                frm.custom_buttons_added = true;
            }
        }
    }
});

const CHILD_TABLE_FIELDNAME = 'talonario_detalle';
const CHILD_DOCTYPE_EXPECTED = 'PMT Talonario Detalle';

// Fieldname del agente en el MAESTRO PMT Talonario.
// CAMBIA ESTO si en tu maestro el fieldname real no es "agente_asignado".
const AGENTE_FIELDNAME_MASTER = 'agente_asignado';

// Fieldname del agente en el CHILD “PMT Talonario Detalle” (renombrado)
const AGENTE_FIELDNAME_CHILD = 'agente_asignado_detalle';

// Fieldname del talonario en el MAESTRO y en el CHILD (ajusta si tus nombres reales difieren)
const TALONARIO_ID_MASTER_FIELD = 'talonario_id';
const TALONARIO_ID_CHILD_FIELD = 'talonario_id';

function validar_child_table_meta(frm) {
    const field = frm.fields_dict[CHILD_TABLE_FIELDNAME];
    if (!field) {
        frappe.msgprint({
            title: __('Error de Configuración'),
            indicator: 'red',
            message: __('No se encontró el campo de tabla "{0}" en el DocType PMT Talonario.', [CHILD_TABLE_FIELDNAME])
        });
        return { ok: false, reason: 'field_not_found' };
    }
    if (field.df.fieldtype !== 'Table') {
        frappe.msgprint({
            title: __('Error de Configuración'),
            indicator: 'red',
            message: __('El campo "{0}" no es de tipo Table (es {1}).', [CHILD_TABLE_FIELDNAME, field.df.fieldtype])
        });
        return { ok: false, reason: 'not_table' };
    }
    if (!field.df.options) {
        frappe.msgprint({
            title: __('Error de Configuración'),
            indicator: 'red',
            message: __('El campo Table "{0}" no tiene definido Options. Debe ser: {1}.', [CHILD_TABLE_FIELDNAME, CHILD_DOCTYPE_EXPECTED])
        });
        return { ok: false, reason: 'options_missing' };
    }
    if (field.df.options !== CHILD_DOCTYPE_EXPECTED) {
        frappe.msgprint({
            title: __('Error de Configuración'),
            indicator: 'red',
            message: __('El campo Table "{0}" tiene Options "{1}". Debe ser: "{2}".', [CHILD_TABLE_FIELDNAME, field.df.options, CHILD_DOCTYPE_EXPECTED])
        });
        return { ok: false, reason: 'wrong_options' };
    }
    return { ok: true };
}

function validar_campos_requeridos(frm) {
    const errores = [];

    if (!frm.doc.boleta_inicial || !frm.doc.boleta_final) {
        errores.push('Debe ingresar Boleta Inicial y Boleta Final');
    }

    const agente_val = frm.doc[AGENTE_FIELDNAME_MASTER];
    if (!agente_val) {
        errores.push(`Debe seleccionar un Agente Asignado (campo maestro: ${AGENTE_FIELDNAME_MASTER})`);
    }

    if (!frm.doc[TALONARIO_ID_MASTER_FIELD]) {
        errores.push(`Debe seleccionar/definir el Talonario (${TALONARIO_ID_MASTER_FIELD}) en el maestro`);
    }

    if (errores.length > 0) {
        frappe.msgprint({
            title: __('Campos Requeridos'),
            indicator: 'red',
            message: errores.join('<br>')
        });
        return false;
    }
    return true;
}

function validar_rango_boletas(boleta_inicial, boleta_final) {
    if (Number.isNaN(boleta_inicial) || Number.isNaN(boleta_final)) {
        frappe.msgprint({
            title: __('Error de Validación'),
            indicator: 'red',
            message: __('Boleta Inicial/Final deben ser números válidos')
        });
        return false;
    }
    if (boleta_inicial > boleta_final) {
        frappe.msgprint({
            title: __('Error de Validación'),
            indicator: 'red',
            message: __('Boleta Inicial debe ser menor o igual a Boleta Final')
        });
        return false;
    }
    return true;
}

function generar_boletas(frm) {
    console.log('=== INICIO: Generar Boletas ===');

    const metaCheck = validar_child_table_meta(frm);
    if (!metaCheck.ok) {
        console.error('Error meta child table:', metaCheck.reason);
        return;
    }

    if (!validar_campos_requeridos(frm)) {
        console.log('ERROR: Faltan campos requeridos');
        return;
    }

    const boleta_inicial = parseInt(frm.doc.boleta_inicial, 10);
    const boleta_final = parseInt(frm.doc.boleta_final, 10);
    const agente_asignado_master = frm.doc[AGENTE_FIELDNAME_MASTER];
    const talonario_id_maestro = frm.doc[TALONARIO_ID_MASTER_FIELD];

    console.log('Boleta Inicial:', boleta_inicial);
    console.log('Boleta Final:', boleta_final);
    console.log(`Agente maestro (${AGENTE_FIELDNAME_MASTER}):`, agente_asignado_master);
    console.log(`Talonario maestro (${TALONARIO_ID_MASTER_FIELD}):`, talonario_id_maestro);

    if (!validar_rango_boletas(boleta_inicial, boleta_final)) {
        return;
    }

    frappe.show_alert({ message: __('Iniciando generación de boletas...'), indicator: 'blue' }, 3);

    try {
        console.log('Limpiando tabla...');
        frm.clear_table(CHILD_TABLE_FIELDNAME);

        let contador = 0;

        for (let i = boleta_inicial; i <= boleta_final; i++) {
            const row = frm.add_child(CHILD_TABLE_FIELDNAME);
            if (!row) throw new Error('No se pudo agregar la fila en el detalle');

            row.boleta_id_detalle = i;
            row.estado_boleta = 'DISPONIBLE';

            // Usa el NUEVO fieldname en el CHILD
            row[AGENTE_FIELDNAME_CHILD] = agente_asignado_master || null;

            // Copiar talonario_id (ajusta si el fieldname en child es distinto)
            row[TALONARIO_ID_CHILD_FIELD] = talonario_id_maestro || null;

            contador++;
            console.log('Boleta insertada:', {
                boleta_id_detalle: row.boleta_id_detalle,
                estado_boleta: row.estado_boleta,
                [AGENTE_FIELDNAME_CHILD]: row[AGENTE_FIELDNAME_CHILD],
                [TALONARIO_ID_CHILD_FIELD]: row[TALONARIO_ID_CHILD_FIELD]
            });
        }

        frm.refresh_field(CHILD_TABLE_FIELDNAME);

        frappe.msgprint({
            title: __('Éxito'),
            indicator: 'green',
            message: __('Se generaron {0} boletas correctamente (desde {1} hasta {2})<br>Agente (maestro: {3}): {4}<br>Talonario (maestro: {5}): {6}', [
                contador,
                boleta_inicial,
                boleta_final,
                AGENTE_FIELDNAME_MASTER,
                frappe.utils.escape_html(agente_asignado_master || ''),
                TALONARIO_ID_MASTER_FIELD,
                frappe.utils.escape_html(talonario_id_maestro || '')
            ])
        });

        console.log('Total de registros insertados:', contador);
        console.log('=== FINALIZADO: Generación Exitosa ===');

        frappe.show_alert({ message: __('Proceso finalizado correctamente'), indicator: 'green' }, 5);

    } catch (error) {
        console.error('ERROR en la inserción:', error);
        frappe.msgprint({
            title: __('Error'),
            indicator: 'red',
            message: __('Ocurrió un error al generar las boletas: {0}', [error?.message || error])
        });
        console.log('=== FINALIZADO: Con Errores ===');
    }
}