// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

const allowedStates = ['VERIFICACION', 'PENDIENTE-PAGO'];

const focusBoleta = (frm) => {
	const boletaField = frm.fields_dict?.boleta_id;
	if (boletaField?.$input?.is(':visible')) {
		setTimeout(() => boletaField.$input.focus(), 0);
	}
};

const clearFormFields = (frm) =>
	frm
		.set_value({
			boleta_id: null,
			placa_id: null,
			saldo_actual: null,
			recibo_id: null,
			fecha_pago: null,
			estado_boleta_detalle: null
		})
		.then(() => focusBoleta(frm));

frappe.ui.form.on('PMT Boleta Pago', {
	setup(frm) {
		frm.set_query('boleta_id', () => ({
			filters: {
				estado_boleta: ['in', allowedStates]
			}
		}));
	},

	refresh(frm) {
		const saveAndClear = frm.add_custom_button(__('Guardar y Limpiar'), () => {
			frm.save().then(() => clearFormFields(frm));
		});
		saveAndClear.addClass('btn-primary');

		const clearBtn = frm.add_custom_button(__('Limpiar'), () => {
			clearFormFields(frm);
		});
		clearBtn.addClass('btn-primary');
	},

	boleta_id(frm) {
		const boleta = frm.doc.boleta_id;

		if (!boleta) {
			frm.set_value('estado_boleta_detalle', null);
			return;
		}

		frappe.db
			.get_value('PMT Boleta', boleta, 'estado_boleta')
			.then(({ message }) => {
				const estado = message?.estado_boleta || null;
				frm.set_value('estado_boleta_detalle', estado);

				if (!estado || !allowedStates.includes(estado)) {
					frm.set_value({
						boleta_id: null,
						estado_boleta_detalle: null
					});

					frappe.msgprint(
						__('Solo se permiten boletas en estado VERIFICACION o PENDIENTE-PAGO.')
					);
				}
			})
			.catch(() => {
				frm.set_value({
					boleta_id: null,
					estado_boleta_detalle: null
				});

				frappe.msgprint(__('No se pudo validar el estado de la boleta seleccionada.'));
			});
	}
});
