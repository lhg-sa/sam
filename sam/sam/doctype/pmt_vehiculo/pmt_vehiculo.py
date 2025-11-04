# Copyright (c) 2025, Lidar Holding Group S. A. and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class PMTVehiculo(Document):
    def validate(self):
        self.placa_numero = (self.placa_numero or "").strip().upper()