/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = "pemasukan" | "pengeluaran" | "nabung";
export type PaymentMethod = "tunai" | "transfer";

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  method: PaymentMethod;
  amount: number;
  category: string;
  description: string;
  date: string; // ISO date format YYYY-MM-DD
  createdAt: string; // Full ISO timestamp
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
}

export interface BudgetLimit {
  category: string;
  limitAmount: number;
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export const INCOME_CATEGORIES = [
  "Gaji",
  "Investasi",
  "Bisnis/Penjualan",
  "Hadiah/Bonus",
  "Lain-lain"
];

export const EXPENSE_CATEGORIES = [
  "Makanan & Minuman",
  "Belanja Harian",
  "Transportasi",
  "Tagihan & Listrik",
  "Kesehatan",
  "Pendidikan",
  "Hiburan",
  "Lain-lain"
];

export const CATEGORY_COLORS: Record<string, string> = {
  // Income
  "Gaji": "#10B981", // Emerald
  "Investasi": "#3B82F6", // Blue
  "Bisnis/Penjualan": "#F59E0B", // Amber
  "Hadiah/Bonus": "#8B5CF6", // Purple
  
  // Expense
  "Makanan & Minuman": "#EF4444", // Red
  "Belanja Harian": "#EC4899", // Pink
  "Transportasi": "#6366F1", // Indigo
  "Tagihan & Listrik": "#F97316", // Orange
  "Kesehatan": "#14B8A6", // Teal
  "Pendidikan": "#06B6D4", // Cyan
  "Hiburan": "#D946EF", // Fuchsia
  
  // Commons
  "Lain-lain": "#6B7280" // Gray
};
