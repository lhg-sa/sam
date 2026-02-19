import frappe


def execute():
    fieldname = "custom_boleta_id"
    parent = "Sales Order"
    custom_field_name = f"{parent}-{fieldname}"

    if not frappe.db.exists("Custom Field", custom_field_name):
        return

    options = frappe.db.get_value("Custom Field", custom_field_name, "options")
    if options and options.strip() == "Boleta de Transito":
        if not frappe.db.exists("DocType", "Boleta de Transito"):
            frappe.delete_doc("Custom Field", custom_field_name, ignore_permissions=True)
