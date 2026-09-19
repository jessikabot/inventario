export type Role = 'admin' | 'vendedor' | 'consulta'
export type Unit = 'unidad' | 'par' | 'set'
export type StockStatus = 'ok' | 'bajo' | 'sin_stock'
export type PaymentMethod = 'efectivo' | 'qr' | 'tarjeta' | 'otro'
export type MovementType = 'inicial' | 'ingreso' | 'venta' | 'anulacion' | 'ajuste'
export type SaleStatus = 'completada' | 'anulada'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  code: string
  active: boolean
  created_at: string
  product_count?: number
}

export interface Product {
  id: string
  code: string
  category_id: string
  title: string
  link: string | null
  description: string | null
  stock: number
  min_stock: number
  unit: Unit
  label: string | null
  price: number
  notes: string | null
  active: boolean
  primary_image_path: string | null
  stock_status: StockStatus
  created_at: string
  created_by: string
  updated_at: string
}

export interface ProductRow {
  id: string
  code: string
  title: string
  price: number
  stock: number
  min_stock: number
  unit: Unit
  stock_status: StockStatus
  active: boolean
  primary_image_path: string | null
  category: { name: string } | null
}

export interface ProductImage {
  id: string
  product_id: string
  storage_path: string
  is_primary: boolean
  created_at: string
}

export interface Movement {
  id: string
  product_id: string
  type: MovementType
  quantity: number
  stock_before: number
  stock_after: number
  sale_id: string | null
  note: string | null
  created_at: string
  created_by: string
  product?: { code: string; title: string } | null
  user?: { full_name: string } | null
  sale?: { sale_number: number } | null
}

export interface Sale {
  id: string
  sale_number: number
  status: SaleStatus
  payment_method: PaymentMethod
  subtotal: number
  discount_total: number
  total: number
  notes: string | null
  created_at: string
  created_by: string
  cancelled_at: string | null
  cancelled_by: string | null
  cancel_reason: string | null
  seller?: { full_name: string } | null
  canceller?: { full_name: string } | null
}

export interface SaleItem {
  id: string
  product_id: string
  product_code: string
  product_title: string
  quantity: number
  unit_price: number
  discount: number
  line_total: number
}

export interface Settings {
  business_name: string
  currency: string
  default_min_stock: number
}

export interface GroupRow {
  group_key: string
  group_label: string
  sales_count: number
  units: number
  total: number
}
