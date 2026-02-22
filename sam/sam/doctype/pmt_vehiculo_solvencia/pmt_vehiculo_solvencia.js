// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("PMT Vehiculo Solvencia", {
// 	refresh(frm) {

// 	},
// });

const FIELD_STYLE_CONFIG = {
	placa_vehiculo_buscar: {
		input: {
			"font-size": "20px",
			"text-transform": "uppercase",
			"text-align": "center",
		},
		label: {
			"font-size": "16px",
			display: "block",
			width: "100%",
			"text-align": "center",
			float: "none",
		},
	},
	marca_vehiculo: {
		input: { "text-align": "center" },
		label: {
			display: "block",
			width: "100%",
			"text-align": "center",
			float: "none",
		},
	},
	recibo_pago: {
		input: { "text-align": "center" },
		label: {
			display: "block",
			width: "100%",
			"text-align": "center",
			float: "none",
		},
	},
	es_solvente: {
		input: {
			"font-size": "18px",
			"text-align": "center",
			"font-weight": "bold",
		},
		label: {
			display: "block",
			width: "100%",
			"text-align": "center",
			float: "none",
		},
	},
};

const MULTAS_RESULT_LIMIT = 100;
const PENDING_PAYMENT_STATE = ["PENDIENTE-PAGO", "VERIFICACION"];
const MULTA_FIELDS = [
	"name",
	"boleta_id",
	"fecha_infraccion",
	"articulo_codigo",
	"articulo_valor",
	"infraccion_saldo",
	"estado_boleta",
];
const EDITABLE_FIELDS = ["placa_vehiculo_buscar", "recibo_pago"];
const MESSAGE_PALETTE = {
	muted: { text: "#495057", border: "#dee2e6", bg: "#f8f9fa" },
	success: { text: "#0f5132", border: "#badbcc", bg: "#d1e7dd" },
	warning: { text: "#664d03", border: "#ffe69c", bg: "#fff3cd" },
	danger: { text: "#842029", border: "#f5c2c7", bg: "#f8d7da" },
};
const LOOKUP_STATE_KEY = Symbol("vehiculo_solvencia_lookup_state");

/**
 * Returns true when the document can still be edited (new or unsaved).
 */
function isFormEditable(frm) {
	if (typeof frm.is_new === "function") {
		return frm.is_new();
	}
	return Boolean(frm.doc && frm.doc.__islocal);
}

/**
 * Applies the configured CSS overrides to each control.
 */
function styleField(frm, fieldname, { input, label }) {
	const field = frm.get_field(fieldname);
	if (!field) {
		return;
	}

	if (input) {
		if (field.$input && field.$input.length) {
			field.$input.css(input);
		}

		if (field.$wrapper && field.$wrapper.length) {
			const staticValue = field.$wrapper.find(
				".control-value, .control-value-like, .like-disabled-input"
			);
			if (staticValue && staticValue.length) {
				staticValue.css(input);
			}
		}
	}

	if (label && field.$wrapper) {
		const labelElement = field.$wrapper.find(".control-label");
		if (labelElement && labelElement.length) {
			labelElement.css(label);
			if (label["text-align"]) {
				labelElement.parent().css("text-align", label["text-align"]);
			}
		}
	}
}

/**
 * Applies UI polish to targeted controls on refresh.
 */
function applyFieldStyles(frm) {
	Object.entries(FIELD_STYLE_CONFIG).forEach(([fieldname, config]) => {
		styleField(frm, fieldname, config);
	});
}

/**
 * Enables/disables editable controls depending on doc state.
 */
function toggleEditableFields(frm, isEditable) {
	EDITABLE_FIELDS.forEach((fieldname) => {
		frm.toggle_enable(fieldname, isEditable);
	});

	if (isEditable) {
		frm.enable_save();
	} else {
		frm.disable_save();
	}
}

/** Basic HTML escape helper with a frappe fallback. */
function escapeHtml(value) {
	if (typeof value !== "string") {
		return value;
	}
	if (frappe.utils && frappe.utils.escape_html) {
		return frappe.utils.escape_html(value);
	}

	return value.replace(/[&<>"']/g, (char) => {
		const map = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		};
		return map[char] || char;
	});
}

/** Removes HTML tags from a string. */
function stripHtml(value) {
	if (typeof value !== "string") {
		return value;
	}

	if (frappe.utils && frappe.utils.strip_html) {
		return frappe.utils.strip_html(value);
	}

	return value.replace(/<[^>]*>/g, "");
}

/** Normalizes placas so lookups are consistent. */
function sanitizePlaca(value) {
	return (value || "").trim().toUpperCase();
}

/** Wrapper to access the detalle_multas HTML field. */
function getDetalleMultasField(frm) {
	return frm.get_field("detalle_multas");
}

/**
 * Retains lookup context between async calls to prevent stale updates.
 */
function getLookupState(frm) {
	if (!frm[LOOKUP_STATE_KEY]) {
		frm[LOOKUP_STATE_KEY] = {
			lastRequestId: 0,
			lastRenderedHtml: null,
			activeRequest: null,
			activePlaca: null,
		};
	}
	return frm[LOOKUP_STATE_KEY];
}

/**
 * Safely renders the detalle_multas field and caches the HTML.
 */
function setDetalleMultasHTML(frm, html) {
	if (html === undefined || html === null) {
		return;
	}

	const serialized = typeof html === "string" ? html : String(html);
	const state = getLookupState(frm);
	if (state.lastRenderedHtml === serialized) {
		return;
	}

	const field = getDetalleMultasField(frm);
	if (field && field.$wrapper && field.$wrapper.length) {
		field.$wrapper.html(serialized);
	}
	state.lastRenderedHtml = serialized;
	persistDetalleMultasValue(frm, serialized);
}

/**
 * Persists the rendered HTML, so reloads show the previous result.
 */
function persistDetalleMultasValue(frm, html) {
	if (html === undefined || html === null) {
		return;
	}

	const serialized = typeof html === "string" ? html : String(html);
	if (frm.doc.multas_db === serialized) {
		return;
	}

	void frm.set_value("multas_db", serialized);
}

/** Renders inline alerts with the shared color palette. */
function renderMessage(text, tone = "muted") {
	const palette = MESSAGE_PALETTE[tone] || MESSAGE_PALETTE.muted;

	return `<div style="padding:12px;border:1px solid ${palette.border};border-radius:4px;background:${palette.bg};color:${palette.text};">${escapeHtml(
			text
		)}</div>`;
}

/** Formats dates with a safe fallback when no value is present. */
function formatDate(value) {
	if (!value) {
		return __("Sin fecha");
	}
	return frappe.format(value, { fieldtype: "Date" });
}

/** Formats currency or returns raw values when formatting fails. */
function formatCurrency(value) {
	if (value === undefined || value === null) {
		return __("Sin valor");
	}
	try {
		const formatted = frappe.format(
			value,
			{ fieldtype: "Currency" },
			undefined,
			{
				only_value: true,
			}
		);
		const plain = stripHtml(formatted);
		return plain ? plain.trim() : formatted;
	} catch (error) {
		// Fallback to the raw value if format fails for any reason.
			return String(value);
	}
}

/**
 * Enriches the PMT Boleta rows with articulo descriptions via bulk query.
 */
async function attachArticuloDescriptions(records) {
	if (!Array.isArray(records) || !records.length) {
		return records || [];
	}

	const uniqueCodes = [
		...new Set(
			records
				.map((record) => (record?.articulo_codigo || "").trim())
				.filter(Boolean)
		),
	];

	if (!uniqueCodes.length) {
		return records;
	}

	try {
		const articulos = await frappe.db.get_list("PMT Articulo", {
			filters: {
				name: ["in", uniqueCodes],
			},
			fields: ["name", "articulo_descripcion"],
			limit: uniqueCodes.length,
		});

		const articuloMap = articulos.reduce((acc, articulo) => {
			acc[articulo.name] = articulo.articulo_descripcion || "";
			return acc;
		}, {});

		return records.map((record) => ({
			...record,
			articulo_descripcion:
				articuloMap[record.articulo_codigo] || record.articulo_descripcion || null,
		}));
	} catch (error) {
		console.warn("No se pudieron cargar los artículos relacionados:", error);
		return records;
	}
}

/**
 * Renders the detail table with article info and stored saldos.
 */
function buildMultasTable(records, placa) {
	const header = __(
		"{0} boleta(s) pendiente(s) para la placa {1}.",
		[records.length, placa]
	);
	let totalSaldoRegistrado = 0;
	const rows = records
		.map((record) => {
			const boleta = record.boleta_id || record.name || "-";
			const fecha = formatDate(record.fecha_infraccion);
			const articulo = record.articulo_codigo || __("Sin artículo");
			const articuloDescripcion =
				record.articulo_descripcion || __("Sin descripción");
			const principal = Number(record.articulo_valor) || 0;
			const cargoOriginal = formatCurrency(principal);
			const saldoRegistrado = Number(
				record.infraccion_saldo ?? record.articulo_valor ?? 0
			);
			totalSaldoRegistrado += saldoRegistrado;
			const saldoFormatted = formatCurrency(saldoRegistrado);
			return `<tr>
				<td>${escapeHtml(String(boleta))}</td>
				<td>${escapeHtml(fecha)}</td>
				<td>${escapeHtml(articulo)}</td>
				<td>${escapeHtml(articuloDescripcion)}</td>
				<td>${escapeHtml(cargoOriginal)}</td>
				<td>${escapeHtml(saldoFormatted)}</td>
			</tr>`;
		})
		.join("");
	const totalRow = `
		<tr>
			<td colspan="5" style="text-align:right;font-weight:600;border-top:2px solid #dee2e6;">
				${escapeHtml(__("Total Saldo Registrado"))}
			</td>
			<td style="color:#dc3545;font-weight:700;border-top:2px solid #dee2e6;">
				${escapeHtml(formatCurrency(totalSaldoRegistrado))}
			</td>
		</tr>
	`;

	return `
		<div style="margin-bottom:8px;font-weight:600;">${escapeHtml(header)}</div>
		<div class="table-responsive">
			<table class="table table-sm table-bordered">
				<thead>
					<tr>
						<th>${__("Boleta")}</th>
						<th>${__("Fecha de infracción")}</th>
						<th>${__("Artículo")}</th>
						<th>${__("Detalle artículo")}</th>
						<th>${__("Cargo Original")}</th>
						<th>${__("Saldo Registrado")}</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
				<tfoot>${totalRow}</tfoot>
			</table>
		</div>
	`;
}

/**
 * Keeps the es_solvente field styling aligned with the current state.
 */
function applyEsSolventeStyles(field, { color = "", background = "" } = {}) {
	if (!field || !field.$wrapper) {
		return;
	}

	const targets = [];
	if (field.$input && field.$input.length) {
		targets.push(field.$input);
	}

	const staticValue = field.$wrapper.find(
		".control-value, .control-value-like, .like-disabled-input"
	);
	if (staticValue && staticValue.length) {
		targets.push(staticValue);
	}

	targets.forEach(($el) => {
		$el.css({
			color,
			"text-align": "center",
			"font-size": "18px",
			"font-weight": "bold",
			"background-color": background || "",
		});
	});
}

/**
 * Updates the es_solvente value, style, and receipt editability.
 */
async function updateEsSolventeStatus(frm, state) {
	const field = frm.get_field("es_solvente");
	if (!field) {
		return;
	}

	let value = null;
	let color = "";
	let background = "";
	if (state === "insolvente") {
		value = __("INSOLVENTE");
		color = "#dc3545";
		background = "#f8d7da";
	} else if (state === "solvente") {
		value = __("SOLVENTE");
		color = "#198754";
		background = "#d1e7dd";
	}

	try {
		await frm.set_value("es_solvente", value);
	} catch (error) {
		// Ignore failures; styling will still apply.
	}

	applyEsSolventeStyles(field, { color, background });
	const allowReceiptEditing = isFormEditable(frm) && state !== "insolvente";
	frm.toggle_enable("recibo_pago", allowReceiptEditing);
}

/**
 * Fetches pending fines, enriches them, and renders the detail table.
 */
async function buscarMultasPendientes(frm) {
	const placa = sanitizePlaca(frm.doc.placa_vehiculo_buscar);
	const state = getLookupState(frm);

	if (!placa) {
		state.lastRequestId += 1;
		state.activePlaca = null;
		state.activeRequest = null;
		setDetalleMultasHTML(
			frm,
			renderMessage(
				__("Ingrese una placa para consultar las boletas pendientes."),
				"warning"
			)
		);
		await updateEsSolventeStatus(frm, null);
		return;
	}

	if (state.activeRequest && state.activePlaca === placa) {
		return state.activeRequest;
	}

	const requestId = ++state.lastRequestId;
	setDetalleMultasHTML(
		frm,
		renderMessage(
			__("Buscando boletas pendientes para la placa {0}…", [placa])
		)
	);

	const lookupPromise = (async () => {
		try {
			const records = await frappe.db.get_list("PMT Boleta", {
				filters: {
					vehiculo_id: placa,
					estado_boleta: ["in", PENDING_PAYMENT_STATE],
				},
				fields: MULTA_FIELDS,
				order_by: "fecha_infraccion desc",
				limit: MULTAS_RESULT_LIMIT,
			});

			if (requestId !== state.lastRequestId) {
				return;
			}

			if (!records.length) {
				setDetalleMultasHTML(
					frm,
					renderMessage(
						__(
							"No se encontraron boletas pendientes para la placa {0}.",
							[placa]
						),
						"success"
					)
				);
				await updateEsSolventeStatus(frm, "solvente");
				return;
			}

			const enrichedRecords = await attachArticuloDescriptions(records);
			if (requestId !== state.lastRequestId) {
				return;
			}

			setDetalleMultasHTML(frm, buildMultasTable(enrichedRecords, placa));
			await updateEsSolventeStatus(frm, "insolvente");
		} catch (error) {
			if (requestId !== state.lastRequestId) {
				return;
			}

			const description = error?.message || error || __("Error desconocido");
			setDetalleMultasHTML(
				frm,
				renderMessage(
					__(
						"No se pudieron consultar las boletas pendientes. Detalle: {0}",
						[String(description)]
					),
					"danger"
				)
			);
			await updateEsSolventeStatus(frm, null);
		}
	})();

	state.activePlaca = placa;
	state.activeRequest = lookupPromise;
	lookupPromise.finally(() => {
		if (state.activeRequest === lookupPromise) {
			state.activeRequest = null;
			state.activePlaca = null;
		}
	});

	return lookupPromise;
}

/** Restores the stored multas HTML when reopening a document. */
function restoreDetalleMultasFromDb(frm) {
	const savedHtml = frm.doc.multas_db;
	if (!savedHtml) {
		return;
	}

	setDetalleMultasHTML(frm, savedHtml);
}

function addSolvenciaPdfButton(frm) {
	if (frm.is_new()) {
		return;
	}

	const estado = (frm.doc.es_solvente || "").trim().toUpperCase();
	if (estado !== "SOLVENTE") {
		return;
	}

	frm.add_custom_button(__("Generar PDF"), () => {
		const printFormat = "PMT Vehiculo Solvencia Base";
		const url = frappe.urllib.get_full_url(
			`/api/method/frappe.utils.print_format.download_pdf?doctype=${encodeURIComponent(
				frm.doc.doctype
			)}&name=${encodeURIComponent(frm.doc.name)}&format=${encodeURIComponent(printFormat)}`
		);

		const w = window.open(url);
		if (!w) {
			frappe.msgprint(__("Please enable pop-ups"));
		}
	});
}

// ------------------------------ Form lifecycle ------------------------------
frappe.ui.form.on("PMT Vehiculo Solvencia", {
	refresh(frm) {
		applyFieldStyles(frm);
		frm.set_df_property("es_solvente", "hidden", 0);
		frm.toggle_enable("marca_vehiculo", false);
		frm.toggle_enable("es_solvente", false);
		frm.toggle_enable("detalle_multas", false);
		frm.set_df_property("multas_db", "hidden", 1);
		toggleEditableFields(frm, isFormEditable(frm));
		restoreDetalleMultasFromDb(frm);
		addSolvenciaPdfButton(frm);
		void buscarMultasPendientes(frm);
	},
	placa_vehiculo_buscar(frm) {
		void buscarMultasPendientes(frm);
	},
	validate(frm) {
		if (frm.doc.es_solvente === __("INSOLVENTE")) {
			frappe.throw(
				__(
					"No puede guardar la solicitud mientras existan boletas pendientes. Resuelva las boletas antes de continuar."
				)
			);
		}
	},
});
