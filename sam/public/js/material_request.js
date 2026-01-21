frappe.ui.form.on("Material Request", {
  onload(frm) {
    //frappe.msgprint("Bienvenido al doctype Material Request");
    set_custom_unidad_filter(frm);
  },
  refresh(frm) {
    set_custom_unidad_filter(frm);
  },
});

function set_custom_unidad_filter(frm) {
  if (!frm.fields_dict.custom_unidad) {
    console.warn("custom_unidad no existe en el formulario de Material Request");
    return;
  }

  frm.set_query("custom_unidad", () => ({
    query: "sam.api.department.departments_for_expense_approver",
    filters: {
      user: frappe.session.user,
    },
  }));
}
