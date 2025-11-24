import frappe
import csv

def import_pmt_vehiculos():
    file_path = "/home/frappe/frappe-bench/pmt_vehiculo.csv"
    doctype = "PMT Vehiculo"   # ← nombre correcto del Doctype

    with open(file_path, "r") as csvfile:
        reader = csv.DictReader(csvfile)
        row_number = 0

        for row in reader:
            row_number += 1

            doc = frappe.new_doc(doctype)

            doc.placa_tipo = row.get("placa_tipo")
            doc.placa_numero = row.get("placa_numero")
            doc.tipo_vehiculo = row.get("tipo_vehiculo")
            doc.color = row.get("color")
            doc.tarjeta_circulacion = row.get("tarjeta_circulacion")
            doc.marca_vehiculo = row.get("marca_vehiculo")

            doc.insert(ignore_permissions=True)

            print(f"Fila {row_number} insertada correctamente")

    frappe.db.commit()
    print("Importación completada.")
