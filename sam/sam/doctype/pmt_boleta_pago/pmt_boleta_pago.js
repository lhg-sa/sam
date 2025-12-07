// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

const allowedStates = ['VERIFICACION', 'PENDIENTE-PAGO'];

const focusBoleta = (frm) => {
	const boletaField = frm.fields_dict?.boleta_id;
	frappe.utils.defer(() => {
		if (boletaField?.$input?.is(':visible')) {
			boletaField.$input.focus();
		}
	});
};

const clearFormFields = (frm) => {
	// If the doc is saved, start a fresh one so boleta_id remains editable (autoname).
	if (!frm.is_new()) {
		return new Promise((resolve) => {
			frappe.new_doc(frm.doctype);
			frappe.after_ajax(() => {
				focusBoleta(cur_frm || frm);
				resolve();
			});
		});
	}

	return frm
		.set_value({
			boleta_id: null,
			placa_id: null,
			saldo_actual: null,
			recibo_id: null,
			fecha_pago: null,
			estado_boleta_detalle: null
		})
		.then(() => focusBoleta(frm));
};

const validateBoleta = async (frm) => {
	const boleta = frm.doc.boleta_id;

	if (!boleta) {
		await frm.set_value('estado_boleta_detalle', null);
		return;
	}

	try {
		const { message } = await frappe.db.get_value('PMT Boleta', boleta, 'estado_boleta');
		const estado = message?.estado_boleta || null;
		await frm.set_value('estado_boleta_detalle', estado);

		if (!estado || !allowedStates.includes(estado)) {
			await frm.set_value({ boleta_id: null, estado_boleta_detalle: null });
			frappe.msgprint(
				__('Solo se permiten boletas en estado VERIFICACION o PENDIENTE-PAGO.')
			);
			focusBoleta(frm);
		}
	} catch (e) {
		await frm.set_value({ boleta_id: null, estado_boleta_detalle: null });
		frappe.msgprint(__('No se pudo validar el estado de la boleta seleccionada.'));
		focusBoleta(frm);
	}
};

const addPrimaryButton = (frm, label, handler) => {
	const btn = frm.add_custom_button(__(label), handler);
	btn.addClass('btn-primary');
	return btn;
};

const ensureCenterStyle = () => {
	const styleId = 'pmt-boleta-pago-center-style';
	if (document.getElementById(styleId)) return;

	const css = `
		.pmt-boleta-pago-center .frappe-control input,
		.pmt-boleta-pago-center .frappe-control textarea,
		.pmt-boleta-pago-center .frappe-control .control-value,
		.pmt-boleta-pago-center .frappe-control .like-disabled-input {
			text-align: center !important;
		}

		/* Etiquetas centradas */
		.pmt-boleta-pago-center .frappe-control .control-label {
			text-align: center;
			width: 100%;
		}

		/* Estilo especial para boleta_id */
		.pmt-boleta-pago-center [data-fieldname="boleta_id"] input,
		.pmt-boleta-pago-center [data-fieldname="boleta_id"] textarea,
		.pmt-boleta-pago-center [data-fieldname="boleta_id"] .like-disabled-input,
		.pmt-boleta-pago-center [data-fieldname="boleta_id"] .control-value {
			font-size: 20px;
			color: red;
			font-weight: 700;
			border: 1px solid #1d74f5;
		}

		/* Estado en verde y negrita */
		.pmt-boleta-pago-center [data-fieldname="estado_boleta_detalle"] input,
		.pmt-boleta-pago-center [data-fieldname="estado_boleta_detalle"] .like-disabled-input,
		.pmt-boleta-pago-center [data-fieldname="estado_boleta_detalle"] .control-value {
			color: green;
			font-weight: 700;
		}
	`;

	const style = document.createElement('style');
	style.id = styleId;
	style.textContent = css;
	document.head.appendChild(style);
};

const centerFields = (frm) => {
	ensureCenterStyle();
	frm.$wrapper.addClass('pmt-boleta-pago-center');

	const fields = [
		'boleta_id',
		'placa_id',
		'saldo_actual',
		'recibo_id',
		'fecha_pago',
		'estado_boleta_detalle'
	];

	frappe.utils.defer(() => {
		fields.forEach((fieldname) => {
			const field = frm.fields_dict?.[fieldname];
			if (!field) return;

			// Center editable inputs
			field.$wrapper
				.find('input, textarea')
				.css('text-align', 'center');

			// Center display-only values
			field.$wrapper
				.find('.control-value, .like-disabled-input')
				.css('text-align', 'center');
		});
	});
};

const markBoletaAsPaid = async (frm) => {
	const boleta = frm.doc.boleta_id;
	if (!boleta) return;

	try {
		await frappe.db.set_value('PMT Boleta', boleta, {
			estado_boleta: 'PAGADA',
			fecha_pago: frm.doc.fecha_pago || frappe.datetime.get_today()
		});
	} catch (e) {
		frappe.msgprint(__('No se pudo actualizar el estado de la boleta a PAGADA.'));
	}
};

frappe.ui.form.on('PMT Boleta Pago', {
	setup(frm) {
		// Ensure the link search returns boletas in either allowed state (OR).
		frm.set_query('boleta_id', () => ({
			filters: {
				estado_boleta: ['in', allowedStates]
			}
		}));
	},

	refresh(frm) {
		addPrimaryButton(frm, 'Guardar y Limpiar', () =>
			frm.save().then(() => clearFormFields(frm))
		);

		addPrimaryButton(frm, 'Limpiar', () => clearFormFields(frm));

		centerFields(frm);
	},

	boleta_id(frm) {
		validateBoleta(frm);
	},

	async after_save(frm) {
		await markBoletaAsPaid(frm);
	}
});
