# Copyright (c) 2026, Lidar Holding Group S. A. and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class HikvisionDevice(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		device_name: DF.Data
		device_ip: DF.Data
		is_active: DF.Check
		last_sync: DF.Datetime | None
		password: DF.Password | None
		port: DF.Int
		username: DF.Data
	# end: auto-generated types

	pass
