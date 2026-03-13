# Copyright (c) 2026, Lidar Holding Group S. A. and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class PMTNovedades(Document):
	def validate(self):
		self.gps_mapa_html = self._build_google_maps_url()

	def _build_google_maps_url(self) -> str:
		if self.latitud is None or self.longitud is None:
			return ""

		try:
			lat = float(self.latitud)
			lon = float(self.longitud)
		except (TypeError, ValueError):
			return ""

		if not (-90 <= lat <= 90 and -180 <= lon <= 180):
			return ""

		return f"https://www.google.com/maps?q={lat:.6f},{lon:.6f}"
