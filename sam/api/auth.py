import frappe


@frappe.whitelist(allow_guest=True)
def get_session_user():
	"""Return current session user in a whitelisted-safe way for PWA guards."""
	return {
		"user": frappe.session.user,
		"is_guest": frappe.session.user == "Guest",
	}
