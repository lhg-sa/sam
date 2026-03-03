frappe.listview_settings["PMT Novedades"] = {
	hide_name_column: false,
	add_fields: [
		"tipo_incidencia",
		"fecha_hora_reporte",
		"usuario_registro",
		"usar_ubicacion_gps",
		"latitud",
		"longitud",
	],
	primary_action: null,
	onload(listview) {
		if (listview.page && listview.page.btn_primary) {
			listview.page.btn_primary.hide();
		}

		listview.page.add_inner_button(__("Solo con GPS"), () => {
			listview.filter_area.add([["PMT Novedades", "usar_ubicacion_gps", "=", 1]]);
		});
	},
	get_indicator(doc) {
		const colors = {
			"Accidente de Tránsito": "red",
			"Semáforo Dañado": "orange",
			"Vía Obstruida": "yellow",
			Otro: "blue",
		};
		const color = colors[doc.tipo_incidencia] || "blue";
		return [__(doc.tipo_incidencia || "Sin tipo"), color, "tipo_incidencia,=," + (doc.tipo_incidencia || "")];
	},
	formatters: {
		fecha_hora_reporte(value) {
			if (!value) return "";
			return `<span style="font-weight:600;color:#1e3a8a;">${frappe.datetime.str_to_user(value)}</span>`;
		},
		usuario_registro(value) {
			if (!value) return "";
			return `<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:999px;padding:2px 8px;font-weight:600;">${frappe.utils.escape_html(value)}</span>`;
		},
		usar_ubicacion_gps(value, _df, doc) {
			const enabled = cint(value) === 1 || (!!doc.latitud && !!doc.longitud);
			if (enabled) {
				return '<span style="background:#ecfdf3;color:#047857;border:1px solid #a7f3d0;border-radius:999px;padding:2px 8px;font-weight:700;">GPS</span>';
			}
			return '<span style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;border-radius:999px;padding:2px 8px;font-weight:700;">Sin GPS</span>';
		},
	},
};
