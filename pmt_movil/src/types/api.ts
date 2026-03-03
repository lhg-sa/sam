export interface ApiResponse<T> {
  message?: T
  data?: T
  exc_type?: string
  exception?: string
}

export interface SessionUserResponse {
  user: string
  is_guest: boolean
}

export interface Boleta {
  name?: string
  boleta_id: string | number
  vehiculo_id?: string
  fecha_infraccion?: string
  ubicacion_infraccion?: string
  nombre_infractor?: string
  articulo_codigo?: string
  infraccion_saldo?: number
  estado_boleta?: string
}

export interface RecentSearchItem {
  placa: string
  desc: string
  time: string
  ageDays: number
  bgClass: string
  iconClass: string
}

export interface SearchResultHistoryItem {
  placa: string
  searchedAt: string
  boletas: Boleta[]
}

export interface NovedadImagePayload {
  filename: string
  image_data?: string
  descripcion?: string
}

export interface NovedadPayload {
  tipo_incidencia: string
  descripcion: string
  usar_ubicacion_gps: 0 | 1
  latitud: number | null
  longitud: number | null
  precision_gps: number | null
  ubicacion_texto: string
  imagenes: NovedadImagePayload[]
}
