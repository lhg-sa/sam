import frappe


def execute():
    doctype = "Sales Order"
    fieldname = "facelec_three_digit_uom"

    if not frappe.db.exists("List View Settings", doctype):
        return

    settings = frappe.get_doc("List View Settings", doctype)
    if not settings.fields:
        return

    try:
        fields = frappe.parse_json(settings.fields) or []
    except Exception:
        return

    def is_valid_field(entry):
        if isinstance(entry, dict):
            return entry.get("fieldname") != fieldname
        return entry != fieldname

    updated_fields = [entry for entry in fields if is_valid_field(entry)]
    if len(updated_fields) == len(fields):
        return

    settings.db_set("fields", frappe.as_json(updated_fields), update_modified=False)
