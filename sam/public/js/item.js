frappe.ui.form.on("Item", {
  onload(frm) {
    //frappe.msgprint("Bienvenido al módulo Item");
  },
  refresh(frm) {
    frm.add_custom_button(__("Catalogo"), () => {
      if (!frm.catalogo_dialog) {
        frm.catalogo_dialog = new frappe.ui.Dialog({
          title: __("Catalogo"),
          fields: [
            {
              fieldtype: "Data",
              fieldname: "buscar_insumo",
              label: __("Buscar insumo"),
              reqd: 0
            },
            {
              fieldtype: "HTML",
              fieldname: "buscar_insumo_label"
            },
            {
              fieldtype: "HTML",
              fieldname: "catalogo_table"
            }
          ]
        });
        frm.catalogo_dialog.$wrapper
          .find(".modal-dialog")
          .css("max-width", "1100px");

        const pageSize = 10;
        frm.catalogo_dialog.catalogo_state = {
          page: 0,
          total: 0,
          texto: ""
        };

        frm.catalogo_dialog.build_table = (rows, page, total) => {
          const headers = [
            __("ID"),
            __("Nombre"),
            __("Renglon"),
            __("Presentacion"),
            __("UDM"),
            __("Accion")
          ];
          let html = "<table class='table table-bordered'>";
          html += "<thead><tr>";
          headers.forEach((header) => {
            html += `<th>${header}</th>`;
          });
          html += "</tr></thead><tbody>";
          if (!rows || rows.length === 0) {
            html += `<tr><td colspan="5">${__("Sin resultados")}</td></tr>`;
          } else {
            rows.forEach((row) => {
              html += "<tr>";
              const caracteristicas = frappe.utils.escape_html(
                row.caracteristicas || ""
              );
              html += `<td title="${caracteristicas}">${frappe.utils.escape_html(
                `${row.name || ""}`
              )}</td>`;
              html += `<td>${frappe.utils.escape_html(
                row.nombre_insumo || ""
              )}</td>`;
              html += `<td>${frappe.utils.escape_html(
                row.renglon_presupuestario || ""
              )}</td>`;
              html += `<td>${frappe.utils.escape_html(
                row.presentacion || ""
              )}</td>`;
              html += `<td>${frappe.utils.escape_html(
                row.udm_insumo || ""
              )}</td>`;
              html += `<td><button class="btn btn-xs btn-primary catalogo-select"` +
                ` data-name="${frappe.utils.escape_html(row.name || "")}"` +
                ` data-codigo="${frappe.utils.escape_html(
                  `${row.codigo_insumo || ""}`
                )}"` +
                ` data-codigo-presentacion="${frappe.utils.escape_html(
                  `${row.codigo_presentacion || ""}`
                )}"` +
                ` data-nombre="${frappe.utils.escape_html(row.nombre_insumo || "")}"` +
                ` data-renglon="${frappe.utils.escape_html(row.renglon_presupuestario || "")}"` +
                ` data-presentacion="${frappe.utils.escape_html(row.presentacion || "")}"` +
                ` data-udm="${frappe.utils.escape_html(row.udm_insumo || "")}"` +
                ` data-caracteristicas="${frappe.utils.escape_html(row.caracteristicas || "")}">` +
                `${__("Importar ID")}</button></td>`;
              html += "</tr>";
            });
          }
          html += "</tbody></table>";
          if (total > pageSize) {
            const totalPages = Math.ceil(total / pageSize);
            const prevDisabled = page <= 0 ? "disabled" : "";
            const nextDisabled =
              page >= totalPages - 1 ? "disabled" : "";
            html +=
              "<div class='catalogo-pager' " +
              "style='display:flex;gap:8px;align-items:center;" +
              "justify-content:flex-end;margin-top:8px;'>" +
              `<button class="btn btn-xs btn-default catalogo-page" ` +
              `data-page="${page - 1}" ${prevDisabled}>` +
              `${__("Anterior")}</button>` +
              `<span>${__("Pagina")} ${page + 1} ${__("de")} ` +
              `${totalPages}</span>` +
              `<button class="btn btn-xs btn-default catalogo-page" ` +
              `data-page="${page + 1}" ${nextDisabled}>` +
              `${__("Siguiente")}</button>` +
              "</div>";
          }
          return html;
        };

        frm.catalogo_dialog.load_page = (page) => {
          const texto = frm.catalogo_dialog.catalogo_state.texto || "";
          frm.catalogo_dialog.set_value(
            "catalogo_table",
            __("Buscando en el catalogo...")
          );
          frappe.call({
            method: "frappe.client.get_list",
            args: {
              doctype: "DAFIM Catalogo Insumos",
              fields: [
                "name",
                "codigo_insumo",
                "codigo_presentacion",
                "nombre_insumo",
                "renglon_presupuestario",
                "presentacion",
                "udm_insumo",
                "caracteristicas"
              ],
              filters: texto
                ? [["nombre_insumo", "like", `%${texto}%`]]
                : [],
              limit_start: page * pageSize,
              limit_page_length: pageSize
            },
            callback: (response) => {
              const rows = response && response.message ? response.message : [];
              frm.catalogo_dialog.catalogo_state.page = page;
              frm.catalogo_dialog.set_value(
                "catalogo_table",
                frm.catalogo_dialog.build_table(
                  rows,
                  page,
                  frm.catalogo_dialog.catalogo_state.total
                )
              );
            }
          });
        };

        const update_label = () => {
          const valor = frm.catalogo_dialog.get_value("buscar_insumo") || "";
          frm.catalogo_dialog.set_value(
            "buscar_insumo_label",
            `Buscar insumo: ${frappe.utils.escape_html(valor)}`
          );
        };

        frm.catalogo_dialog.fields_dict.buscar_insumo.$input.on("input", () => {
          update_label();
        });
        frm.catalogo_dialog.fields_dict.buscar_insumo.$input.on(
          "keydown",
          (event) => {
            if (event.key === "Enter") {
              const texto = frm.catalogo_dialog.get_value("buscar_insumo") || "";
              frm.catalogo_dialog.catalogo_state.texto = texto;
              frm.catalogo_dialog.set_value(
                "catalogo_table",
                __("Buscando en el catalogo...")
              );
              frappe.call({
                method: "frappe.client.get_count",
                args: {
                  doctype: "DAFIM Catalogo Insumos",
                  filters: texto
                    ? [["nombre_insumo", "like", `%${texto}%`]]
                    : [],
                },
                callback: (response) => {
                  const total =
                    response && typeof response.message === "number"
                      ? response.message
                      : 0;
                  frm.catalogo_dialog.catalogo_state.total = total;
                  frm.catalogo_dialog.load_page(0);
                }
              });
            }
          }
        );
        update_label();
        frm.catalogo_dialog.$wrapper.on("click", ".catalogo-select", (event) => {
          const button = $(event.currentTarget);
          const rowName = button.data("name");
          if (rowName) {
            frm.set_value("item_code", rowName);
            frm.set_value("custom_codigo_insumo", button.data("codigo") || "");
            frm.set_value(
              "custom_codigo_presentacion",
              button.data("codigo-presentacion") || ""
            );
            frm.set_value("item_name", button.data("nombre") || "");
            frm.set_value("custom_renglon", button.data("renglon") || "");
            frm.set_value("custom_presentacion", button.data("presentacion") || "");
            frm.set_value("stock_uom", button.data("udm") || "");
            frm.set_value("custom_caracteristicas", button.data("caracteristicas") || "");
            frm.catalogo_dialog.hide();
          }
        });
        frm.catalogo_dialog.$wrapper.on("click", ".catalogo-page", (event) => {
          const target = $(event.currentTarget);
          if (target.is(":disabled")) {
            return;
          }
          const page = parseInt(target.data("page"), 10);
          if (!Number.isNaN(page) && page >= 0) {
            frm.catalogo_dialog.load_page(page);
          }
        });
      }

      frm.catalogo_dialog.set_value("catalogo_table", "");
      frm.catalogo_dialog.show();
    });
  }
});
