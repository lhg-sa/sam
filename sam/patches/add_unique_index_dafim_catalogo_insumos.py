import frappe


def execute():
    table = "`tabDAFIM Catalogo Insumos`"
    composite_index = "uniq_renglon_codigo_presentacion"

    codigo_index = frappe.db.sql(
        f"SHOW INDEX FROM {table} WHERE Key_name='codigo_insumo'", as_dict=True
    )
    if codigo_index:
        frappe.db.sql(f"ALTER TABLE {table} DROP INDEX `codigo_insumo`")

    composite_exists = frappe.db.sql(
        f"SHOW INDEX FROM {table} WHERE Key_name=%s", composite_index, as_dict=True
    )
    if not composite_exists:
        frappe.db.sql(
            f"""ALTER TABLE {table}
ADD UNIQUE INDEX `{composite_index}`
(`renglon_presupuestario`, `codigo_insumo`, `codigo_presentacion`)"""
        )
