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
const LOCKED_STATES = ['PAGADA', 'ANULADA-JUZGADO'];
const ESTADO_PRESETS = ['PENDIENTE-PAGO', 'ANULADA-AGENTE', 'DISPUTA', 'VERIFICACION', 'ANULADA-JUZGADO'];
const ESTADO_PRESET_STYLES = {
    'PENDIENTE-PAGO': { background: '#f6c23e', color: '#1f1f1f' },
    'ANULADA-AGENTE': { background: '#e74a3b', color: '#fff' },
    'DISPUTA': { background: '#4e73df', color: '#fff' },
    'VERIFICACION': { background: '#36b9cc', color: '#fff' },
    'ANULADA-JUZGADO': { background: '#858796', color: '#fff' }
};
const INFRACCION_SALDO_EDIT_ROLES = ['Juzgado Administrador'];

function getAvailableEstadoPresets() {
    const roles = frappe?.user_roles || [];
    if (roles.includes('System Manager') || roles.includes('Juzgado Administrador')) {
        return ESTADO_PRESETS;
    }

    if (roles.includes('PMT Administrador')) {
        return ['ANULADA-AGENTE', 'VERIFICACION', 'PENDIENTE-PAGO'].filter((preset) =>
            ESTADO_PRESETS.includes(preset)
        );
    }

    return [];
}

const ALERT_TIMEOUT_SECONDS = 5;

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
		toggleInfraccionSaldoAccess(frm);
		calculateInfraccionSaldo(frm);
		enforceLockedState(frm);
		renderEstadoPresetButtons(frm);
	},

    fecha_infraccion(frm) {
        updateFechaInfraccionDescuento(frm);
        calculateInfraccionSaldo(frm);
    },

    boleta_id(frm) {
        if (!frm.doc.boleta_id) {
            return;
        }

        checkExistingBoleta(frm).then((exists) => {
            if (exists) {
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
				const nextState = frm.is_new()
					? 'VERIFICACION'
					: estado_boleta || frm.doc.estado_boleta || '';
				if (nextState) {
					frm.set_value('estado_boleta', nextState);
				}
				frm.set_value('agente', agente_asignado_detalle || '');
				focusFieldInput(frm, 'vehiculo_id');
			});
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
        enforceLockedState(frm);
    },

    validate(frm) {
        if (frm.is_new()) {
            calculateInfraccionSaldo(frm);
        }
        if (!frm.is_new() && LOCKED_STATES.includes(frm.doc.estado_boleta)) {
            frappe.throw(
                __('No puede guardar una boleta en estado {0}.', [frm.doc.estado_boleta])
            );
        }
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
		$(wrapper)
			.closest('.form-column')
			.css(cssRules);
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

function toggleInfraccionSaldoAccess(frm) {
	const canEdit = (frappe?.user_roles || []).some((role) =>
		INFRACCION_SALDO_EDIT_ROLES.includes(role)
	);
	frm.set_df_property('infraccion_saldo', 'read_only', canEdit ? 0 : 1);
	frm.refresh_field('infraccion_saldo');
}

function isLockedBoleta(frm) {
    return !frm.is_new() && LOCKED_STATES.includes(frm.doc.estado_boleta);
}

function enforceLockedState(frm) {
	const isLocked = isLockedBoleta(frm);
	if (isLocked) {
		frm.disable_form();
		if (!frm.__locked_state_alert_shown) {
			showAlert(__('No puede modificar una boleta en estado {0}.', [frm.doc.estado_boleta]), 'orange');
			frm.__locked_state_alert_shown = true;
		}
		return;
	}

	frm.enable_save();
	frm.__locked_state_alert_shown = false;
}

function renderEstadoPresetButtons(frm) {
	if (!frm.page) {
		return;
	}

	if (frm.estadoPresetButtons?.length) {
		frm.estadoPresetButtons.forEach(($btn) => $btn.remove());
	}
	frm.estadoPresetButtons = [];

	if (frm.is_new()) {
		return;
	}

	if (isLockedBoleta(frm)) {
		// No presentar botones preset cuando la boleta tiene estado bloqueado.
		return;
	}

	const visiblePresets = getAvailableEstadoPresets();
	if (!visiblePresets.length) {
		return;
	}

	visiblePresets.forEach((label) => {
		const isCurrentState = frm.doc.estado_boleta === label;
		const $btn = frm.page.add_inner_button(
			label,
			() => {
				if (frm.doc.estado_boleta === label) {
					showAlert(__('Boleta ya en estado {0}.', [label]), 'blue');
					return;
				}

				frm.set_value('estado_boleta', label);
				frm.save().then(() => {
					showAlert(__('Estado actualizado a {0}.', [label]), 'green');
				}).catch(() => {
					showAlert(__('No se pudo guardar el estado seleccionado.'), 'red');
				});
			},
		);
		const presetStyle = ESTADO_PRESET_STYLES[label] || {};
		if (presetStyle.background) {
			$btn.css({
				'background-color': presetStyle.background,
				color: presetStyle.color || 'inherit',
				'border-color': presetStyle.background
			});
		} else if (presetStyle.color) {
			$btn.css('color', presetStyle.color);
		}
		if (isCurrentState) {
			$btn.css({
				visibility: 'hidden',
				'pointer-events': 'none'
			});
		}
		frm.estadoPresetButtons.push($btn);
	});
}

function checkExistingBoleta(frm) {
	if (!frm.doc.boleta_id) {
		return Promise.resolve(false);
	}

	return frappe.db
		.get_value("PMT Boleta", { name: frm.doc.boleta_id }, "name")
		.then((result) => {
			const existingName = result?.message?.name;
			if (!existingName) {
				return false;
			}

			frappe.msgprint({
				title: __("Atención"),
				message: __("Registro Ya Existente"),
				indicator: "orange",
			});

			if (frm.is_dirty()) {
				frm.discard();
			}

			frm.clear();
			frm.refresh();
			focusFieldInput(frm, "boleta_id");
			return true;
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
    if (!frm.is_new()) {
        // Solo calcular automáticamente en registros nuevos; para existentes solo mantener estilo.
        updateInfraccionSaldoField(frm);
        return;
    }

    const principal = Number(frm.doc.articulo_valor) || 0;
    const fechaInfraccion = frm.doc.fecha_infraccion;
    if (!principal || !fechaInfraccion) {
        frm.set_value('infraccion_saldo', null);
        updateInfraccionSaldoField(frm);
        return;
    }

    const today = frappe.datetime.str_to_obj(frappe.datetime.get_today());
    const infraccionDate = frappe.datetime.str_to_obj(fechaInfraccion);
    const discountDeadline = addBusinessDays(infraccionDate, 5); // DISCOUNT_BUSINESS_DAYS
    const accrualStart = addBusinessDays(infraccionDate, 6); // INTEREST_GRACE_DAYS

    let saldo = principal;

    if (today <= discountDeadline) {
        saldo = principal * (1 - 0.25); // DISCOUNT_RATE
    } else if (today > accrualStart) {
        const elapsedDays = Math.max(
            0,
            Math.floor((today - accrualStart) / (1000 * 60 * 60 * 24))
        );
        const interest = principal * 0.20 * (elapsedDays / 365); // INTEREST_RATE
        saldo = principal + interest;
    }

    frm.set_value('infraccion_saldo', Number(saldo.toFixed(2)));
    updateInfraccionSaldoField(frm);
}

function updateInfraccionSaldoField(frm) {
    const field = frm.get_field('infraccion_saldo');

    if (!field) {
        return;
    }

    frm.refresh_field('infraccion_saldo');

    const style = {
        'text-align': 'right',
        color: 'red',
        'font-weight': 'bold',
        'font-size': '18px',
        'border': '2px solid yellow',
        'border-radius': '6px',
        padding: '8px'
    };

	if (field.$input && field.$input.length) {
		field.$input.css(style);
	}
	field.$wrapper?.find('.control-value').css(style);
}

function showAlert(message, indicator = 'blue') {
	frappe.show_alert({ message, indicator }, ALERT_TIMEOUT_SECONDS);
}
