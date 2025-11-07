// Copyright (c) 2025, Lidar Holding Group S. A. and contributors
// For license information, please see license.txt

frappe.ui.form.on("SP Trasporte", {
    refresh(frm) {
        frappe.db.get_list("SP Trasporte Viaje", {
            fields: ["name", "estado_viaje", "fecha_inicial", "fecha_final", "ubicación_inicial"],
            filters: {
                placa_vehiculo: frm.doc.name
            },
            order_by: "creation asc",
            limit: 500
        }).then(r => {
            if (!r || r.length === 0) {
                frm.fields_dict.detalle_servicios_html.$wrapper.html(`
                    <p>No existen registros en <strong>SP Trasporte Viaje</strong> para el vehículo ${frm.doc.name}.</p>
                `);
                return;
            }

            // Construir HTML
            let html = `
                <table class="table table-bordered" style="width:100%; border-collapse: separate; border-spacing: 0; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; background-color: var(--bg-color); border: 1px solid var(--border-color);">
                    <thead>
                        <tr style="background-color: var(--bg-light); font-weight: bold;">
                            <th style="padding: 12px 8px; border-bottom: 2px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color); text-align: left;">Name</th>
                            <th style="padding: 12px 8px; border-bottom: 2px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color); text-align: left;">Estado Viaje</th>
                            <th style="padding: 12px 8px; border-bottom: 2px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color); text-align: left;">Fecha Inicial</th>
                            <th style="padding: 12px 8px; border-bottom: 2px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color); text-align: left;">Fecha Final</th>
                            <th style="padding: 12px 8px; border-bottom: 2px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color); text-align: left;">Duración (Horas)</th>
                            <th style="padding: 12px 8px; border-bottom: 2px solid var(--border-color); color: var(--text-color); text-align: left;">Ubicación Inicial</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            r.forEach((item, index) => {
                // Alternate row colors for better readability in both light and dark mode
                const rowStyle = index % 2 === 0 ? 'background-color: var(--bg-color);' : 'background-color: var(--bg-light);';
                
                // Calculate duration in hours
                let durationHours = "";
                let durationStyle = "color: var(--text-color);";
                if (item.fecha_inicial) {
                    const startDate = new Date(item.fecha_inicial);
                    let endDate;
                    if (item.fecha_final) {
                        endDate = new Date(item.fecha_final);
                    } else {
                        endDate = new Date(); // Current date/time
                        durationStyle = "color: red; font-weight: bold;"; // Red color for ongoing duration
                    }
                    const diffInMs = endDate - startDate;
                    const diffInHours = diffInMs / (1000 * 60 * 60);
                    durationHours = diffInHours.toFixed(2);
                }
                
                // Format GPS coordinates as a Google Maps link
                let ubicacionLink = "";
                if (item.ubicación_inicial) {
                    // Assuming the format is "latitude,longitude"
                    const coords = item.ubicación_inicial.split(",");
                    if (coords.length === 2) {
                        ubicacionLink = `<a href="https://www.google.com/maps?q=${coords[0].trim()},${coords[1].trim()}" target="_blank" style="color: #007bff; text-decoration: none;">${item.ubicación_inicial}</a>`;
                    } else {
                        ubicacionLink = `<span style="color: #007bff;">${item.ubicación_inicial}</span>`;
                    }
                }
                
                html += `
                    <tr style="${rowStyle}">
                        <td style="padding: 10px 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color);">${item.name || ""}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color);">${item.estado_viaje || ""}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color);">${item.fecha_inicial ? frappe.datetime.str_to_user(item.fecha_inicial) : ""}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); color: var(--text-color);">${item.fecha_final ? frappe.datetime.str_to_user(item.fecha_final) : ""}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); ${durationStyle}">${durationHours}</td>
                        <td style="padding: 10px 8px; border-bottom: 1px solid var(--border-color); color: var(--text-color);">${ubicacionLink}</td>
                    </tr>
                `;
            });

            html += `
                    </tbody>
                </table>
            `;

            // ✅ ESTA ES LA ÚNICA FORMA CORRECTA DE MOSTRAR HTML EN UN CAMPO HTML
            frm.fields_dict.detalle_servicios_html.$wrapper.html(html);

        }).catch(error => {
            console.error("Error fetching SP Trasporte Viaje:", error);
            frm.fields_dict.detalle_servicios_html.$wrapper.html(`
                <p>Error al obtener datos: ${error.message}</p>
            `);
        });
    }
});