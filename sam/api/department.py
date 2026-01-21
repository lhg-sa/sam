import frappe


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def departments_for_expense_approver(doctype, txt, searchfield, start, page_len, filters):
    """Link field query: only departments where the user is listed as expense approver."""
    user = (filters or {}).get("user") or frappe.session.user
    Department = frappe.qb.DocType("Department")
    DepartmentApprover = frappe.qb.DocType("Department Approver")

    query = (
        frappe.qb.from_(Department)
        .join(DepartmentApprover)
        .on(
            (DepartmentApprover.parent == Department.name)
            & (DepartmentApprover.parenttype == "Department")
            & (DepartmentApprover.parentfield == "expense_approvers")
        )
        .select(Department.name)
        .distinct()
        .where(DepartmentApprover.approver == user)
    )

    if txt:
        query = query.where(Department.name.like(f"%{txt}%"))

    return query.orderby(Department.name).limit(page_len).offset(start).run()
