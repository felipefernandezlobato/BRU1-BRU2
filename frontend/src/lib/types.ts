export interface User {
  id: number;
  name: string;
  role: string;
  is_active: boolean;
}

export interface LoginUser {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  position: number;
  is_active: boolean;
}

export interface Item {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  unit: string;
  cost_per_unit: number;
  is_produced: boolean;
  escandallos_name?: string;
  is_active: boolean;
}

export interface MovementLine {
  id: number;
  item_id: number;
  item_name?: string;
  quantity: number;
  unit: string;
  cost_per_unit_snapshot: number;
  markup_pct_snapshot: number;
  transfer_price_snapshot: number;
}

export interface Movement {
  id: number;
  direction: string;
  created_by: number;
  creator_name?: string;
  notes?: string;
  photo_filename?: string;
  movement_date: string;
  created_at: string;
  lines: MovementLine[];
  total_cost: number;
}

export interface AnalyticsSummary {
  current_month_cost: number;
  previous_month_cost: number;
  cost_change_pct: number;
  current_month_count: number;
  previous_month_count: number;
  top_items_by_cost: { name: string; total: number }[];
  top_items_by_quantity: { name: string; total: number }[];
  category_comparison: { category: string; current: number; previous: number; change_pct: number }[];
}

export interface Setting {
  key: string;
  value: string;
}
