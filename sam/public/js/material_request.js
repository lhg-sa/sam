frappe.ui.form.on("Material Request", {
  onload(frm) {
    //frappe.msgprint("Bienvenido al doctype Material Request");
    set_custom_unidad_filter(frm);
  },
  refresh(frm) {
    set_custom_unidad_filter(frm);
  },
  async before_save(frm) {
    await run_before_save_hooks(frm);
  },
});

function set_custom_unidad_filter(frm) {
  if (!frm.fields_dict.custom_unidad) {
    console.warn("custom_unidad no existe en el formulario de Material Request");
    return;
  }

  frm.set_query("custom_unidad", () => ({
    query: "sam.api.department.departments_for_expense_approver",
    filters: {
      user: frappe.session.user,
    },
  }));
}

async function run_before_save_hooks(frm) {
  const items = Array.isArray(frm.doc.items) ? frm.doc.items : [];
  const itemCodes = Array.from(
    new Set(
      items
        .map((row) => row.item_code)
        .filter((code) => typeof code === "string" && code.trim())
    )
  );
  let foundMap = {};
  if (itemCodes.length) {
    try {
      const rows = await frappe.db.get_list("Item", {
        fields: ["name", "custom_renglon"],
        filters: {
          name: ["in", itemCodes],
        },
        limit: itemCodes.length,
      });
      foundMap = rows.reduce((acc, row) => {
        acc[row.name] = row.custom_renglon || "";
        return acc;
      }, {});
    } catch (error) {
      console.warn("No se pudo consultar Item:", error);
    }
  }
  const itemRenglones = Array.from(
    new Set(Object.values(foundMap).filter((value) => value))
  );
  let presupuestoMap = {};
  if (itemRenglones.length) {
    try {
      const rows = await frappe.db.get_list("DAFIM Presupuesto", {
        fields: ["presupuesto_renglon", "presupuesto_asignado"],
        filters: {
          presupuesto_renglon: ["in", itemRenglones],
        },
        limit: itemRenglones.length,
      });
      presupuestoMap = rows.reduce((acc, row) => {
        if (!acc[row.presupuesto_renglon]) {
          acc[row.presupuesto_renglon] = row.presupuesto_asignado || "";
        }
        return acc;
      }, {});
    } catch (error) {
      console.warn("No se pudo consultar DAFIM Presupuesto:", error);
    }
  }
  const requestType = (frm.doc.material_request_type || "").trim();
  const noAsignadoLabel = __("No Asignado");
  let html = "<div>";
  let hasNoAsignado = false;
  if (!items.length) {
    html += `<p>${__("Sin items para mostrar.")}</p>`;
  } else {
    html +=
      "<table class='table table-bordered'>" +
      "<thead><tr>" +
      `<th style="width: 160px;">${__("Item Code")}</th>` +
      `<th>${__("Item Name")}</th>` +
      `<th style="width: 180px;">${__("Renglon (Item)")}</th>` +
      `<th style="width: 200px;">${__("Presupuesto Disponible")}</th>` +
      "</tr></thead><tbody>";
    items.forEach((row) => {
      const itemCode = row.item_code || "";
      const itemRenglon = foundMap[itemCode] || "";
      const presupuestoAsignado =
        itemRenglon && Object.prototype.hasOwnProperty.call(presupuestoMap, itemRenglon)
          ? presupuestoMap[itemRenglon]
          : noAsignadoLabel;
      const isNoAsignado = presupuestoAsignado === noAsignadoLabel;
      if (isNoAsignado) {
        hasNoAsignado = true;
      }
      html +=
        `<tr${isNoAsignado ? " style='background-color:rgba(255,247,204,0.2);'" : ""}>` +
        `<td>${frappe.utils.escape_html(itemCode)}</td>` +
        `<td>${frappe.utils.escape_html(row.item_name || "")}</td>` +
        `<td>${frappe.utils.escape_html(itemRenglon)}</td>` +
        `<td>${isNoAsignado
          ? "<span style='color:#b30000;font-weight:700;'>" +
            frappe.utils.escape_html(noAsignadoLabel) +
            "</span>"
          : frappe.utils.escape_html(presupuestoAsignado)
        }</td>` +
        "</tr>";
    });
    html += "</tbody></table>";
  }
  html += "</div>";

  if (!hasNoAsignado) {
    return;
  }

  switch (requestType) {
    case "Purchase":    
      frappe.validated = false;
      html =
        "<div style='color:#b30000;font-size:18px;font-weight:700;margin-bottom:12px;'>" +
        __("Su solicitud no puede ser procesada por no contar con el/los renglon(es) presupuestario(s) requerido(s)...") +
        "</div>" +
        html;
      break;
    case "Material Issue":
      // Show dialog but allow save.
      html =
        "<div style='color:#1a7f37;font-size:18px;font-weight:700;margin-bottom:12px;'>" +
        __("Su solicitud se procesara pero requiere una autorizacion adicional...") +
        "</div>" +
        html;
      break;
    default:
      break;
  }

  const dialog = new frappe.ui.Dialog({
    title: __("Items antes de guardar"),
    fields: [
      {
        fieldtype: "HTML",
        fieldname: "items_preview",
      },
    ],
    primary_action_label: __("Cerrar"),
    primary_action() {
      dialog.hide();
    },
  });

  dialog.set_value("items_preview", html);
  dialog.show();
}
