// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

frappe.ui.form.on("SP Transporte", {
    refresh(frm) {
        const wrapper = frm.fields_dict?.detalle_servicios_html?.$wrapper;
        if (!wrapper) {
            console.warn("detalle_servicios_html field is missing in the form.");
            return;
        }

        const sharedCellStyle = "padding: 10px 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color);";
        const headerCellStyle = "padding: 12px 8px; border-bottom: 2px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color); text-align: left;";
        const headerConfig = [
            { label: "Name" },
            { label: "Estado Viaje" },
            { label: "Fecha Inicial" },
            { label: "Fecha Final" },
            { label: "Duración (Horas)" },
            { label: "Ubicación Inicial", noRightBorder: true }
        ];

        frappe.db
            .get_list("SP Transporte Viaje", {
                fields: ["name", "estado_viaje", "fecha_inicial", "fecha_final", "ubicacion_inicial"],
                filters: {
                    placa_vehiculo: frm.doc.name
                },
                order_by: "fecha_inicial desc, creation desc",
                limit: 25
            })
            .then(records => {
                if (!records?.length) {
                    wrapper.html(`
                        <p>No existen registros de servicios para el vehículo ${frappe.utils.escape_html(frm.doc.name || "")}.</p>
                    `);
                    return;
                }

                const tableHeader = `
                    <thead>
                        <tr style="background-color: var(--bg-light); font-weight: bold;">
                            ${headerConfig
                                .map(
                                    column =>
                                        `<th style="${headerCellStyle}${column.noRightBorder ? " border-right: none;" : ""}">${column.label}</th>`
                                )
                                .join("")}
                        </tr>
                    </thead>
                `;

                const rows = records.map((item, index) => {
                    const rowStyle = index % 2 === 0 ? "background-color: var(--bg-color);" : "background-color: var(--bg-light);";

                    let durationHours = "";
                    let durationStyle = sharedCellStyle;

                    if (item.fecha_inicial) {
                        const startDate = new Date(item.fecha_inicial);
                        const endDate = item.fecha_final ? new Date(item.fecha_final) : new Date();
                        const diffInMs = Math.max(0, endDate - startDate);
                        durationHours = (diffInMs / (1000 * 60 * 60)).toFixed(2);

                        if (!item.fecha_final) {
                            durationStyle = `${sharedCellStyle} color: red; font-weight: bold;`;
                        }
                    }

                    const ubicacionInicial = item["ubicacion_inicial"] || "";
                    let ubicacionLink = frappe.utils.escape_html(ubicacionInicial);
                    if (ubicacionInicial) {
                        const coords = ubicacionInicial.split(",").map(coord => coord.trim());
                        if (coords.length === 2 && coords[0] && coords[1]) {
                            const query = encodeURIComponent(`${coords[0]},${coords[1]}`);
                            ubicacionLink = `<a href="https://www.google.com/maps?q=${query}" target="_blank" style="color: #007bff; text-decoration: none;">${frappe.utils.escape_html(ubicacionInicial)}</a>`;
                        }
                    }

                    return `
                        <tr style="${rowStyle}">
                            <td style="${sharedCellStyle}">${frappe.utils.escape_html(item.name || "")}</td>
                            <td style="${sharedCellStyle}">${frappe.utils.escape_html(item.estado_viaje || "")}</td>
                            <td style="${sharedCellStyle}">${item.fecha_inicial ? frappe.datetime.str_to_user(item.fecha_inicial) : ""}</td>
                            <td style="${sharedCellStyle}">${item.fecha_final ? frappe.datetime.str_to_user(item.fecha_final) : ""}</td>
                            <td style="${durationStyle}">${durationHours}</td>
                            <td style="${sharedCellStyle.replace(" border-right: 1px solid var(--border-color);", "")}">${ubicacionLink}</td>
                        </tr>
                    `;
                });

                const tableHtml = `
                    <table class="table table-bordered" style="width: 100%; border-collapse: separate; border-spacing: 0; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; background-color: var(--bg-color); border: 1px solid var(--border-color);">
                        ${tableHeader}
                        <tbody>
                            ${rows.join("")}
                        </tbody>
                    </table>
                `;

                wrapper.html(tableHtml);
            })
            .catch(error => {
                console.error("Error fetching SP Transporte Viaje:", error);
                wrapper.html(`
                    <p>Error al obtener datos: ${frappe.utils.escape_html(error.message || "Error desconocido")}.</p>
                `);
            });
    }
});
