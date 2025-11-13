// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

const FIELD_STYLE_CONFIG = {
	placa_vehiculo: {
		input: {
			"font-size": "20px",
			color: "red",
			border: "2px solid green",
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
			"font-size": "40px",
			"text-align": "center",
		},
		label: {
			display: "block",
			width: "100%",
			"text-align": "center",
			float: "none",
		},
	},
};

const RESET_FIELDNAMES = ["placa_vehiculo", "marca_vehiculo", "recibo_pago"];
const RESULT_LIMIT = 50;

function styleField(frm, fieldname, { input, label }) {
	const field = frm.get_field(fieldname);
	if (!field) {
		return;
	}

	if (input && field.$input) {
		field.$input.css(input);
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

function applyFieldStyles(frm) {
	Object.entries(FIELD_STYLE_CONFIG).forEach(([fieldname, config]) => {
		styleField(frm, fieldname, config);
	});
}

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

function focusFieldInput(frm, fieldname) {
	const field = frm.get_field(fieldname);
	if (field && field.$input) {
		frappe.after_ajax(() => {
			setTimeout(() => field.$input.focus(), 0);
		});
	}
}

function getEsSolventeState(state) {
	if (state === "insolvente") {
		return { value: __("INSOLVENTE"), color: "red" };
	}

	if (state === "solvente") {
		return { value: __("SOLVENTE"), color: "green" };
	}

	return { value: null, color: "" };
}

function applyEsSolventeStyle(field, color) {
	if (field.$input) {
		field.$input.css({
			color: color || "",
			"font-size": "40px",
			"text-align": "center",
		});
		field.$input.closest(".control-input-wrapper, .control-input").css({
			"text-align": "center",
		});
	}

	const displayValue = field.$wrapper?.find(".control-value");
	if (displayValue && displayValue.length) {
		displayValue
			.css({
				color: color || "",
				"font-size": "40px",
				"text-align": "center",
				display: "block",
			})
			.parent()
			.css("text-align", "center");
	}
}

async function updateEsSolventeStatus(frm, state) {
	const field = frm.get_field("es_solvente");
	if (!field) {
		return;
	}

	const { value, color } = getEsSolventeState(state);
	try {
		await Promise.resolve(frm.set_value("es_solvente", value));
	} catch (error) {
		// Ignore failures here; styling will still run and the value may remain unchanged.
	}
	applyEsSolventeStyle(field, color);
}

async function resetFormFields(frm) {
	const fieldUpdates = RESET_FIELDNAMES.map((fieldname) => {
		if (frm.fields_dict[fieldname]) {
			return Promise.resolve(frm.set_value(fieldname, null));
		}
		return Promise.resolve();
	});

	await Promise.all(fieldUpdates);
	await updateEsSolventeStatus(frm, null);
	frm.refresh_fields(RESET_FIELDNAMES.concat("es_solvente"));
	focusFieldInput(frm, "placa_vehiculo");
}

function buildResultsTableBody(records) {
	return records
		.map((record) => {
			const nombre = escapeHtml(record.name);
			const fechaInfraccion = record.fecha_infraccion
				? escapeHtml(frappe.format(record.fecha_infraccion, { fieldtype: "Date" }))
				: __("Sin fecha");
			const estadoBoleta =
				record.estado_boleta && record.estado_boleta.trim()
					? escapeHtml(record.estado_boleta)
					: __("Sin estado");
			const articuloCodigo =
				record.articulo_codigo && record.articulo_codigo.trim()
					? escapeHtml(record.articulo_codigo)
					: __("Sin artículo");

			return `<tr><td>${nombre}</td><td>${fechaInfraccion}</td><td>${estadoBoleta}</td><td>${articuloCodigo}</td></tr>`;
		})
		.join("");

async function showSearchResults(frm, records, totalSolvencias) {
	if (!Array.isArray(records) || !records.length) {
		return;
	}

	const totalMessage =
		typeof totalSolvencias === "number"
			? __("Total de registros en PMT Solvencia: {0}.", [totalSolvencias])
			: __("No se pudo obtener el total de registros en PMT Solvencia.");

	const table = `<table class="table table-bordered table-sm">
		<thead>
			<tr>
				<th>${__("Boleta")}</th>
				<th>${__("Fecha de infracción")}</th>
				<th>${__("Estado")}</th>
				<th>${__("Artículo")}</th>
			</tr>
		</thead>
		<tbody>${buildResultsTableBody(records)}</tbody>
	</table>`;

	await frappe.msgprint({
		title: __("Resultado de búsqueda"),
		message: `<div>${__(
			"Se encontraron {0} boleta(s) coincidente(s).",
			[records.length]
		)}</div>${table}<div>${escapeHtml(totalMessage)}</div>`,
		indicator: "green",
	});

	await resetFormFields(frm);
}

async function mostrarErrorBusqueda() {
	await frappe.msgprint({
		title: __("Resultado de búsqueda"),
		message: __("No fue posible consultar las boletas. Intente nuevamente."),
		indicator: "red",
	});
}

async function buscarBoletasPorPlaca(frm, placa) {
	if (!placa) {
		await updateEsSolventeStatus(frm, null);
		focusFieldInput(frm, "recibo_pago");
		return;
	}

	const filters = { vehiculo_id: placa };
	const [boletasResult, totalResult] = await Promise.allSettled([
		frappe.db.get_list("PMT Boleta", {
			filters,
			fields: ["name", "fecha_infraccion", "estado_boleta", "articulo_codigo"],
			limit: RESULT_LIMIT,
		}),
		frappe.db.count("PMT Solvencia"),
	]);

	if (boletasResult.status !== "fulfilled") {
		await updateEsSolventeStatus(frm, null);
		await mostrarErrorBusqueda();
		focusFieldInput(frm, "recibo_pago");
		return;
	}

	const records = boletasResult.value || [];
	const totalSolvencias =
		totalResult.status === "fulfilled" ? totalResult.value : undefined;
	const hasMatches = records.length > 0;

	await updateEsSolventeStatus(frm, hasMatches ? "insolvente" : "solvente");

	if (hasMatches) {
		await showSearchResults(frm, records, totalSolvencias);
		return;
	}

	focusFieldInput(frm, "recibo_pago");
}

function ensurePlacaBlurHandler(frm) {
	const field = frm.get_field("placa_vehiculo");
	if (!(field && field.$input)) {
		return;
	}

	if (field.$input.data("uppercase-blur-handler")) {
		return;
	}

	field.$input.data("uppercase-blur-handler", true);
	field.$input.on("blur", () => {
		const currentValue = field.$input.val() || "";
		const upperValue = currentValue.toUpperCase();

		const ejecutarBusqueda = () => {
			void buscarBoletasPorPlaca(frm, upperValue);
		};

		if (upperValue !== currentValue) {
			field.$input.val(upperValue);
			Promise.resolve(frm.set_value("placa_vehiculo", upperValue))
				.then(() => ejecutarBusqueda())
				.catch(() => ejecutarBusqueda());
		} else {
			ejecutarBusqueda();
		}
	});
}

function addLimpiarButton(frm) {
	if (frm.__limpiar_button_added) {
		return;
	}

	frm.add_custom_button(
		__("Limpiar"),
		() => {
			void resetFormFields(frm);
		},
		__("Acciones")
	);

	frm.__limpiar_button_added = true;
}

frappe.ui.form.on("PMT Solvencia", {
	refresh(frm) {
		applyFieldStyles(frm);
		frm.set_df_property("es_solvente", "hidden", 0);
		frm.toggle_enable("es_solvente", false);

		void updateEsSolventeStatus(frm, null);
		ensurePlacaBlurHandler(frm);
		addLimpiarButton(frm);
	},
});
