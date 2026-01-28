import frappe


def _get_linked_doctypes():
    link_fields = frappe.get_all(
        "DocField",
        filters={"fieldtype": "Link", "options": "Item"},
        fields=["parent", "fieldname"],
    )
    dt_istable = {
        dt.name: dt.istable
        for dt in frappe.get_all("DocType", fields=["name", "istable"])
    }
    grouped = {}
    for df in link_fields:
        grouped.setdefault(df.parent, []).append(df.fieldname)
    return grouped, dt_istable


def _build_or_clause(fieldnames):
    conditions = [f"`{fieldname}` != ''" for fieldname in fieldnames]
    return " OR ".join(conditions) if conditions else "1=0"


def _delete_parent_rows(doctype, names, force_db_delete):
    meta = frappe.get_meta(doctype)
    child_tables = [df.options for df in meta.fields if df.fieldtype == "Table"]
    for name in names:
        try:
            frappe.delete_doc(doctype, name, ignore_permissions=True, force=1)
        except Exception:
            if not force_db_delete:
                raise
            for child_dt in child_tables:
                frappe.db.delete(child_dt, {"parent": name})
            frappe.db.delete(doctype, {"name": name})


def delete_all_items_and_links(force_db_delete=True):
    """
    Delete all Item records and any records linking to Item.

    force_db_delete=True bypasses validation errors by direct DB delete.
    Intended for test data cleanup only.
    """
    grouped, dt_istable = _get_linked_doctypes()

    for doctype, fieldnames in grouped.items():
        condition = _build_or_clause(fieldnames)
        table = f"tab{doctype}"
        if dt_istable.get(doctype):
            frappe.db.sql(f"DELETE FROM `{table}` WHERE {condition}")
            continue

        names = frappe.db.sql(
            f"SELECT name FROM `{table}` WHERE {condition}", as_dict=False
        )
        names = [row[0] for row in names]
        if names:
            _delete_parent_rows(doctype, names, force_db_delete)

    item_names = frappe.get_all("Item", pluck="name")
    if item_names:
        _delete_parent_rows("Item", item_names, force_db_delete)

    frappe.db.commit()


def scan_remaining_item_links():
    grouped, dt_istable = _get_linked_doctypes()
    remaining = []
    for doctype, fieldnames in grouped.items():
        condition = _build_or_clause(fieldnames)
        table = f"tab{doctype}"
        try:
            count = frappe.db.sql(
                f"SELECT COUNT(*) FROM `{table}` WHERE {condition}",
                as_list=True,
            )[0][0]
        except Exception:
            continue
        if count:
            remaining.append((doctype, fieldnames, dt_istable.get(doctype), count))
    return remaining


def run():
    delete_all_items_and_links(force_db_delete=True)
    remaining = scan_remaining_item_links()
    if remaining:
        frappe.log_error(
            message={"remaining_item_links": remaining},
            title="Item cleanup incomplete",
        )
