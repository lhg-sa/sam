// Copyright (c) 2026, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

frappe.ui.form.on("DAFIM Solicitud Fuente", {
	refresh(frm) {
		if (frm.doc.material_request_id) {
			set_detalle_from_mr(frm);
		}
		calculate_total_asignacion(frm);
		apply_total_styles(frm);
	},

	material_request_id(frm) {
		//console.log('DAFIM: material_request_id changed to', frm.doc.material_request_id);
		//frappe.msgprint('Actualizando detalle de solicitud...');
		if (frm.doc.material_request_id) {
			set_detalle_from_mr(frm);
		} else {
			frm.set_value('detalle_solicitud_html', '');
			frm.refresh_field('detalle_solicitud_html');
		}
	}
});

frappe.ui.form.on("DAFIM Solicitud Fuente Detalle", {
	fuente_asignado: function(frm, cdt, cdn) {
		calculate_total_asignacion(frm);
	},
	fuente_detalle_remove: function(frm, cdt, cdn) {
		calculate_total_asignacion(frm);
	}
});

function calculate_total_asignacion(frm) {
	let total = 0;
	if (frm.doc.fuente_detalle && frm.doc.fuente_detalle.length > 0) {
		frm.doc.fuente_detalle.forEach(row => {
			total += flt(row.fuente_asignado);
		});
	}
	frm.set_value('total_asignacion_fuente', total);
	apply_total_styles(frm);
}

function apply_total_styles(frm) {
	setTimeout(() => {
		let field = frm.get_field('total_asignacion_fuente');
		if (field && field.$input) {
			field.$input.css({
				'color': 'red',
				'font-weight': 'bold',
				'text-align': 'right',
				'font-size': '18px'
			});
		}
	}, 100);
}

function set_detalle_from_mr(frm) {
	const mr_id = frm.doc.material_request_id;
	if (!mr_id) return;
	console.log('DAFIM: loading Material Request', mr_id);

	// Try client-side get_doc first
	frappe.db.get_doc('Material Request', mr_id)
		.then(mr => {
			render_items(frm, mr.items || []);
		})
		.catch(err => {
			console.error('DAFIM: frappe.db.get_doc failed, falling back to frappe.call', err);
			// Fallback to server call
			frappe.call({
				method: 'frappe.client.get',
				args: { doctype: 'Material Request', name: mr_id },
				callback: function(r) {
					if (r && r.message) {
						render_items(frm, r.message.items || []);
					} else {
						frm.set_value('detalle_solicitud_html', '');
						frm.refresh_field('detalle_solicitud_html');
					}
				}
			});
		});
}

function render_items(frm, items) {
	let html = '<div class="table-responsive"><table class="table table-bordered">';
	html += '<thead><tr><th>Item Code</th><th>Description</th><th>Quantity</th><th>UOM</th></tr></thead><tbody>';
	items.forEach(i => {
		html += '<tr>';
		if (frappe.utils && frappe.utils.escape_html) {
			html += '<td>' + frappe.utils.escape_html(i.item_code || '') + '</td>';
			html += '<td>' + frappe.utils.escape_html(i.description || '') + '</td>';
			html += '<td>' + (i.qty || '') + '</td>';
			html += '<td>' + frappe.utils.escape_html(i.uom || '') + '</td>';
		} else {
			html += '<td>' + (i.item_code || '') + '</td>';
			html += '<td>' + (i.description || '') + '</td>';
			html += '<td>' + (i.qty || '') + '</td>';
			html += '<td>' + (i.uom || '') + '</td>';
		}
		html += '</tr>';
	});
	html += '</tbody></table></div>';
	
	// Set value in doc
	frm.set_value('detalle_solicitud_html', html);
	
	// Force DOM update for HTML field
	let wrapper = frm.get_field('detalle_solicitud_html').$wrapper;
	if (wrapper) {
		wrapper.html(html);
	}
	
	frm.refresh_field('detalle_solicitud_html');
	//frappe.msgprint('Detalle actualizado correctamente.');
}
