/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { Transaction, CATEGORY_COLORS } from "../types";
import { 
  Search, Filter, Trash2, Calendar, Tag, CreditCard, 
  Wallet, ArrowUpRight, ArrowDownRight, Edit3, ArrowLeftRight, PiggyBank 
} from "lucide-react";

interface TransactionsListProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onEditTransaction?: (transaction: Transaction) => void;
}

export default function TransactionsList({ 
  transactions, 
  onDeleteTransaction,
  onEditTransaction 
}: TransactionsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "pemasukan" | "pengeluaran" | "nabung">("all");
  const [filterMethod, setFilterMethod] = useState<"all" | "tunai" | "transfer">("all");
  const [filterCategory, setFilterCategory] = useState("all");

  // Get list of unique categories in of current transactions
  const availableCategories = useMemo(() => {
    const list = new Set<string>();
    transactions.forEach(t => list.add(t.category));
    return Array.from(list);
  }, [transactions]);

  // Apply searching and filtering
  const filteredList = useMemo(() => {
    return transactions.filter((tx) => {
      const matchSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tx.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === "all" ? true : tx.type === filterType;
      const matchMethod = filterMethod === "all" ? true : tx.method === filterMethod;
      const matchCategory = filterCategory === "all" ? true : tx.category === filterCategory;
      
      return matchSearch && matchType && matchMethod && matchCategory;
    });
  }, [transactions, searchQuery, filterType, filterMethod, filterCategory]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    
    // Sort transactions chronologically (latest first)
    const sorted = [...filteredList].sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    sorted.forEach((tx) => {
      const dateKey = tx.date;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(tx);
    });

    return groups;
  }, [filteredList]);

  // Helper to format date header nicely
  const formatDateHeader = (dateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    
    if (dateStr === today) {
      return "Hari Ini";
    } else if (dateStr === yesterday) {
      return "Kemarin";
    }
    
    const d = new Date(dateStr);
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  };

  return (
    <div id="tx-list-container" className="space-y-4">
      {/* Search and Filters Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            placeholder="Cari transaksi berdasarkan deskripsi atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filters Selectors Row */}
        <div className="flex flex-wrap gap-2 pt-1 items-center">
          <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Saring:</span>
          </div>

          {/* Type Filter */}
          <select
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs border border-slate-200 py-1.5 px-2.5 rounded-lg focus:outline-none cursor-pointer"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="all">Semua Tipe</option>
            <option value="pemasukan">Hanya Pemasukan</option>
            <option value="pengeluaran">Hanya Pengeluaran</option>
            <option value="nabung">Hanya Tabungan (Setor Kas)</option>
          </select>

          {/* Method Filter */}
          <select
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs border border-slate-200 py-1.5 px-2.5 rounded-lg focus:outline-none cursor-pointer"
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value as any)}
          >
            <option value="all">Semua Metode</option>
            <option value="tunai">Tunai Only</option>
            <option value="transfer">Transfer Only</option>
          </select>

          {/* Category Filter */}
          <select
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs border border-slate-200 py-1.5 px-2.5 rounded-lg focus:outline-none cursor-pointer max-w-[150px]"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">Semua Kategori</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Reset Filters button */}
          {(searchQuery || filterType !== "all" || filterMethod !== "all" || filterCategory !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterType("all");
                setFilterMethod("all");
                setFilterCategory("all");
              }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer ml-auto"
            >
              Atur Ulang Filter
            </button>
          )}
        </div>
      </div>

      {/* Grouped Transactions List */}
      {filteredList.length === 0 ? (
        <div className="bg-white py-14 px-6 rounded-2xl shadow-sm border border-slate-100 text-center">
          <p className="text-sm text-slate-400 italic">Tidak ada rincian transaksi cocok.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedTransactions).map((dateKey) => (
            <div key={dateKey} className="space-y-2">
              {/* Date Header label block */}
              <div className="flex items-center gap-1.5 px-1 py-0.5">
                <Calendar className="w-4.5 h-4.5 text-slate-400" />
                <h5 className="text-xs font-bold text-slate-600 tracking-tight">
                  {formatDateHeader(dateKey)}
                </h5>
              </div>

              {/* Transactions in this date */}
              <div className="space-y-2.5">
                {groupedTransactions[dateKey].map((tx) => {
                  const isIncome = tx.type === "pemasukan";
                  const isNabung = tx.type === "nabung";
                  const itemColor = isNabung ? "#6366F1" : (CATEGORY_COLORS[tx.category] || "#6b7280");

                  let cardIcon = <ArrowDownRight className="w-5 h-5" />;
                  let iconBgClass = "bg-red-50 text-red-600";
                  let amountPrefix = "-";
                  let amountColorClass = "text-red-600";

                  if (isIncome) {
                    cardIcon = <ArrowUpRight className="w-5 h-5" />;
                    iconBgClass = "bg-emerald-50 text-emerald-600";
                    amountPrefix = "+";
                    amountColorClass = "text-emerald-600";
                  } else if (isNabung) {
                    cardIcon = <ArrowLeftRight className="w-5 h-5" />;
                    iconBgClass = "bg-indigo-50 text-indigo-600";
                    amountPrefix = "⇄ ";
                    amountColorClass = "text-indigo-600";
                  }

                  return (
                    <div 
                      key={tx.id} 
                      className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex items-center justify-between gap-4 group hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3 truncate min-w-0">
                        {/* Status Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBgClass}`}>
                          {cardIcon}
                        </div>

                        {/* Text fields */}
                        <div className="truncate min-w-0">
                          <h6 className="text-sm font-semibold text-slate-800 truncate">
                            {tx.description}
                          </h6>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {/* Category Badge */}
                            <span 
                              className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
                              style={{ backgroundColor: itemColor }}
                            >
                              {isNabung ? <PiggyBank className="w-2.5 h-2.5" /> : <Tag className="w-2.5 h-2.5" />}
                              <span>{isNabung ? "Tabungan" : tx.category}</span>
                            </span>

                            {/* Method Badge */}
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 border border-slate-200/50">
                              {isNabung ? (
                                <>
                                  <ArrowLeftRight className="w-2.5 h-2.5 text-indigo-500" />
                                  <span>Tunai → Rekening</span>
                                </>
                              ) : tx.method === "tunai" ? (
                                <>
                                  <Wallet className="w-2.5 h-2.5 text-slate-400" />
                                  <span>Tunai</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-2.5 h-2.5 text-slate-400" />
                                  <span>Transfer</span>
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Section: Amount & Modify Action Buttons */}
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <span className={`text-sm font-bold font-mono tracking-tight ${amountColorClass}`}>
                            {amountPrefix}Rp {tx.amount.toLocaleString("id-ID")}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onEditTransaction && (
                            <button
                              onClick={() => onEditTransaction(tx)}
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Ubah Transaksi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (confirm(`Hapus transaksi "${tx.description}"?`)) {
                                onDeleteTransaction(tx.id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
