// Customer client script (SAM) - validates DPI/CUI, padron lookup, formatting helpers

const SAM_CUSTOMER = {
	CUI_FIELD: "custom_cui__dpi",
	PHONE_FIELD: "custom_telefono_principal",
	UPPERCASE_FIELDS: [
		"custom_nombres",
		"custom_apellidos",
		"custom_apellido_de_casada",
		"custom_direccion_principal",
	],
	PADRON_FIELDS: [
		"name",
		"primer_nombre",
		"segundo_nombre",
		"tercer_nombre",
		"primer_apellido",
		"segundo_apellido",
		"fecha_nacimiento",
	],
	CUSTOMER_DUP_FIELDS: ["name", "custom_nombres", "custom_apellidos"],
};

frappe.ui.form.on("Customer", {
	onload(frm) {
		run_standard_bootstrap(frm);
		update_customer_name(frm);
		calculate_age(frm);
	},

	onload_post_render(frm) {
		run_standard_bootstrap(frm);
	},

	refresh(frm) {
		run_standard_bootstrap(frm);
		add_save_and_new_button(frm);
	},

	[SAM_CUSTOMER.CUI_FIELD](frm) {
		if (!frm.meta.quick_entry) {
			run_cui_side_effects(frm);
		} else {
			frm._padron_last_query = null;
		}
	},

	custom_nombres: update_customer_name,
	custom_apellidos: update_customer_name,
	custom_apellido_de_casada: update_customer_name,
	apellido_de_casada: update_customer_name,

	custom_fecha_de_nacimiento: calculate_age,

	before_save(frm) {
		normalize_fields_to_uppercase(frm, [
			...SAM_CUSTOMER.UPPERCASE_FIELDS,
			"custom_dpi_extendido_en",
			"custom_lugar_de_nacimiento",
			"custom_ocupacion",
		]);
	},

	validate(frm) {
		const cuiValue = frm.doc[SAM_CUSTOMER.CUI_FIELD];
		if (cuiValue && !cuiIsValid(cuiValue)) {
			frappe.throw(__("No se puede guardar: El CUI/DPI ingresado es inválido."));
		}

		const phone = normalize_phone(frm.doc[SAM_CUSTOMER.PHONE_FIELD]);
		if (phone && !/^\d{8}$/.test(phone)) {
			frappe.throw(
				__(
					"No se puede guardar: El teléfono principal debe contener exactamente 8 dígitos numéricos."
				)
			);
		}
	},
});

function run_standard_bootstrap(frm) {
	bind_uppercase_handlers(frm);
	bind_phone_handler(frm);
	bind_cui_input_handler(frm);
	maybe_check_padron_on_init(frm);
}

function bind_cui_input_handler(frm) {
	const control = frm.fields_dict[SAM_CUSTOMER.CUI_FIELD];
	if (!control?.$input) {
		return;
	}

	control.$input
		.off("input.samDpi")
		.on(
			"input.samDpi",
			frappe.utils.debounce(() => optimized_dpi_check(frm), 250)
		);
}

function run_cui_side_effects(frm) {
	optimized_dpi_check(frm);
	highlight_dpi_validation(frm);
	check_padron_base(frm);
}

// ---------------- Guardar & Crear Button ----------------
function add_save_and_new_button(frm) {
	const label = __("Guardar & Crear");
	frm.remove_custom_button(label);

	frm
		.add_custom_button(label, () => {
			frm
				.save()
				.then(() => {
					frappe.show_alert({
						message: __("Registro guardado exitosamente"),
						indicator: "green",
					});
					setTimeout(() => frappe.new_doc("Customer"), 500);
				})
				.catch((err) => {
					frappe.msgprint({
						title: __("Error al guardar"),
						message:
							err?.message ||
							__("Ocurrió un error al guardar el registro"),
						indicator: "red",
					});
				});
		})
		.addClass("btn-primary");
}

// ---------------- DPI Validation ----------------
function optimized_dpi_check(frm) {
	const normalized = normalize_cui(frm.doc[SAM_CUSTOMER.CUI_FIELD]);
	if (!normalized) {
		frm._padron_last_query = null;
		return;
	}

	if (normalized.length !== 13) {
		const remaining = 13 - normalized.length;
		frappe.show_alert({
			message:
				remaining > 0
					? __("El CUI/DPI debe tener exactamente 13 caracteres (faltan {0})", [
							remaining,
					  ])
					: __("El CUI/DPI debe tener exactamente 13 caracteres."),
			indicator: "yellow",
		});
		return;
}

	if (frm._sam_last_customer_lookup === normalized) {
		return;
	}
	frm._sam_last_customer_lookup = normalized;

	frappe.call({
		method: "frappe.client.get_list",
		args: {
			doctype: "Customer",
			filters: { [SAM_CUSTOMER.CUI_FIELD]: normalized },
			fields: SAM_CUSTOMER.CUSTOMER_DUP_FIELDS,
			limit_page_length: 1,
		},
		callback(r) {
			const existing = (r.message || [])[0];
			if (existing) {
				frappe.show_alert({
					message: __(
						"Registro existente encontrado con nombre: {0} {1}",
						[(existing.custom_nombres || "").toUpperCase(), (existing.custom_apellidos || "").toUpperCase()]
					),
					indicator: "red",
				});
			} else {
				frappe.show_alert({
					message: __("Registro nuevo válido!"),
					indicator: "green",
				});
			}
		},
	});

	if (cuiIsValid(normalized)) {
		check_padron_base(frm, normalized);
		check_padron_temporal(frm, normalized);
	}
}

// ---------------- Highlight DPI field ----------------
function highlight_dpi_validation(frm) {
	const value = frm.doc[SAM_CUSTOMER.CUI_FIELD];
	const control = frm.fields_dict[SAM_CUSTOMER.CUI_FIELD];
	if (!control) return;

	const valid = cuiIsValid(value);
	const description = valid ? __("✅ CUI válido") : __("❌ CUI inválido");
	frm.set_df_property(SAM_CUSTOMER.CUI_FIELD, "description", description);
	control.$wrapper && control.$wrapper.css("border", valid ? "2px solid green" : "2px solid red");
}

// ---------------- CUI Validation Function ----------------
function cuiIsValid(cui) {
	const normalized = normalize_cui(cui);
	if (!normalized || !/^[0-9]{13}$/.test(normalized)) {
		return false;
	}

	const depto = parseInt(normalized.substring(9, 11), 10);
	const muni = parseInt(normalized.substring(11, 13), 10);
	const numero = normalized.substring(0, 8);
	const verificador = parseInt(normalized.substring(8, 9), 10);

	const munisPorDepto = [
		17, 8, 16, 16, 13, 14, 19, 8, 24, 21, 9, 30, 32, 21, 8, 17, 14, 5, 11, 11, 7, 17,
	];

	if (!depto || !muni || depto > munisPorDepto.length || muni > munisPorDepto[depto - 1]) {
		return false;
	}

	let total = 0;
	for (let i = 0; i < numero.length; i++) {
		total += numero[i] * (i + 2);
	}
	return total % 11 === verificador;
}

function normalize_cui(value) {
	return (value || "").toString().trim().replace(/\s+/g, "");
}

// ---------------- Concatenate Name Fields ----------------
function update_customer_name(frm) {
	const parts = [];
	const pushUpper = (text) => {
		if (text) parts.push(text.trim().toUpperCase());
	};

	pushUpper(frm.doc.custom_nombres);
	pushUpper(frm.doc.custom_apellidos);
	pushUpper(frm.doc.custom_apellido_de_casada || frm.doc.apellido_de_casada);

	frm.set_value("customer_name", parts.join(", "));

	if (frm.doc.custom_nombres && frm.doc.custom_nombres.trim()) {
		frm.set_value("customer_type", "Individual");
		frm.set_value("customer_group", "Individual");
	}
}

// ---------------- Calculate Age ----------------
function calculate_age(frm) {
	const birth_date = frm.doc.custom_fecha_de_nacimiento;
	if (!birth_date) {
		frm.set_value("custom_edad", null);
		return;
	}

	const today = frappe.datetime.get_today();
	const diff = frappe.datetime.get_diff(today, birth_date);
	const years = diff !== null ? Math.floor(diff / 365.25) : null;
	frm.set_value("custom_edad", years);
}

// ---------------- Custom Helpers ----------------
function bind_uppercase_handlers(frm) {
	SAM_CUSTOMER.UPPERCASE_FIELDS.forEach((fieldname) => {
		const control = frm.fields_dict[fieldname];
		if (!control?.$input) return;

		control.$input
			.off("blur.samUpper")
			.on("blur.samUpper", function () {
				const upper = ($(this).val() || "").trim().toUpperCase();
				if ($(this).val() !== upper) {
					$(this).val(upper);
				}
				if (frm.doc[fieldname] !== upper) {
					frappe.model.set_value(frm.doctype, frm.doc.name, fieldname, upper);
				}
			});
	});
}

function bind_phone_handler(frm) {
	const control = frm.fields_dict[SAM_CUSTOMER.PHONE_FIELD];
	if (!control?.$input) return;

	control.$input
		.attr("inputmode", "numeric")
		.attr("pattern", "\\d*")
		.attr("maxlength", "8")
		.off("input.samPhone blur.samPhone")
		.on("input.samPhone", function () {
			const digits = (this.value || "").replace(/\D/g, "").slice(0, 8);
			if (this.value !== digits) {
				$(this).val(digits);
			}
		})
		.on("blur.samPhone", function () {
			const digits = normalize_phone($(this).val());

			if (!digits) {
				control.$wrapper.css("border", "");
				frappe.model.set_value(frm.doctype, frm.doc.name, SAM_CUSTOMER.PHONE_FIELD, "");
				return;
			}

			if (!/^\d{8}$/.test(digits)) {
				control.$wrapper.css("border", "2px solid red");
				frappe.show_alert({
					message: __("El teléfono principal debe tener exactamente 8 dígitos."),
					indicator: "red",
				});
			} else {
				control.$wrapper.css("border", "");
			}

			if (frm.doc[SAM_CUSTOMER.PHONE_FIELD] !== digits) {
				frappe.model.set_value(frm.doctype, frm.doc.name, SAM_CUSTOMER.PHONE_FIELD, digits);
			}
		});
}

function normalize_phone(value) {
	return (value || "").toString().replace(/\D/g, "").slice(0, 8);
}

function normalize_fields_to_uppercase(frm, fields) {
	fields.forEach((field) => {
		const val = frm.doc[field];
		if (typeof val === "string" && val.trim()) {
			frm.set_value(field, val.trim().toUpperCase());
		}
	});
}

function maybe_check_padron_on_init(frm) {
	if (frm.is_new()) {
		return;
	}

	if (frm.doc[SAM_CUSTOMER.CUI_FIELD] && cuiIsValid(frm.doc[SAM_CUSTOMER.CUI_FIELD])) {
		check_padron_base(frm);
		check_padron_temporal(frm);
	}
}

// ---------------- Padron Base Lookup ----------------
function check_padron_base(frm, pre_normalized_value) {
	const normalized = pre_normalized_value || normalize_cui(frm.doc[SAM_CUSTOMER.CUI_FIELD]);

	if (!normalized || normalized.length !== 13 || !cuiIsValid(normalized)) {
		return;
	}

	if (frm._padron_last_query === normalized) {
		return;
	}
	frm._padron_last_query = normalized;

	frappe
		.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Padron Base",
				filters: [["Padron Base", "cui", "=", normalized]],
				fields: SAM_CUSTOMER.PADRON_FIELDS,
				limit_page_length: 1,
			},
		})
		.then((r) => {
			const padron = (r && Array.isArray(r.message) && r.message[0]) || null;
			if (!padron) {
				return;
			}

			populate_padron_names(frm, padron);
			populate_padron_birthdate(frm, padron);

			const message = padron.primer_nombre
				? __("Si existe en el padrón. Primer nombre: {0}", [padron.primer_nombre])
				: __("Si existe en el padrón");

			frappe.show_alert({ message, indicator: "green" });
		})
		.catch((err) => {
			console.warn("Padron Base lookup error:", err);
			frappe.show_alert({
				message: __("No se pudo consultar el padrón. Revisa la consola para más detalles."),
				indicator: "orange",
			});
			frm._padron_last_query = null;
		});
}

// ---------------- Padron Temporal Lookup ----------------
function check_padron_temporal(frm, pre_normalized_value) {
	const normalized = pre_normalized_value || normalize_cui(frm.doc[SAM_CUSTOMER.CUI_FIELD]);

	if (!normalized || normalized.length !== 13 || !cuiIsValid(normalized)) {
		return;
	}

	if (frm._padron_temporal_last_query === normalized) {
		return;
	}
	frm._padron_temporal_last_query = normalized;

	frappe
		.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Padron Temporal",
				filters: { cui_temporal: normalized },
				fields: [
					"name",
					"nombre_temporal",
					"apellido_temporal",
					"nota_temporal",
					"cui_temporal",
				],
				limit_page_length: 1,
			},
		})
		.then((r) => {
			const padron = (r && Array.isArray(r.message) && r.message[0]) || null;
			if (!padron) {
				return;
			}

			const messageParts = [__("Existe en el Padrón Temporal")];
			if (padron.nombre_temporal) {
				messageParts.push(__("Nombre: {0}", [padron.nombre_temporal]));
			}
			if (padron.apellido_temporal) {
				messageParts.push(__("Apellido: {0}", [padron.apellido_temporal]));
			}
				if (padron.nota_temporal) {
					messageParts.push(__("Nota: {0}", [padron.nota_temporal]));
				}

				const temporalFirstName = (padron.nombre_temporal || "").trim().toUpperCase();
				const temporalLastName = (padron.apellido_temporal || "").trim().toUpperCase();
				const temporalCui = normalize_cui(padron.cui_temporal);

				if (temporalFirstName && frm.doc.custom_nombres !== temporalFirstName) {
					frappe.model.set_value(frm.doctype, frm.doc.name, "custom_nombres", temporalFirstName);
				}
				if (temporalLastName && frm.doc.custom_apellidos !== temporalLastName) {
					frappe.model.set_value(frm.doctype, frm.doc.name, "custom_apellidos", temporalLastName);
				}
				if (temporalCui && frm.doc.custom_dpi !== temporalCui) {
					frappe.model.set_value(frm.doctype, frm.doc.name, "custom_dpi", temporalCui);
				}

				frappe.show_alert({
					message: messageParts.join("<br>"),
					indicator: "blue",
				});
		})
		.catch((err) => {
			console.warn("Padron Temporal lookup error:", err);
			frappe.show_alert({
				message: __(
					"No se pudo consultar el padrón temporal. Revisa la consola para más detalles."
				),
				indicator: "orange",
			});
			frm._padron_temporal_last_query = null;
		});
}

function populate_padron_names(frm, padron) {
	const names = [padron.primer_nombre, padron.segundo_nombre, padron.tercer_nombre]
		.map((part) => (part || "").trim())
		.filter(Boolean)
		.join(" ")
		.toUpperCase();

	const surnames = [padron.primer_apellido, padron.segundo_apellido]
		.map((part) => (part || "").trim())
		.filter(Boolean)
		.join(" ")
		.toUpperCase();

	if (names && frm.doc.custom_nombres !== names) {
		frappe.model.set_value(frm.doctype, frm.doc.name, "custom_nombres", names);
	}
	if (surnames && frm.doc.custom_apellidos !== surnames) {
		frappe.model.set_value(frm.doctype, frm.doc.name, "custom_apellidos", surnames);
	}
}

function populate_padron_birthdate(frm, padron) {
	const birthDateRaw = (padron.fecha_nacimiento || "").trim();
	if (!birthDateRaw) {
		return;
	}

	let normalizedDate = birthDateRaw;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateRaw)) {
		const parsed = new Date(birthDateRaw);
		if (!isNaN(parsed.getTime())) {
			normalizedDate = parsed.toISOString().slice(0, 10);
		}
	}

	if (frm.doc.custom_fecha_de_nacimiento !== normalizedDate) {
		frappe.model.set_value(frm.doctype, frm.doc.name, "custom_fecha_de_nacimiento", normalizedDate);
	}
}
