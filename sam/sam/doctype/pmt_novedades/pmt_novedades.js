// Copyright (c) 2026, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

frappe.ui.form.on("PMT Novedades", {
	onload(frm) {
		apply_enterprise_theme(frm);
		set_read_only_mode(frm);
		render_gps_map_link(frm);
	},

	refresh() {
		apply_enterprise_theme(frm);
		set_read_only_mode(frm);
		set_form_intro(frm);
		set_dashboard_indicators(frm);
		add_map_button(frm);
		render_gps_map_link(frm);
		void render_evidence_carousel(frm);
	},

	imagenes_add(frm) {
		void render_evidence_carousel(frm);
	},

	imagenes_remove(frm) {
		void render_evidence_carousel(frm);
	},

	tipo_incidencia(frm) {
		set_dashboard_indicators(frm);
	},

	usar_ubicacion_gps(frm) {
		set_dashboard_indicators(frm);
		add_map_button(frm);
		render_gps_map_link(frm);
	},

	latitud(frm) {
		add_map_button(frm);
		render_gps_map_link(frm);
	},

	longitud(frm) {
		add_map_button(frm);
		render_gps_map_link(frm);
	},

	validate(frm) {
		render_gps_map_link(frm);
	},

	after_save(frm) {
		add_map_button(frm);
		render_gps_map_link(frm);
	},
});

function set_form_intro(frm) {
	const status_text = frm.doc.usar_ubicacion_gps
		? __("Reporte con geolocalización activa")
		: __("Reporte sin geolocalización activa");

	frm.set_intro(
		__("Use este formulario para consultar incidencias viales registradas, evidencia y ubicación."),
		"blue"
	);

	frm.dashboard.clear_headline();
	frm.dashboard.set_headline(
		`<span style="font-weight:600;color:#1d4ed8;">${__("Estado")}: ${status_text}</span>`
	);
}

function set_read_only_mode(frm) {
	frm.disable_save();

	(frm.meta.fields || []).forEach((df) => {
		if (!df.fieldname) return;
		frm.toggle_enable(df.fieldname, false);
	});
}

async function render_evidence_carousel(frm) {
	const html_field = frm.fields_dict.evidencia_carousel_html;
	if (!html_field || !html_field.$wrapper) return;

	let rows = (frm.doc.imagenes || []).filter((row) => row && (row.imagen || row.image || row.file_url));

	if (!rows.length && frm.doc.name) {
		try {
			rows = await frappe.db.get_list("PMT Novedad Imagen", {
				fields: ["imagen", "descripcion", "idx"],
				filters: {
					parent: frm.doc.name,
					parenttype: "PMT Novedades",
					parentfield: "imagenes",
				},
				order_by: "idx asc",
				limit: 200,
			});
		} catch (error) {
			console.warn("No se pudieron obtener imágenes de evidencia", error);
		}
	}

	if (!rows.length) {
		html_field.$wrapper.html(
			`<div class="pmt-empty-gallery">${__("No hay imágenes de evidencia para mostrar.")}</div>`
		);
		return;
	}

	const slides = rows
		.map((row, index) => {
			const image_value = row.imagen || row.image || row.file_url || "";
			const image_url = get_public_image_url(image_value);
			if (!image_url) return "";

			const url = frappe.utils.escape_html(image_url);
			const desc = frappe.utils.escape_html(row.descripcion || __("Sin descripción"));
			const active = index === 0 ? "active" : "";

			return `
				<div class="pmt-carousel-slide ${active}" data-index="${index}">
					<div class="pmt-carousel-image-wrap">
						<img src="${url}" alt="${__("Evidencia")} ${index + 1}" class="pmt-carousel-image" />
					</div>
					<div class="pmt-carousel-caption">
						<strong>${__("Imagen")} ${index + 1}</strong>
						<span>${desc}</span>
					</div>
				</div>
			`;
		})
		.join("");

	if (!slides.trim()) {
		html_field.$wrapper.html(
			`<div class="pmt-empty-gallery">${__("No hay imágenes válidas para mostrar.")}</div>`
		);
		return;
	}

	html_field.$wrapper.html(`
		<div class="pmt-carousel" data-current="0">
			<div class="pmt-carousel-track">
				${slides}
			</div>
			<div class="pmt-carousel-controls">
				<button type="button" class="btn btn-default btn-sm pmt-carousel-prev">${__("Anterior")}</button>
				<span class="pmt-carousel-counter">1 / ${rows.length}</span>
				<button type="button" class="btn btn-default btn-sm pmt-carousel-next">${__("Siguiente")}</button>
			</div>
		</div>
	`);

	const $root = html_field.$wrapper.find(".pmt-carousel");
	const $slides = html_field.$wrapper.find(".pmt-carousel-slide");
	const $counter = html_field.$wrapper.find(".pmt-carousel-counter");

	const update = (next_index) => {
		const total = $slides.length;
		if (!total) return;

		let index = next_index;
		if (index < 0) index = total - 1;
		if (index >= total) index = 0;

		$slides.removeClass("active");
		$slides.eq(index).addClass("active");
		$counter.text(`${index + 1} / ${total}`);
		$root.attr("data-current", String(index));
	};

	html_field.$wrapper.find(".pmt-carousel-prev").off("click").on("click", () => {
		const current = cint($root.attr("data-current") || 0);
		update(current - 1);
	});

	html_field.$wrapper.find(".pmt-carousel-next").off("click").on("click", () => {
		const current = cint($root.attr("data-current") || 0);
		update(current + 1);
	});
}

function get_public_image_url(value) {
	const v = (value || "").toString().trim();
	if (!v) return "";
	if (v.startsWith("data:")) return v;
	if (/^https?:\/\//i.test(v)) return v;
	if (v.startsWith("/")) return frappe.urllib.get_full_url(v);
	return frappe.urllib.get_full_url(`/${v}`);
}

function render_gps_map_link(frm) {
	const map_url = get_map_url_from_doc(frm.doc);
	const next_value = map_url || "";

	if (frm.doc.gps_mapa_html !== next_value) {
		frm.doc.gps_mapa_html = next_value;
	}

	frm.refresh_field("gps_mapa_html");
}

function get_map_url_from_doc(doc) {
	const from_field = (doc.gps_mapa_html || "").toString().trim();
	if (/^https?:\/\//i.test(from_field)) return from_field;

	return get_google_maps_url(doc.latitud, doc.longitud);
}

function get_google_maps_url(latitud, longitud) {
	const has_coords = frappe.utils.is_numeric(latitud) && frappe.utils.is_numeric(longitud);
	if (!has_coords) return "";

	const lat = Number(latitud).toFixed(6);
	const lon = Number(longitud).toFixed(6);
	const query = encodeURIComponent(`${lat},${lon}`);
	return `https://www.google.com/maps?q=${query}`;
}

function set_dashboard_indicators(frm) {
	frm.dashboard.clear_indicators();

	const tipo = frm.doc.tipo_incidencia;
	if (tipo) {
		const color_by_tipo = {
			"Accidente de Tránsito": "red",
			"Semáforo Dañado": "orange",
			"Vía Obstruida": "yellow",
			Otro: "blue",
		};

		frm.dashboard.add_indicator(
			`${__("Tipo")}: ${frappe.utils.escape_html(tipo)}`,
			color_by_tipo[tipo] || "blue"
		);
	}

	frm.dashboard.add_indicator(
		frm.doc.usar_ubicacion_gps ? __("GPS incluido") : __("GPS no incluido"),
		frm.doc.usar_ubicacion_gps ? "green" : "gray"
	);

	if (frm.doc.imagenes?.length) {
		frm.dashboard.add_indicator(
			__("Imágenes: {0}", [frm.doc.imagenes.length]),
			"purple"
		);
	}
}

function add_map_button(frm) {
	frm.remove_custom_button(__("Ver ubicación en mapa"));

	const map_url = get_map_url_from_doc(frm.doc);
	if (!map_url) return;

	frm.add_custom_button(__("Ver ubicación en mapa"), () => {
		window.open(map_url, "_blank");
	}).addClass("btn-primary");
}

function apply_enterprise_theme(frm) {
	if (frm.__pmt_novedades_style_applied) return;

	const style_id = "pmt-novedades-enterprise-style";
	if (!document.getElementById(style_id)) {
		const style = document.createElement("style");
		style.id = style_id;
		style.innerHTML = `
			.form-page[data-doctype="PMT Novedades"] .form-layout {
				background: linear-gradient(180deg, #f8fbff 0%, #f1f5f9 100%);
				padding: 12px;
				border-radius: 12px;
			}

			.form-page[data-doctype="PMT Novedades"] .form-section {
				border: 1px solid #c7d2fe;
				border-radius: 12px;
				padding: 14px;
				background: linear-gradient(180deg, #ffffff 0%, #f8faff 100%);
				box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
			}

			.form-page[data-doctype="PMT Novedades"] .section-head {
				color: #1e40af;
				font-weight: 700;
				letter-spacing: 0.3px;
				padding-bottom: 6px;
				border-bottom: 2px solid #dbeafe;
			}

			.form-page[data-doctype="PMT Novedades"] .control-label {
				color: #334155;
				font-weight: 600;
			}

			.form-page[data-doctype="PMT Novedades"] .input-with-feedback,
			.form-page[data-doctype="PMT Novedades"] .frappe-control .control-input {
				border-radius: 8px;
				border-color: #bfdbfe;
				background: #ffffff;
			}

			.form-page[data-doctype="PMT Novedades"] .frappe-control[data-fieldname="tipo_incidencia"] .control-input,
			.form-page[data-doctype="PMT Novedades"] .frappe-control[data-fieldname="fecha_hora_reporte"] .control-input,
			.form-page[data-doctype="PMT Novedades"] .frappe-control[data-fieldname="usuario_registro"] .control-input {
				background: #eef2ff;
				border-color: #c7d2fe;
			}

			.form-page[data-doctype="PMT Novedades"] .grid-heading-row {
				background: #e0e7ff;
				border-bottom: 1px solid #c7d2fe;
			}

			.form-page[data-doctype="PMT Novedades"] .grid-heading-row .grid-static-col,
			.form-page[data-doctype="PMT Novedades"] .grid-heading-row .col {
				color: #1e3a8a;
				font-weight: 700;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-empty-gallery {
				padding: 16px;
				border: 1px dashed #cbd5e1;
				border-radius: 10px;
				background: #f8fafc;
				color: #475569;
				font-weight: 600;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel {
				border: 1px solid #c7d2fe;
				border-radius: 12px;
				background: #eef2ff;
				padding: 12px;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-track {
				position: relative;
				min-height: 270px;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-slide {
				display: none;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-slide.active {
				display: block;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-image-wrap {
				height: 260px;
				border-radius: 10px;
				overflow: hidden;
				background: #0f172a;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-image {
				max-width: 100%;
				max-height: 100%;
				object-fit: contain;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-caption {
				margin-top: 8px;
				display: flex;
				flex-direction: column;
				gap: 2px;
				color: #1e293b;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-controls {
				margin-top: 10px;
				display: flex;
				align-items: center;
				justify-content: space-between;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-carousel-counter {
				font-weight: 700;
				color: #1e3a8a;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-empty-map {
				padding: 10px 12px;
				border: 1px dashed #cbd5e1;
				border-radius: 8px;
				background: #f8fafc;
				color: #475569;
				font-weight: 600;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-map-link-box {
				display: flex;
				flex-direction: column;
				gap: 4px;
				padding: 10px 12px;
				border: 1px solid #bfdbfe;
				border-radius: 8px;
				background: #eff6ff;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-map-link-label {
				font-size: 12px;
				font-weight: 700;
				color: #1e3a8a;
			}

			.form-page[data-doctype="PMT Novedades"] .pmt-map-link-anchor {
				font-size: 13px;
				font-weight: 700;
				color: #1d4ed8;
				text-decoration: underline;
			}
		`;
		document.head.appendChild(style);
	}

	frm.__pmt_novedades_style_applied = true;
}
