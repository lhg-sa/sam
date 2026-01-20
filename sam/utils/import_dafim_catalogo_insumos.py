import csv
from pathlib import Path

import frappe


def _sanitize_utf8(value):
    if value is None:
        return value
    if not isinstance(value, str):
        return value
    value = value.replace("\x00", "").replace("\ufffd", "")
    value = value.encode("utf-8", errors="replace").decode("utf-8")
    return value.replace("\ufffd", "")


def import_dafim_catalogo_insumos(limit=None):
    app_path = Path(frappe.get_app_path("sam"))
    file_path = app_path / "utils" / "catalogo_importar_v2.csv"
    log_path = app_path / "utils" / "import_dafim_catalogo_insumos_errors.log"
    doctype = "DAFIM Catalogo Insumos"

    if not file_path.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {file_path}")

    with file_path.open("r", encoding="utf-8", errors="replace", newline="") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")
        if not reader.fieldnames:
            raise ValueError("El archivo CSV no tiene encabezados.")

        row_number = 0
        for row in reader:
            if not any(value for value in row.values()):
                continue

            row_number += 1
            if limit is not None and row_number > limit:
                break
            codigo_insumo = _sanitize_utf8(row.get("codigo_insumo"))
            codigo_presentacion = _sanitize_utf8(row.get("codigo_presentacion"))
            renglon_presupuestario = _sanitize_utf8(row.get("renglon_presupuestario"))
            unique_id = None
            if codigo_insumo and codigo_presentacion and renglon_presupuestario:
                unique_id = (
                    f"-{renglon_presupuestario}-{codigo_insumo}-{codigo_presentacion}"
                )

            if unique_id and frappe.db.exists(doctype, unique_id):
                print(f"Fila {row_number} omitida (id ya existe): {unique_id}")
                continue

            try:
                doc = frappe.new_doc(doctype)
                if unique_id:
                    doc.name = unique_id

                for fieldname, value in row.items():
                    value = _sanitize_utf8(value)
                    if fieldname in {"nombre_insumo", "caracteristicas"} and value:
                        value = value.strip()
                    if fieldname == "nombre_insumo" and value:
                        value = value[:140]
                    doc.set(fieldname, value)

                doc.insert(ignore_permissions=True)
                print(f"Fila {row_number} insertada correctamente")
            except Exception as exc:
                error_line = (
                    f"Fila {row_number} (codigo_insumo={codigo_insumo}): {exc}\n"
                )
                with log_path.open("a", encoding="utf-8") as logfile:
                    logfile.write(error_line)

    frappe.db.commit()
    print("Importacion completada.")
