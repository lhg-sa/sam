import frappe
from frappe.query_builder import DocType
from frappe.query_builder.functions import Count


@frappe.whitelist()
def search_catalogo(texto="", page=0, page_size=8):
    """Busca en DAFIM Catalogo Insumos con AND entre tokens y OR entre campos."""
    page = int(page or 0)
    page_size = int(page_size or 10)

    Catalogo = DocType("DAFIM Catalogo Insumos")

    tokens = [t.strip() for t in (texto or "").split() if t.strip()]

    def base_query(select_fields):
        query = frappe.qb.from_(Catalogo).select(*select_fields)
        for token in tokens:
            like_val = f"%{token}%"
            query = query.where(
                (Catalogo.nombre_insumo.like(like_val))
                | (Catalogo.caracteristicas.like(like_val))
                | (Catalogo.renglon_presupuestario.like(like_val))
            )
        return query

    data_query = base_query(
        [
            Catalogo.name,
            Catalogo.codigo_insumo,
            Catalogo.nombre_insumo,
            Catalogo.renglon_presupuestario,
            Catalogo.es_activo_fijo,
            Catalogo.clase,
            Catalogo.caracteristicas,
        ]
    ).limit(page_size).offset(page * page_size)

    total_query = base_query([Count(1)])

    data = data_query.run(as_dict=True)
    total = total_query.run()[0][0] if tokens else frappe.db.count("DAFIM Catalogo Insumos")

    return {"data": data, "total": total}
