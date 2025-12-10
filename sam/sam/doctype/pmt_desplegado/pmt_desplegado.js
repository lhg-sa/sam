// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

// frappe.ui.form.on("PMT Desplegado", {
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
	nombre_infractor: {
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
	"marca_vehiculo",
	"nombre_infractor",
	"ubicacion_infraccion",
	"observaciones",
];
const EDITABLE_FIELDS = ["placa_vehiculo_buscar"];
const MESSAGE_PALETTE = {
	muted: { text: "#495057", border: "#dee2e6", bg: "#f8f9fa" },
	success: { text: "#0f5132", border: "#badbcc", bg: "#d1e7dd" },
	warning: { text: "#664d03", border: "#ffe69c", bg: "#fff3cd" },
	danger: { text: "#842029", border: "#f5c2c7", bg: "#f8d7da" },
};
const LOOKUP_STATE_KEY = Symbol("vehiculo_solvencia_lookup_state");
const SUMMARY_FIELDNAMES = ["marca_vehiculo", "nombre_infractor"];

/**
 * Returns true when the doc is still in editable/new state.
 */
function isFormEditable(frm) {
	if (typeof frm.is_new === "function") {
		return frm.is_new();
	}
	return Boolean(frm.doc && frm.doc.__islocal);
}

/**
 * Applies the CSS overrides defined in FIELD_STYLE_CONFIG to a field.
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
 * Applies UI polish to the configured fields on every refresh.
 */
function applyFieldStyles(frm) {
	Object.entries(FIELD_STYLE_CONFIG).forEach(([fieldname, config]) => {
		styleField(frm, fieldname, config);
	});
}

/**
 * Enables or disables editable controls based on doc state.
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

/**
 * Escapes HTML when frappe.utils is not present (e.g. tests).
 */
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

/**
 * Removes HTML tags from a string with a frappe fallback.
 */
function stripHtml(value) {
	if (typeof value !== "string") {
		return value;
	}

	if (frappe.utils && frappe.utils.strip_html) {
		return frappe.utils.strip_html(value);
	}

	return value.replace(/<[^>]*>/g, "");
}

/**
 * Normalizes placas to uppercase without leading/trailing spaces.
 */
function sanitizePlaca(value) {
	return (value || "").trim().toUpperCase();
}

/** Convenience accessor for the detalle_multas HTML field. */
function getDetalleMultasField(frm) {
	return frm.get_field("detalle_multas");
}

/**
 * Stores contextual info between async lookups to avoid stale renders.
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

async function clearSummaryFields(frm) {
	const updates = SUMMARY_FIELDNAMES.filter((fieldname) => frm.doc?.[fieldname])
		.map((fieldname) => {
			if (frm.get_field(fieldname)) {
				return frm.set_value(fieldname, "");
			}
			return null;
		})
		.filter(Boolean);

	if (!updates.length) {
		return;
	}

	try {
		await Promise.all(updates);
	} catch (error) {
		console.warn("No se pudieron limpiar los campos del resumen:", error);
	}
}

async function syncSummaryFieldsFromRecords(frm, records) {
	if (!Array.isArray(records) || !records.length) {
		await clearSummaryFields(frm);
		return { marca: "", infractor: "" };
	}

	const [firstRecord] = records;
	const summary = {
		marca: firstRecord?.marca_vehiculo || frm.doc?.marca_vehiculo || "",
		infractor: firstRecord?.nombre_infractor || frm.doc?.nombre_infractor || "",
	};

	const updates = [];
	if (
		firstRecord?.marca_vehiculo &&
		firstRecord.marca_vehiculo !== frm.doc?.marca_vehiculo &&
		frm.get_field("marca_vehiculo")
	) {
		updates.push(frm.set_value("marca_vehiculo", firstRecord.marca_vehiculo));
	}
	if (
		firstRecord?.nombre_infractor &&
		firstRecord.nombre_infractor !== frm.doc?.nombre_infractor &&
		frm.get_field("nombre_infractor")
	) {
		updates.push(frm.set_value("nombre_infractor", firstRecord.nombre_infractor));
	}

	if (updates.length) {
		try {
			await Promise.all(updates);
		} catch (error) {
			console.warn("No se pudieron sincronizar los campos del resumen:", error);
		}
	}

	return summary;
}

/**
 * Renders the detalle_multas HTML, avoiding unnecessary DOM writes.
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
 * Saves the rendered HTML to the hidden storage field for persistence.
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

/**
 * Displays contextual feedback using a simple color-coded palette.
 */
function renderMessage(text, tone = "muted") {
	const palette = MESSAGE_PALETTE[tone] || MESSAGE_PALETTE.muted;

	return `<div style="padding:12px;border:1px solid ${palette.border};border-radius:4px;background:${palette.bg};color:${palette.text};">${escapeHtml(
			text
		)}</div>`;
}

/** Formats a date or returns a friendly fallback. */
function formatDate(value) {
	if (!value) {
		return __("Sin fecha");
	}
	return frappe.format(value, { fieldtype: "Date" });
}

/** Formats currency while remaining resilient to formatter failures. */
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
 * Fetches articulo descriptions in bulk to avoid N+1 queries when rendering.
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
 * Renders the detail table using stored saldo values.
 */
function buildMultasTable(records, placa) {
	let totalSaldoRegistrado = 0;
	const rows = records
		.map((record) => {
			const boleta = record.boleta_id || record.name || "-";
			const fecha = formatDate(record.fecha_infraccion);
			const infractor =
				record.nombre_infractor || __("Sin nombre registrado");
			const articulo = record.articulo_codigo || __("Sin artículo");
			const articuloDescripcion =
				record.articulo_descripcion || __("Sin descripción");
			const ubicacion = record.ubicacion_infraccion || __(
				"Sin ubicación registrada"
			);
			const observaciones = record.observaciones || __("Sin observaciones");
			const principal = Number(record.articulo_valor) || 0;
			const cargoOriginal = formatCurrency(principal);
			const saldoRegistrado = Number(
				record.infraccion_saldo ?? record.articulo_valor ?? 0
			);
			totalSaldoRegistrado += saldoRegistrado;
			const saldoFormatted = formatCurrency(saldoRegistrado);
			return `<tr>
				<td style="vertical-align:top;">${escapeHtml(String(boleta))}</td>
				<td style="vertical-align:top;">${escapeHtml(fecha)}</td>
				<td style="vertical-align:top;">${escapeHtml(infractor)}</td>
				<td style="vertical-align:top;">
					<div style="font-weight:600;">${escapeHtml(articulo)}</div>
					<div style="font-size:11px;color:#6c757d;">${escapeHtml(articuloDescripcion)}</div>
				</td>
				<td style="vertical-align:top;">${escapeHtml(ubicacion)}</td>
				<td style="vertical-align:top;">${escapeHtml(observaciones)}</td>
				<td style="vertical-align:top;">${escapeHtml(cargoOriginal)}</td>
				<td style="vertical-align:top;">${escapeHtml(saldoFormatted)}</td>
			</tr>`;
		})
		.join("");
	const totalRow = `
		<tr>
			<td colspan="7" style="text-align:right;font-weight:600;border-top:2px solid #dee2e6;">
				${escapeHtml(__("Total Saldo Registrado"))}
			</td>
			<td style="color:#dc3545;font-weight:700;border-top:2px solid #dee2e6;">
				${escapeHtml(formatCurrency(totalSaldoRegistrado))}
			</td>
		</tr>
	`;
	return `
		<div class="table-responsive" style="max-height:60vh;overflow:auto;">
			<table class="table table-sm table-bordered" style="font-size:12px;table-layout:fixed;word-break:break-word;">
				<thead>
					<tr>
						<th>${__("Boleta")}</th>
						<th>${__("Fecha de infracción")}</th>
						<th>${__("Nombre del infractor")}</th>
						<th>${__("Artículo y Detalle")}</th>
						<th>${__("Ubicación de infracción")}</th>
						<th>${__("Observaciones")}</th>
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
 * Keeps the es_solvente field visually aligned with the current status.
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
 * Synchronizes the es_solvente indicator and disables editing if needed.
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
}

/**
 * Main lookup routine that fetches pending fines and renders the table.
 */
async function buscarMultasPendientes(frm) {
	const placa = sanitizePlaca(frm.doc.placa_vehiculo_buscar);
	const state = getLookupState(frm);

	if (!placa) {
		state.lastRequestId += 1;
		state.activePlaca = null;
		state.activeRequest = null;
		await clearSummaryFields(frm);
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
				await clearSummaryFields(frm);
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

			await syncSummaryFieldsFromRecords(frm, enrichedRecords);
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

/**
 * Restores the stored HTML when reloading an already processed record.
 */
function restoreDetalleMultasFromDb(frm) {
	const savedHtml = frm.doc.multas_db;
	if (!savedHtml) {
		return;
	}

	setDetalleMultasHTML(frm, savedHtml);
}

/**
 * Saves the document and opens the standard print view in a new tab.
 */
async function handleSaveAndPrint(frm) {
	try {
		await frm.save();
	} catch (error) {
		frappe.msgprint({
			title: __("Error"),
			message: __(
				"No se pudo guardar antes de imprimir. Detalle: {0}",
				[error?.message || error]
			),
			indicator: "red",
		});
		return;
	}

	const docname = frm.doc?.name;
	if (!docname) {
		return;
	}

	const printUrl =
		(frappe.utils && frappe.utils.get_print_url
			? frappe.utils.get_print_url(frm.doctype, docname)
			: `/printview?doctype=${encodeURIComponent(frm.doctype)}&name=${encodeURIComponent(
					docname
				)}`) + "&trigger_print=1";

	window.open(printUrl, "_blank");
}

/**
 * Registers the custom action button once per form lifecycle.
 */
function addSaveAndPrintButton(frm) {
	if (!frm.page) {
		return;
	}

	if (frm.custom_save_print_btn && frm.custom_save_print_btn.length) {
		frm.custom_save_print_btn.remove();
		frm.custom_save_print_btn = null;
	}

	frm.custom_save_print_btn = frm.page.add_inner_button(
		__("Guardar e Imprimir"),
		() => {
			void handleSaveAndPrint(frm);
		}
	);
}

function addNuevaConsultaButton(frm) {
	if (!frm.page) {
		return;
	}

	if (frm.custom_new_query_btn && frm.custom_new_query_btn.length) {
		frm.custom_new_query_btn.remove();
		frm.custom_new_query_btn = null;
	}

	frm.custom_new_query_btn = frm.page.add_inner_button(
		__("Nueva Consulta"),
		() => {
			const fieldsToClear = [
				"placa_vehiculo_buscar",
				"marca_vehiculo",
				"nombre_infractor",
				"es_solvente",
				"detalle_multas",
				"multas_db",
			];

			fieldsToClear.forEach((fieldname) => {
				if (frm.get_field(fieldname)) {
					frm.set_value(fieldname, "");
				}
			});

			setDetalleMultasHTML(frm, "");
			void updateEsSolventeStatus(frm, null);

			frappe.after_ajax(() => {
				const field = frm.get_field("placa_vehiculo_buscar");
				if (field?.$input?.length) {
					field.$input.focus();
				}
			});
		}
	);
}

// ------------------------------ Form lifecycle ------------------------------
frappe.ui.form.on("PMT Desplegado", {
	refresh(frm) {
		applyFieldStyles(frm);
		frm.set_df_property("es_solvente", "hidden", 0);
		frm.toggle_enable("marca_vehiculo", false);
		frm.toggle_enable("nombre_infractor", false);
		frm.toggle_enable("es_solvente", false);
		frm.toggle_enable("detalle_multas", false);
		frm.set_df_property("multas_db", "hidden", 1);
		toggleEditableFields(frm, isFormEditable(frm));
		restoreDetalleMultasFromDb(frm);
		addSaveAndPrintButton(frm);
		addNuevaConsultaButton(frm);
		void buscarMultasPendientes(frm);
	},
	placa_vehiculo_buscar(frm) {
		void buscarMultasPendientes(frm);
	},
});
