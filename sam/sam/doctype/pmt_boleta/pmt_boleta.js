// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

const FIELD_STYLE_CONFIG = {
    boleta_id: {
        input: {
            'font-size': '26px',
            'text-align': 'center',
            border: '2px solid red',
            'border-radius': '6px',
            padding: '8px'
        },
        label: {
            color: 'green',
            'text-align': 'center',
            width: '100%',
            'font-size': '20px',
            'font-weight': 'bold'
        }
    },
    estado_boleta: {
        select: {
            'text-align': 'center',
            'text-align-last': 'center',
            '-moz-text-align-last': 'center',
            'font-size': '10px',
            border: '2px solid green',
            'border-radius': '6px',
            padding: '6px'
        },
        label: {
            color: 'green',
            'text-align': 'center',
            width: '100%',
            'font-size': '12px',
            'font-weight': 'bold'
        }
    }
};

const COLUMN_BORDER_CONFIG = {
    column_break_mvvo: {
        'border-left': '3px solid green',
        'padding-left': '15px',
        'padding-right': '15px',
        'border-radius': '4px'
    }
};

const FIELDS_TO_TOGGLE = ['agente', 'vehiculo_id', 'fecha_infraccion', 'cui', 'articulo_codigo', 'fecha_infraccion_descuento'];
const INTEREST_RATE = 0.20; // 20% anual
const INTEREST_GRACE_DAYS = 6; // días hábiles antes de aplicar interés
const DISCOUNT_RATE = 0.25; // 25% de descuento
const DISCOUNT_BUSINESS_DAYS = 5; // primeros 5 días hábiles

// -------------------------------
// Form lifecycle
// -------------------------------
frappe.ui.form.on('PMT Boleta', {
    refresh(frm) {
        applyFieldStyles(frm);
        applyColumnStyles(frm);
        ensureQuickCreateButton(frm);
        ensureDefaultFechaInfraccion(frm);
        toggleFieldsBasedOnEstadoBoleta(frm);
        calculateInfraccionSaldo(frm);
    },

    fecha_infraccion(frm) {
        updateFechaInfraccionDescuento(frm);
        calculateInfraccionSaldo(frm);
    },

    boleta_id(frm) {
        if (!frm.doc.boleta_id) {
            return;
        }

        frappe.call({
            method: 'sam.sam.pmt_utils.obtener_datos_boleta',
            args: { boleta_id: frm.doc.boleta_id }
        }).then(r => {
            if (!r.message) {
                return;
            }

            const { estado_boleta, agente_asignado_detalle } = r.message;
            frm.set_value('estado_boleta', estado_boleta || '');
            frm.set_value('agente', agente_asignado_detalle || '');
            focusFieldInput(frm, 'vehiculo_id');
        });
    },

    vehiculo_id(frm) {
        focusFieldInput(frm, 'cui');
    },

    cui(frm) {
        focusFieldInput(frm, 'articulo_codigo');
    },

    articulo_valor(frm) {
        calculateInfraccionSaldo(frm);
    },

    estado_boleta(frm) {
        toggleFieldsBasedOnEstadoBoleta(frm);
    }
});

// -------------------------------
// Styling helpers
// -------------------------------
function applyFieldStyles(frm) {
    Object.entries(FIELD_STYLE_CONFIG).forEach(([fieldname, config]) => {
        const field = frm.get_field(fieldname);
        if (!field) {
            return;
        }

        if (config.input && field.$input) {
            field.$input.css(config.input);
        }

        if (config.select) {
            field.$wrapper?.find('select').css(config.select);
        }

        if (config.label) {
            const labelElement = field.$wrapper?.find('.control-label');
            if (labelElement && labelElement.length) {
                labelElement.css(config.label);
                labelElement.parent().css('text-align', config.label['text-align'] || '');
            }
        }
    });
}

function applyColumnStyles(frm) {
    Object.entries(COLUMN_BORDER_CONFIG).forEach(([fieldname, cssRules]) => {
        const wrapper = frm.fields_dict[fieldname]?.wrapper;
        if (!wrapper) {
            return;
        }
        const columnContainer = $(wrapper).closest('.form-column');
        if (columnContainer.length) {
            columnContainer.css(cssRules);
        }
    });
}

function ensureQuickCreateButton(frm) {
    if (!frm.is_new()) {
        return;
    }
    frm.page.add_inner_button(__('Guardar y Crear Nueva'), () => {
        frm.save(null, null, () => frappe.new_doc('PMT Boleta'));
    });
}

// -------------------------------
// Date helpers
// -------------------------------
function ensureDefaultFechaInfraccion(frm) {
    if (!frm.is_new() || frm.doc.fecha_infraccion) {
        return;
    }
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');

    frm.set_value('fecha_infraccion', `${yyyy}-${mm}-${dd}`);
}

function updateFechaInfraccionDescuento(frm) {
    const fecha = frm.doc.fecha_infraccion;
    if (!fecha) {
        frm.set_value('fecha_infraccion_descuento', '');
        return;
    }
    const startDate = frappe.datetime.str_to_obj(fecha);
    const dueDate = addBusinessDays(startDate, 5);
    frm.set_value('fecha_infraccion_descuento', frappe.datetime.obj_to_str(dueDate));
}

// 📅 Suma n días hábiles (lunes a viernes)
function addBusinessDays(date, days) {
    let result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        if (day !== 0 && day !== 6) {
            addedDays++;
        }
    }
    return result;
}

// -------------------------------
// Field state helpers
// -------------------------------
function toggleFieldsBasedOnEstadoBoleta(frm) {
    const readOnlyStatus = !(frm.doc.estado_boleta === 'DISPONIBLE' || frm.doc.estado_boleta === 'VERIFICACION');
    FIELDS_TO_TOGGLE.forEach(fieldname => {
        const field = frm.fields_dict[fieldname];
        if (!field) {
            return;
        }
        field.df.read_only = readOnlyStatus ? 1 : 0;
        field.refresh();
    });
}

function focusFieldInput(frm, fieldname) {
    const field = frm.get_field(fieldname);
    if (field && field.$input) {
        frappe.after_ajax(() => setTimeout(() => field.$input.focus(), 0));
    }
}

// -------------------------------
// Financial helpers
// -------------------------------
function calculateInfraccionSaldo(frm) {
    const principal = parseFloat(frm.doc.articulo_valor) || 0;
    const fechaInfraccion = frm.doc.fecha_infraccion;

    if (!principal) {
        updateInfraccionSaldoField(frm, 0);
        return;
    }

    if (!fechaInfraccion) {
        updateInfraccionSaldoField(frm, principal);
        return;
    }

    const startDate = frappe.datetime.str_to_obj(fechaInfraccion);
    if (!startDate) {
        updateInfraccionSaldoField(frm, principal);
        return;
    }

    const todayStr = frappe.datetime.get_today();
    const today = frappe.datetime.str_to_obj(todayStr);
    const discountDeadline = addBusinessDays(startDate, DISCOUNT_BUSINESS_DAYS);
    const accrualStartDate = addBusinessDays(startDate, INTEREST_GRACE_DAYS);

    if (!discountDeadline || !accrualStartDate || !today) {
        updateInfraccionSaldoField(frm, principal);
        return;
    }

    if (today <= discountDeadline) {
        const discountedAmount = principal * (1 - DISCOUNT_RATE);
        updateInfraccionSaldoField(frm, Number(discountedAmount.toFixed(2)));
        return;
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const elapsedDays = Math.max(0, Math.floor((today - accrualStartDate) / msPerDay));
    const interest = principal * INTEREST_RATE * (elapsedDays / 365);
    const saldo = principal + interest;

    updateInfraccionSaldoField(frm, Number(saldo.toFixed(2)));
}

function updateInfraccionSaldoField(frm, amount) {
    const roundedAmount = Number((amount || 0).toFixed(2));
    const formattedAmount = formatAsQuetzal(roundedAmount);
    const field = frm.get_field('infraccion_saldo');

    if (!field) {
        frm.set_value('infraccion_saldo', roundedAmount);
        return;
    }

    if (field.df.fieldtype === 'HTML') {
        const controlWrapper = field.$wrapper.find('.frappe-control');
        const parentContainer = controlWrapper.length ? controlWrapper : field.$wrapper;
        let valueContainer = parentContainer.find('.infraccion-saldo-display');

        if (!valueContainer.length) {
            valueContainer = $('<div class="infraccion-saldo-display control-value"></div>').appendTo(parentContainer);
        }

        valueContainer
            .html(formattedAmount)
            .css({
                'text-align': 'right',
                color: 'red',
                'font-weight': 'bold',
                'font-size': '18px',
                'border': '2px solid yellow',
                'border-radius': '6px',
                padding: '8px',
                'pointer-events': 'none',
                'user-select': 'none'
            })
            .attr('contenteditable', 'false');
    } else {
        frm.set_value('infraccion_saldo', roundedAmount);
        if (field.$input && field.$input.length) {
            field.$input.css({
                'text-align': 'right',
                color: 'red',
                'font-weight': 'bold',
                'font-size': '18px',
                'border': '2px solid yellow',
                'border-radius': '6px',
                padding: '8px'
            });
        }
        field.$wrapper?.find('.control-value').css({
            'text-align': 'right',
            color: 'red',
            'font-weight': 'bold',
            'font-size': '18px',
            'border': '2px solid yellow',
            'border-radius': '6px',
            padding: '8px'
        });
    }
}

function formatAsQuetzal(value) {
    const amount = typeof value === 'number' ? value : parseFloat(value) || 0;
    if (frappe.format_value) {
        try {
            const formatted = frappe.format_value(amount, {
                fieldtype: 'Currency',
                options: 'GTQ'
            });
            if (formatted) {
                return formatted;
            }
        } catch (err) {
            // fallback manual format
        }
    }

    return `Q ${amount.toFixed(2)}`;
}
