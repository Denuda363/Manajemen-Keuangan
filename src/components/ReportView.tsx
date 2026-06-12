/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { Transaction, CATEGORY_COLORS, CompanyProfile } from "../types";
import { 
  TrendingUp, TrendingDown, CreditCard, Wallet, Calendar, 
  BarChart2, PieChart, ChevronLeft, ChevronRight, Activity,
  Filter, PiggyBank, RefreshCw, Layers, Printer, FileDown, X, Info, FileSpreadsheet
} from "lucide-react";
import { motion } from "motion/react";

interface ReportViewProps {
  transactions: Transaction[];
  user?: {
    id: string;
    username: string;
    name: string;
    email: string;
  };
  companyProfile?: CompanyProfile | null;
  initialCashBalance?: number;
  initialTransferBalance?: number;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

export default function ReportView({ 
  transactions, 
  user, 
  companyProfile,
  initialCashBalance = 0,
  initialTransferBalance = 0
}: ReportViewProps) {
  // Filter types: "harian" (Tanggal), "mingguan" (Mingguan), "bulanan" (Bulan), "tahunan" (Tahun)
  const [filterType, setFilterType] = useState<"harian" | "mingguan" | "bulanan" | "tahunan">("bulanan");
  const [showPdfGuide, setShowPdfGuide] = useState(false);
  
  // Pivot states for custom date and times
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // "YYYY-MM-DD"
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return new Date().getMonth(); // 0-indexed
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return new Date().getFullYear();
  });

  // Track hovered item on trend charts
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute Monday-to-Sunday range boundary for a given pivot date (locally adjusted)
  const weekRange = useMemo(() => {
    const pivot = new Date(selectedDate);
    if (isNaN(pivot.getTime())) {
      const today = new Date();
      return { startStr: today.toISOString().split("T")[0], endStr: today.toISOString().split("T")[0], start: today, end: today };
    }
    const day = pivot.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = pivot.getDate() - day + (day === 0 ? -6 : 1);
    
    const startOfWeek = new Date(pivot);
    startOfWeek.setDate(diffToMonday);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    return {
      start: startOfWeek,
      end: endOfWeek,
      startStr: startOfWeek.toISOString().split("T")[0],
      endStr: endOfWeek.toISOString().split("T")[0]
    };
  }, [selectedDate]);

  // Dynamically compute list of unique years in transactions history to populate year dropdown
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    years.add(new Date().getFullYear() - 1);
    transactions.forEach(t => {
      const y = new Date(t.date).getFullYear();
      if (!isNaN(y)) {
        years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Handle date scroll back and forth (arrow controls)
  const shiftPeriod = (direction: "prev" | "next") => {
    if (filterType === "harian") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + (direction === "next" ? 1 : -1));
      setSelectedDate(d.toISOString().split("T")[0]);
    } else if (filterType === "mingguan") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + (direction === "next" ? 7 : -7));
      setSelectedDate(d.toISOString().split("T")[0]);
    } else if (filterType === "bulanan") {
      if (direction === "prev") {
        if (selectedMonth === 0) {
          setSelectedMonth(11);
          setSelectedYear(prev => prev - 1);
        } else {
          setSelectedMonth(prev => prev - 1);
        }
      } else {
        if (selectedMonth === 11) {
          setSelectedMonth(0);
          setSelectedYear(prev => prev + 1);
        } else {
          setSelectedMonth(prev => prev + 1);
        }
      }
    } else {
      setSelectedYear(prev => prev + (direction === "next" ? 1 : -1));
    }
  };

  // Humanized display label of current filtered period
  const formattedPeriodLabel = useMemo(() => {
    if (filterType === "harian") {
      const d = new Date(selectedDate);
      return d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }
    if (filterType === "mingguan") {
      const startLabel = weekRange.start.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
      const endLabel = weekRange.end.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      return `${startLabel} - ${endLabel}`;
    }
    if (filterType === "bulanan") {
      return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    return `Tahun ${selectedYear}`;
  }, [filterType, selectedDate, selectedMonth, selectedYear, weekRange]);

  // Filter transactions exactly matching selected period rules
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (!tx.date) return false;
      const txParts = tx.date.split("-");
      const txYr = parseInt(txParts[0]);
      const txMo = parseInt(txParts[1]) - 1; // 0-indexed
      const txDa = parseInt(txParts[2]);

      if (filterType === "harian") {
        return tx.date === selectedDate;
      }
      if (filterType === "mingguan") {
        return tx.date >= weekRange.startStr && tx.date <= weekRange.endStr;
      }
      if (filterType === "bulanan") {
        return txYr === selectedYear && txMo === selectedMonth;
      }
      // tahunan
      return txYr === selectedYear;
    });
  }, [transactions, filterType, selectedDate, selectedMonth, selectedYear, weekRange]);

  // Sort chronologically for printing ledgers cleanly
  const chronologicalTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tx => ({
      ...tx,
      category: tx.category.replace(/\bGaji\b/gi, "Pendapatan / Omzet"),
      description: tx.description ? tx.description.replace(/\bGaji\b/gi, "Pendapatan / Omzet") : tx.description
    }));
  }, [filteredTransactions]);

  // To cover calculations as well without altering state upstream
  const displayFilteredTransactions = useMemo(() => {
    return filteredTransactions.map(tx => ({
      ...tx,
      category: tx.category.replace(/\bGaji\b/gi, "Pendapatan / Omzet"),
      description: tx.description ? tx.description.replace(/\bGaji\b/gi, "Pendapatan / Omzet") : tx.description
    }));
  }, [filteredTransactions]);

  // Calculations: core totals, splits, category weights
  const stats = useMemo(() => {
    let incomeTotal = 0;
    let expenseTotal = 0;
    let savingTotal = 0;
    
    let incomeTunai = 0;
    let incomeTransfer = 0;
    let expenseTunai = 0;
    let expenseTransfer = 0;

    const expenseCategoryMap: Record<string, number> = {};
    const incomeCategoryMap: Record<string, number> = {};

    displayFilteredTransactions.forEach((tx) => {
      const amt = tx.amount;
      if (tx.type === "pemasukan") {
        incomeTotal += amt;
        if (tx.method === "tunai") incomeTunai += amt;
        else incomeTransfer += amt;
        
        incomeCategoryMap[tx.category] = (incomeCategoryMap[tx.category] || 0) + amt;
      } else if (tx.type === "pengeluaran") {
        expenseTotal += amt;
        if (tx.method === "tunai") expenseTunai += amt;
        else expenseTransfer += amt;

        expenseCategoryMap[tx.category] = (expenseCategoryMap[tx.category] || 0) + amt;
      } else if (tx.type === "nabung") {
        savingTotal += amt;
      }
    });

    const categoriesExpense = Object.keys(expenseCategoryMap).map(k => ({
      category: k,
      amount: expenseCategoryMap[k],
      percentage: expenseTotal > 0 ? (expenseCategoryMap[k] / expenseTotal) * 100 : 0,
      color: CATEGORY_COLORS[k] || "#6B7280"
    })).sort((a, b) => b.amount - a.amount);

    const categoriesIncome = Object.keys(incomeCategoryMap).map(k => ({
      category: k,
      amount: incomeCategoryMap[k],
      percentage: incomeTotal > 0 ? (incomeCategoryMap[k] / incomeTotal) * 100 : 0,
      color: CATEGORY_COLORS[k] || "#6B7280"
    })).sort((a, b) => b.amount - a.amount);

    return {
      incomeTotal,
      expenseTotal,
      savingTotal,
      netBalance: incomeTotal - expenseTotal,
      incomeTunai,
      incomeTransfer,
      expenseTunai,
      expenseTransfer,
      categoriesExpense,
      categoriesIncome,
    };
  }, [displayFilteredTransactions]);
  const pdfMetrics = useMemo(() => {
    // 1. isBeforePeriod logic helper
    const isBeforePeriod = (dateStr: string) => {
      if (!dateStr) return false;
      if (filterType === "harian") {
        return dateStr < selectedDate;
      }
      if (filterType === "mingguan") {
        return dateStr < weekRange.startStr;
      }
      if (filterType === "bulanan") {
        const yr = selectedYear;
        const moText = String(selectedMonth + 1).padStart(2, "0");
        const startOfMoStr = `${yr}-${moText}-01`;
        return dateStr < startOfMoStr;
      }
      if (filterType === "tahunan") {
        const startOfYrStr = `${selectedYear}-01-01`;
        return dateStr < startOfYrStr;
      }
      return false;
    };

    // calculate starting balances based on ALL transactions prior to selected period
    let cashSaldoAwal = initialCashBalance;
    let rekeningSaldoAwal = initialTransferBalance;

    transactions.forEach((tx) => {
      if (isBeforePeriod(tx.date)) {
        const amt = tx.amount;
        if (tx.type === "pemasukan") {
          if (tx.method === "tunai") {
            cashSaldoAwal += amt;
          } else {
            rekeningSaldoAwal += amt;
          }
        } else if (tx.type === "pengeluaran") {
          if (tx.method === "tunai") {
            cashSaldoAwal -= amt;
          } else {
            rekeningSaldoAwal -= amt;
          }
        } else if (tx.type === "nabung") {
          cashSaldoAwal -= amt;
          rekeningSaldoAwal += amt;
        }
      }
    });

    // Income Tunai broken down by category in the selected period
    const incomeTunaiByCategory: Record<string, number> = {};
    let incomeTunaiTotal = 0;
    let incomeTransferTotal = 0;
    let expenseTunaiTotal = 0;
    let expenseTransferTotal = 0;
    let nabungTotal = 0;

    displayFilteredTransactions.forEach((tx) => {
      const amt = tx.amount;
      if (tx.type === "pemasukan") {
        if (tx.method === "tunai") {
          incomeTunaiByCategory[tx.category] = (incomeTunaiByCategory[tx.category] || 0) + amt;
          incomeTunaiTotal += amt;
        } else {
          incomeTransferTotal += amt;
        }
      } else if (tx.type === "pengeluaran") {
        if (tx.method === "tunai") {
          expenseTunaiTotal += amt;
        } else {
          expenseTransferTotal += amt;
        }
      } else if (tx.type === "nabung") {
        nabungTotal += amt;
      }
    });

    const incomeTunaiList = Object.keys(incomeTunaiByCategory).map((cat) => ({
      category: cat.toUpperCase(),
      amount: incomeTunaiByCategory[cat]
    })).sort((a, b) => b.amount - a.amount);

    const sisaSebelumNabung = cashSaldoAwal + incomeTunaiTotal - expenseTunaiTotal;
    const sisaUangTunai = sisaSebelumNabung - nabungTotal;
    const rekeningSaldoAkhir = rekeningSaldoAwal + incomeTransferTotal + nabungTotal - expenseTransferTotal;

    return {
      cashSaldoAwal,
      rekeningSaldoAwal,
      incomeTunaiList,
      incomeTunaiTotal,
      expenseTunaiTotal,
      sisaSebelumNabung,
      incomeTransferTotal,
      nabungTotal,
      expenseTransferTotal,
      sisaUangTunai,
      rekeningSaldoAkhir,
      totalIncomeCombine: incomeTunaiTotal + incomeTransferTotal,
      totalIncomePlusMetko: incomeTunaiTotal + incomeTransferTotal + cashSaldoAwal
    };
  }, [transactions, displayFilteredTransactions, filterType, selectedDate, selectedMonth, selectedYear, weekRange]);

  // Export report to MS Excel compatible spreadsheet
  const exportToExcel = () => {
    let filterText = "";
    if (filterType === "harian") {
      filterText = `Hari: ${new Date(selectedDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
    } else if (filterType === "mingguan") {
      filterText = `Minggu: ${weekRange.startStr} s.d. ${weekRange.endStr}`;
    } else if (filterType === "bulanan") {
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      filterText = `Bulan: ${monthNames[selectedMonth]} ${selectedYear}`;
    } else if (filterType === "tahunan") {
      filterText = `Tahun: ${selectedYear}`;
    }

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Laporan Keuangan</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #ffffff; margin: 20px; }
          .title { font-size: 16px; font-weight: bold; text-align: left; color: #1e3a8a; }
          .subtitle { font-size: 11px; text-align: left; color: #64748b; padding-bottom: 15px; }
          .section-title { font-size: 12px; font-weight: bold; background-color: #0f172a; color: #ffffff; padding: 6px 10px; border: 1px solid #000000; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 25px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 11px; vertical-align: middle; }
          .num { text-align: right; font-family: 'Courier New', monospace; font-weight: bold; }
          .bold { font-weight: bold; }
          .text-center { text-align: center; }
          .bg-light { background-color: #f8fafc; }
          .bg-total { background-color: #cbd5e1; font-weight: bold; }
          .bg-success { background-color: #d1fae5; color: #065f46; font-weight: bold; }
          .bg-info { background-color: #e0f2fe; color: #075985; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="7" class="title" style="font-size: 18px; font-weight: 900; color: #1e293b;">LAPORAN REKONSILIASI KEUANGAN</td>
          </tr>
          <tr>
            <td colspan="7" class="subtitle" style="font-weight: 600; color: #64748b;">Dompet Pintar - ${user?.name || "User"} | Periode: ${filterText}</td>
          </tr>
        </table>

        <table>
          <thead>
            <tr>
              <th colspan="2" class="section-title">REKONSILIASI PEMBUKUAN KAS</th>
            </tr>
          </thead>
          <tbody>
            <!-- PENDAPATAN TUNAI -->
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="2" style="font-weight: bold; color: #0f172a;">PENDAPATAN TUNAI</td>
            </tr>
            <tr>
              <td style="padding-left: 20px; font-weight: 500; color: #475569;">SALDO AWAL KAS TUNAI / METKO KEMARIN</td>
              <td class="num" style="color: #475569;">Rp ${pdfMetrics.cashSaldoAwal.toLocaleString("id-ID")}</td>
            </tr>
            ${pdfMetrics.incomeTunaiList.length === 0 
              ? `<tr><td style="padding-left: 20px; font-style: italic; color: #64748b;">NIHIL</td><td class="num">Rp 0</td></tr>`
              : pdfMetrics.incomeTunaiList.map(item => `
                  <tr>
                    <td style="padding-left: 20px; font-weight: 500;">${item.category}</td>
                    <td class="num">Rp ${item.amount.toLocaleString("id-ID")}</td>
                  </tr>
                `).join("")
            }
            <tr class="bg-total" style="background-color: #cbd5e1; font-weight: bold;">
              <td style="font-weight: bold; padding-left: 20px;">TOTAL</td>
              <td class="num" style="font-weight: bold;">Rp ${pdfMetrics.incomeTunaiTotal.toLocaleString("id-ID")}</td>
            </tr>

            <!-- PENGELUARAN TUNAI -->
            <tr>
              <td class="bold" style="font-weight: bold; color: #000;">PENGELUARAN TUNAI</td>
              <td class="num" style="font-weight: bold; color: #dc2626;">Rp ${pdfMetrics.expenseTunaiTotal.toLocaleString("id-ID")}</td>
            </tr>

            <!-- SISA -->
            <tr class="bg-info" style="background-color: #e0f2fe; color: #0369a1; font-weight: bold;">
              <td class="bold" style="font-weight: bold; padding-left: 10px;">SISA</td>
              <td class="num" style="font-weight: bold;">Rp ${pdfMetrics.sisaSebelumNabung.toLocaleString("id-ID")}</td>
            </tr>

            <!-- PENDAPATAN TRANSFER -->
            <tr>
              <td class="bold" style="font-weight: bold; color: #000;">PENDAPATAN TRANSFER</td>
              <td class="num" style="font-weight: bold;">Rp ${pdfMetrics.incomeTransferTotal.toLocaleString("id-ID")}</td>
            </tr>

            <!-- TOTAL PENDAPATAN -->
            <tr class="bg-total" style="background-color: #cbd5e1; font-weight: bold;">
              <td class="bold" style="font-weight: bold;">TOTAL PENDAPATAN</td>
              <td class="num" style="font-weight: bold;">Rp ${pdfMetrics.totalIncomeCombine.toLocaleString("id-ID")}</td>
            </tr>

            <!-- TOTAL PENDAPATAN + METKO KEMARIN -->
            <tr class="bg-total" style="background-color: #94a3b8; font-weight: bold; color: #fff;">
              <td class="bold" style="font-weight: bold;">TOTAL PENDAPATAN + METKO KEMARIN</td>
              <td class="num" style="font-weight: bold;">Rp ${pdfMetrics.totalIncomePlusMetko.toLocaleString("id-ID")}</td>
            </tr>

            <!-- NABUNG -->
            <tr>
              <td class="bold" style="font-weight: bold; color: #4338ca; padding-left: 10px;">NABUNG</td>
              <td class="num" style="font-weight: bold; color: #4338ca;">Rp ${pdfMetrics.nabungTotal.toLocaleString("id-ID")}</td>
            </tr>

            <!-- SISA UANG TUNAI -->
            <tr class="bg-success" style="background-color: #d1fae5; color: #065f46; font-weight: bold;">
              <td class="bold" style="font-weight: bold; padding-left: 10px;">SISA UANG TUNAI</td>
              <td class="num" style="font-weight: bold;">Rp ${pdfMetrics.sisaUangTunai.toLocaleString("id-ID")}</td>
            </tr>

            <!-- SALDO REKENING -->
            <tr style="background-color: #f1f5f9; font-weight: bold;">
              <td colspan="2" style="font-weight: bold; color: #0f172a;">SALDO REKENING</td>
            </tr>
            <tr>
              <td style="padding-left: 20px; font-weight: 500; color: #475569;">SALDO AWAL</td>
              <td class="num" style="color: #475569;">Rp ${pdfMetrics.rekeningSaldoAwal.toLocaleString("id-ID")}</td>
            </tr>
            <tr>
              <td style="padding-left: 20px; font-weight: 500; color: #059669;">PENDAPATAN TF</td>
              <td class="num" style="color: #059669;">Rp ${pdfMetrics.incomeTransferTotal.toLocaleString("id-ID")}</td>
            </tr>
            <tr>
              <td style="padding-left: 20px; font-weight: 500; color: #4f46e5;">NABUNG</td>
              <td class="num" style="color: #4f46e5;">Rp ${pdfMetrics.nabungTotal.toLocaleString("id-ID")}</td>
            </tr>
            ${pdfMetrics.expenseTransferTotal > 0 
              ? `<tr>
                  <td style="padding-left: 20px; font-weight: 500; color: #dc2626; font-style: italic;">PENGELUARAN TF</td>
                  <td class="num" style="color: #dc2626; font-style: italic;">-Rp ${pdfMetrics.expenseTransferTotal.toLocaleString("id-ID")}</td>
                </tr>`
              : ""
            }
            <tr class="bg-total" style="background-color: #0f172a; color: #ffffff; font-weight: 950; font-size: 12px;">
              <td style="font-weight: bold; padding-left: 20px;">SALDO AKHIR REKENING</td>
              <td class="num" style="font-weight: bold; color: #22c55e;">Rp ${pdfMetrics.rekeningSaldoAkhir.toLocaleString("id-ID")}</td>
            </tr>
          </tbody>
        </table>

        <table>
          <thead>
            <tr>
              <th colspan="7" class="section-title" style="background-color: #1e3a8a;">DAFTAR RINCIAN ARUS KAS TRANSAKSI</th>
            </tr>
            <tr style="background-color: #475569; color: #ffffff; font-weight: bold;">
              <th style="width: 50px; text-align: center;">No</th>
              <th style="width: 120px; text-align: center;">Tanggal</th>
              <th style="width: 160px; text-align: left;">Kategori</th>
              <th style="width: 240px; text-align: left;">Deskripsi</th>
              <th style="width: 100px; text-align: center;">Metode</th>
              <th style="width: 120px; text-align: center;">Jenis</th>
              <th style="width: 150px; text-align: right;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${chronologicalTransactions.length === 0 
              ? `<tr><td colspan="7" class="text-center" style="color: #64748b; font-style: italic;">Tidak ada catatan transaksi dalam periode ini</td></tr>`
              : chronologicalTransactions.map((tx, idx) => `
                  <tr class="${idx % 2 === 0 ? "bg-light" : ""}">
                    <td class="text-center" style="color: #64748b;">${idx + 1}</td>
                    <td class="text-center">${new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td class="bold" style="color: #0f172a;">${tx.category.toUpperCase()}</td>
                    <td style="color: #334155;">${tx.description || "-"}</td>
                    <td class="text-center" style="font-weight: 600; text-transform: uppercase;">${tx.method}</td>
                    <td class="text-center" style="font-weight: bold; color: ${tx.type === "pemasukan" ? "#059669" : tx.type === "pengeluaran" ? "#dc2626" : "#2563eb"}">
                      ${tx.type === "pemasukan" ? "MASUK" : tx.type === "pengeluaran" ? "KELUAR" : "NABUNG"}
                    </td>
                    <td class="num" style="color: ${tx.type === "pemasukan" ? "#047857" : tx.type === "pengeluaran" ? "#b91c1c" : "#4f46e5"}">
                      ${tx.type === "pengeluaran" ? "-" : tx.type === "pemasukan" ? "+" : ""}Rp ${tx.amount.toLocaleString("id-ID")}
                    </td>
                  </tr>
                `).join("")
            }
          </tbody>
        </table>
        
        <table style="border: none !important; margin-top: 40px; width: 100%;">
          <tr style="border: none !important;">
            <td style="border: none !important; width: 50%; text-align: center; font-size: 10px;">
              Petugas Audit Keuangan Digital,<br/><br/><br/><br/>
              <strong>( ${user?.name || "Sistem Dompet Pintar"} )</strong>
            </td>
            <td style="border: none !important; width: 50%; text-align: center; font-size: 10px;">
              Mengetahui dan Disetujui,<br/><br/><br/><br/>
              <strong>( Kepala Pengawas Finansial )</strong>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const processedHtmlContent = htmlContent
      .replace(/\bGAJI\b/g, "PENDAPATAN / OMZET")
      .replace(/\bGaji\b/g, "Pendapatan / Omzet")
      .replace(/\bgaji\b/g, "pendapatan / omzet");

    const blob = new Blob([processedHtmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    let periodName = "Bulanan";
    if (filterType === "harian") periodName = `Harian_${selectedDate}`;
    else if (filterType === "mingguan") periodName = `Mingguan_${weekRange.startStr}_ke_${weekRange.endStr}`;
    else if (filterType === "bulanan") periodName = `Bulanan_${selectedYear}_${selectedMonth + 1}`;
    else if (filterType === "tahunan") periodName = `Tahunan_${selectedYear}`;

    link.setAttribute("download", `Laporan_Keuangan_DompetPintar_${periodName}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic trend computation based on selected filter
  const currentTrendData = useMemo(() => {
    if (filterType === "harian") {
      // 7 days trend leading up to selected date
      const data = [];
      const base = new Date(selectedDate);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(base);
        d.setDate(base.getDate() - i);
        const dStr = d.toISOString().split("T")[0];
        const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
        data.push({
          key: dStr,
          label,
          income: 0,
          expense: 0,
          savings: 0
        });
      }

      transactions.forEach((tx) => {
        const match = data.find(item => item.key === tx.date);
        if (match) {
          if (tx.type === "pemasukan") match.income += tx.amount;
          else if (tx.type === "pengeluaran") match.expense += tx.amount;
          else if (tx.type === "nabung") match.savings += tx.amount;
        }
      });
      return data;
    }

    if (filterType === "mingguan") {
      // 7 individual days of the selected week (Monday to Sunday)
      const data = [];
      const daysLabel = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekRange.start);
        d.setDate(weekRange.start.getDate() + i);
        const dStr = d.toISOString().split("T")[0];
        data.push({
          key: dStr,
          label: daysLabel[i],
          income: 0,
          expense: 0,
          savings: 0
        });
      }

      transactions.forEach((tx) => {
        const match = data.find(item => item.key === tx.date);
        if (match) {
          if (tx.type === "pemasukan") match.income += tx.amount;
          else if (tx.type === "pengeluaran") match.expense += tx.amount;
          else if (tx.type === "nabung") match.savings += tx.amount;
        }
      });
      return data;
    }

    if (filterType === "bulanan") {
      // 6 calendar segments of 5 days each for the selected month
      const segments = [
        { key: "1-5", label: "Tgl 1-5", min: 1, max: 5, income: 0, expense: 0, savings: 0 },
        { key: "6-10", label: "Tgl 6-10", min: 6, max: 10, income: 0, expense: 0, savings: 0 },
        { key: "11-15", label: "Tgl 11-15", min: 11, max: 15, income: 0, expense: 0, savings: 0 },
        { key: "16-20", label: "Tgl 16-20", min: 16, max: 20, income: 0, expense: 0, savings: 0 },
        { key: "21-25", label: "Tgl 21-25", min: 21, max: 25, income: 0, expense: 0, savings: 0 },
        { key: "26+", label: "Tgl 26+", min: 26, max: 31, income: 0, expense: 0, savings: 0 },
      ];

      transactions.forEach((tx) => {
        if (!tx.date) return;
        const d = new Date(tx.date);
        if (d.getFullYear() === selectedYear && d.getMonth() === selectedMonth) {
          const dateNum = d.getDate();
          const seg = segments.find(s => dateNum >= s.min && dateNum <= s.max);
          if (seg) {
            if (tx.type === "pemasukan") seg.income += tx.amount;
            else if (tx.type === "pengeluaran") seg.expense += tx.amount;
            else if (tx.type === "nabung") seg.savings += tx.amount;
          }
        }
      });
      return segments;
    }

    // tahunan
    // 12 months dataset for the selected year
    const monthsData = Array.from({ length: 12 }, (_, i) => ({
      key: i.toString(),
      label: MONTH_SHORT[i],
      income: 0,
      expense: 0,
      savings: 0
    }));

    transactions.forEach((tx) => {
      if (!tx.date) return;
      const d = new Date(tx.date);
      if (d.getFullYear() === selectedYear) {
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          if (tx.type === "pemasukan") monthsData[m].income += tx.amount;
          else if (tx.type === "pengeluaran") monthsData[m].expense += tx.amount;
          else if (tx.type === "nabung") monthsData[m].savings += tx.amount;
        }
      }
    });
    return monthsData;
  }, [transactions, filterType, selectedDate, selectedMonth, selectedYear, weekRange]);

  // Compute boundaries for drawing the modern custom chart
  const chartMetrics = useMemo(() => {
    let maxVal = 50000;
    currentTrendData.forEach(item => {
      if (item.income > maxVal) maxVal = item.income;
      if (item.expense > maxVal) maxVal = item.expense;
    });
    const ceilingValue = maxVal * 1.15; // padding
    return { ceilingValue };
  }, [currentTrendData]);

  // Modern SVG Pie Donut Chart renderer
  const customDonutChart = useMemo(() => {
    const list = stats.categoriesExpense;
    if (list.length === 0) return null;
    
    let cumulativePercent = 0;
    const slices = list.map((item, idx) => {
      const percentage = item.percentage;
      const startPercent = cumulativePercent;
      cumulativePercent += percentage;
      
      const startAngle = (startPercent / 100) * 360 - 90;
      const endAngle = (cumulativePercent / 100) * 360 - 90;
      
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const r = 50;
      const cx = 60;
      const cy = 60;
      
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      
      const largeArcFlag = percentage > 50 ? 1 : 0;
      const pathData = [
        `M ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${cx} ${cy}`,
        "Z"
      ].join(" ");
      
      return {
        path: pathData,
        color: item.color,
        category: item.category,
        percentage
      };
    });
    
    return (
      <div className="relative group select-none">
        <svg viewBox="0 0 120 120" className="w-56 h-56 mx-auto drop-shadow-md">
          {slices.map((slice, i) => (
            <path
              key={i}
              d={slice.path}
              fill={slice.color}
              className="transition-all duration-300 hover:opacity-90 hover:scale-[1.02] origin-center cursor-pointer"
            >
              <title>{slice.category}: {slice.percentage.toFixed(1)}%</title>
            </path>
          ))}
          <circle cx="60" cy="60" r="34" fill="#ffffff" className="shadow-inner" />
          <foreignObject x="30" y="30" width="60" height="60" className="text-center">
            <div className="w-full h-full flex flex-col items-center justify-center">
              <span className="text-[7px] uppercase font-bold text-slate-400 block leading-none">Pengeluaran</span>
              <span className="text-xs font-black text-slate-700 mt-1 leading-none">Pos Belanja</span>
              <span className="text-[8px] font-medium text-indigo-600 mt-0.5">{list.length} Kategori</span>
            </div>
          </foreignObject>
        </svg>
      </div>
    );
  }, [stats.categoriesExpense]);

  // Render the modern glowing custom coordinate line/area chart
  const renderTrendChart = () => {
    const totalPoints = currentTrendData.length;
    const svgWidth = 500;
    const svgHeight = 220;
    const axisLeftMargin = 60;
    const axisBottomMargin = 30;
    const axisTopMargin = 15;
    const axisRightMargin = 15;

    const plotWidth = svgWidth - axisLeftMargin - axisRightMargin;
    const plotHeight = svgHeight - axisTopMargin - axisBottomMargin;
    const ceilingValue = chartMetrics.ceilingValue;

    // Build the line vector commands
    let incPointsStr = "";
    let expPointsStr = "";

    const coords = currentTrendData.map((item, idx) => {
      const x = axisLeftMargin + (idx * plotWidth) / (totalPoints - 1 || 1);
      const yInc = axisTopMargin + plotHeight - (item.income / ceilingValue) * plotHeight;
      const yExp = axisTopMargin + plotHeight - (item.expense / ceilingValue) * plotHeight;
      return { x, yInc, yExp, item };
    });

    coords.forEach((c, i) => {
      if (i === 0) {
        incPointsStr = `M ${c.x} ${c.yInc}`;
        expPointsStr = `M ${c.x} ${c.yExp}`;
      } else {
        incPointsStr += ` L ${c.x} ${c.yInc}`;
        expPointsStr += ` L ${c.x} ${c.yExp}`;
      }
    });

    const incAreaStr = coords.length > 0 
      ? `${incPointsStr} L ${axisLeftMargin + plotWidth} ${axisTopMargin + plotHeight} L ${axisLeftMargin} ${axisTopMargin + plotHeight} Z`
      : "";

    const expAreaStr = coords.length > 0
      ? `${expPointsStr} L ${axisLeftMargin + plotWidth} ${axisTopMargin + plotHeight} L ${axisLeftMargin} ${axisTopMargin + plotHeight} Z`
      : "";

    // Generate grid lines
    const gridRows = 4;
    const gridLines = Array.from({ length: gridRows }, (_, i) => {
      const value = (ceilingValue * i) / (gridRows - 1);
      const y = axisTopMargin + plotHeight - (value / ceilingValue) * plotHeight;
      return { y, value };
    });

    const formatShortCompactVal = (val: number) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace(/\.0$/, "")}jt`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
      return val.toString();
    };

    return (
      <div className="relative bg-white rounded-3xl border border-slate-100 p-4 shadow-sm w-full">
        {/* Tooltip Popup absolute on Hover */}
        {hoveredIdx !== null && currentTrendData[hoveredIdx] && (
          <div 
            className="absolute bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl text-[11px] space-y-1.5 z-20 pointer-events-none transition-all duration-150 border border-slate-800"
            style={{
              left: `${Math.min(
                Math.max(15, ((60 + (hoveredIdx * plotWidth) / (totalPoints - 1 || 1)) / svgWidth) * 100),
                82
              )}%`,
              top: "32px",
              transform: "translateX(-50%)"
            }}
          >
            <p className="font-bold border-b border-slate-800 pb-1 text-slate-300 text-center">
              {currentTrendData[hoveredIdx].label}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className="text-slate-400">Pemasukan:</span>
              <span className="text-emerald-400 font-bold font-mono text-right">
                Rp {currentTrendData[hoveredIdx].income.toLocaleString("id-ID")}
              </span>
              <span className="text-slate-400">Pengeluaran:</span>
              <span className="text-red-400 font-bold font-mono text-right">
                Rp {currentTrendData[hoveredIdx].expense.toLocaleString("id-ID")}
              </span>
              {currentTrendData[hoveredIdx].savings > 0 && (
                <>
                  <span className="text-slate-400 font-semibold">Tabungan:</span>
                  <span className="text-indigo-400 font-bold font-mono text-right">
                    Rp {currentTrendData[hoveredIdx].savings.toLocaleString("id-ID")}
                  </span>
                </>
              )}
              <span className="text-white border-t border-slate-800 pt-1">Selisih:</span>
              <span className={`border-t border-slate-800 pt-1 font-bold font-mono text-right ${
                currentTrendData[hoveredIdx].income - currentTrendData[hoveredIdx].expense >= 0 
                  ? "text-emerald-400" 
                  : "text-red-400"
              }`}>
                Rp {(currentTrendData[hoveredIdx].income - currentTrendData[hoveredIdx].expense).toLocaleString("id-ID")}
              </span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto min-w-[480px]">
            {/* Definitions representing modern gradient fills */}
            <defs>
              <linearGradient id="incomeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.00"/>
              </linearGradient>
              <linearGradient id="expenseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.20"/>
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.00"/>
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {gridLines.map((line, i) => (
              <g key={i} className="opacity-45">
                <line 
                  x1={axisLeftMargin}
                  y1={line.y}
                  x2={svgWidth - axisRightMargin}
                  y2={line.y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text 
                  x={axisLeftMargin - 8}
                  y={line.y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-[9px] font-semibold"
                >
                  {formatShortCompactVal(line.value)}
                </text>
              </g>
            ))}

            {/* Area Fills inside charts */}
            {incAreaStr && (
              <path 
                d={incAreaStr} 
                fill="url(#incomeAreaGrad)" 
                className="transition-all duration-300"
              />
            )}
            {expAreaStr && (
              <path 
                d={expAreaStr} 
                fill="url(#expenseAreaGrad)" 
                className="transition-all duration-300"
              />
            )}

            {/* Smooth line strokes */}
            {incPointsStr && (
              <path 
                d={incPointsStr} 
                fill="none" 
                stroke="#10B981" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            )}
            {expPointsStr && (
              <path 
                d={expPointsStr} 
                fill="none" 
                stroke="#EF4444" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                className="transition-all duration-300"
              />
            )}

            {/* Data nodes (circles representing points) */}
            {coords.map((c, i) => (
              <g key={i} className="group cursor-pointer">
                {/* Active hover vertical line highlight */}
                {hoveredIdx === i && (
                  <line 
                    x1={c.x}
                    y1={axisTopMargin}
                    x2={c.x}
                    y2={axisTopMargin + plotHeight}
                    stroke="#818CF8"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    className="opacity-75"
                  />
                )}

                {/* Income point dot */}
                {c.item.income > 0 && (
                  <circle 
                    cx={c.x}
                    cy={c.yInc}
                    r={hoveredIdx === i ? "5.5" : "3.5"}
                    fill="#10B981"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    className="transition-all duration-200"
                  />
                )}

                {/* Expense point dot */}
                {c.item.expense > 0 && (
                  <circle 
                    cx={c.x}
                    cy={c.yExp}
                    r={hoveredIdx === i ? "5.5" : "3.5"}
                    fill="#EF4444"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    className="transition-all duration-200"
                  />
                )}

                {/* X Axis bottom labels */}
                <text 
                  x={c.x}
                  y={axisTopMargin + plotHeight + 18}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-bold"
                >
                  {c.item.label}
                </text>
              </g>
            ))}

            {/* Hover overlay areas (columns) for easy selection */}
            {coords.map((c, i) => {
              const colWidth = plotWidth / (totalPoints || 1);
              const xStart = c.x - colWidth / 2;
              return (
                <rect 
                  key={i}
                  x={xStart}
                  y={axisTopMargin}
                  width={colWidth}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div id="report-view-container" className="space-y-6">
      
      {/* Dynamic Date, Month, Year Filter Header card configuration */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4 no-print">
        
        {/* Row 1: Filter Tab Mode Pickers */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">Filter Analitik Modern</h3>
              <p className="text-[10px] text-slate-400 font-medium">Saring laporan sesuai kebutuhan waktu Anda</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl w-fit">
              <button
                onClick={() => { setFilterType("harian"); setHoveredIdx(null); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === "harian" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Harian
              </button>
              <button
                onClick={() => { setFilterType("mingguan"); setHoveredIdx(null); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === "mingguan" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Mingguan
              </button>
              <button
                onClick={() => { setFilterType("bulanan"); setHoveredIdx(null); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === "bulanan" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Bulanan
              </button>
              <button
                onClick={() => { setFilterType("tahunan"); setHoveredIdx(null); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterType === "tahunan" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tahunan
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPdfGuide(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all duration-250 shadow-sm hover:shadow-emerald-200"
              >
                <FileDown className="w-4 h-4" />
                <span>Ekspor ke PDF</span>
              </button>

              <button
                onClick={exportToExcel}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all duration-250 shadow-sm hover:shadow-teal-200"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ekspor ke Excel</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all duration-250 shadow-sm hover:shadow-indigo-200"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Laporan</span>
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100" />

        {/* Row 2: Dynamic Input Sizing Controllers depending on state */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Arrow Scrollers widget */}
          <div className="md:col-span-5 flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 justify-between">
            <button
              onClick={() => shiftPeriod("prev")}
              className="p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 shadow-xs cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <span className="text-xs uppercase font-extrabold text-slate-400 block tracking-widest text-[8px] leading-none">Periode Terpiliih</span>
              <span className="text-xs font-bold text-indigo-900 tracking-tight block mt-1">
                {formattedPeriodLabel}
              </span>
            </div>
            <button
              onClick={() => shiftPeriod("next")}
              className="p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 shadow-xs cursor-pointer transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Form control dropdown fields */}
          <div className="md:col-span-7 flex flex-wrap gap-3 items-center">
            
            {/* Input Date Picker for Harian */}
            {filterType === "harian" && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pilih Tanggal Spesifik</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-indigo-500 pointer-events-none" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-indigo-500 cursor-pointer text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Input Date Picker for Mingguan */}
            {filterType === "mingguan" && (
              <div className="flex-1 min-w-[200px]">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pilih Acuan Tanggal Minggu</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-indigo-500 pointer-events-none" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-indigo-500 cursor-pointer text-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Dropdowns for Bulanan */}
            {filterType === "bulanan" && (
              <>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pilih Bulan</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(parseInt(e.target.value));
                      setHoveredIdx(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-indigo-500 cursor-pointer"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="w-[100px]">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tahun</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(parseInt(e.target.value));
                      setHoveredIdx(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-indigo-500 cursor-pointer"
                  >
                    {availableYears.map(yr => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Year lists only for Tahunan */}
            {filterType === "tahunan" && (
              <div className="flex-1 min-w-[150px]">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Pilih Tahun Analitik</label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(parseInt(e.target.value));
                    setHoveredIdx(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 focus:outline-indigo-500 cursor-pointer"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>Tahun {yr}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick reset button */}
            <button 
              type="button"
              onClick={() => {
                const today = new Date();
                setSelectedDate(today.toISOString().split("T")[0]);
                setSelectedMonth(today.getMonth());
                setSelectedYear(today.getFullYear());
                setHoveredIdx(null);
              }}
              title="Reset ke Sekarang"
              className="p-2 bg-slate-100 hover:bg-slate-200 hover:text-indigo-700 text-slate-500 rounded-xl mt-4 self-end transition-colors cursor-pointer border border-slate-200 shadow-2xs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>

      <div className="no-print space-y-6">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white py-16 px-6 rounded-3xl shadow-sm border border-slate-100 text-center animate-fade-in">
            <div className="w-14 h-14 bg-slate-50 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-dashed border-slate-200">
              <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Tidak Ada Rekaman Pembukuan</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Tidak ada pemasukan, pengeluaran atau transaksi tabungan pada periode {formattedPeriodLabel} yang dipilih.
            </p>
          </div>
        ) : (
          <>
            {/* PRESETS ON-SCREEN RECONCILIATION SUMMARY BOX matching requested PDF format */}
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-200/80 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-850">Format Rekonsiliasi &amp; Ekspor Pembukuan</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Bentuk pratinjau format standar laporan keuangan versi cetak / PDF</p>
                </div>
              </div>

              {/* Exact format layout requested by user */}
              <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono text-xs text-slate-800 leading-relaxed">
                
                {/* Column 1: Pendapatan Tunai, Pengeluaran Tunai & Sisa */}
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-2xs space-y-1.5">
                    <div className="font-extrabold text-indigo-950 uppercase tracking-wider text-[11px] border-b pb-1 border-slate-100 flex items-center justify-between">
                      <span>SALDO AWAL KAS TUNAI / METKO KEMARIN</span>
                      <Wallet className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600">RP</span>
                      <span className="font-bold text-slate-900">{pdfMetrics.cashSaldoAwal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-2xs space-y-2">
                    <div className="font-extrabold text-indigo-950 uppercase tracking-wider text-[11px] border-b pb-1 border-slate-100">
                      PENDAPATAN TUNAI
                    </div>
                    {pdfMetrics.incomeTunaiList.length === 0 ? (
                      <div className="text-slate-400 italic text-[11px] py-1">NIHIL</div>
                    ) : (
                      <div className="space-y-1">
                        {pdfMetrics.incomeTunaiList.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-[11px]">
                            <span className="text-slate-600">{item.category}</span>
                            <span className="font-bold">Rp {item.amount.toLocaleString("id-ID")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-[#000] border-t border-slate-100 pt-1.5 mt-1 text-[11px]">
                      <span>TOTAL</span>
                      <span>Rp {pdfMetrics.incomeTunaiTotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-2xs space-y-1.5">
                    <div className="font-extrabold text-indigo-950 uppercase tracking-wider text-[11px] border-b pb-1 border-slate-100">
                      PENGELUARAN TUNAI
                    </div>
                    <div className="flex justify-between text-red-650 text-[11px] font-bold">
                      <span className="text-slate-650">Total</span>
                      <span>Rp {pdfMetrics.expenseTunaiTotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-150 shadow-2xs space-y-1.5">
                    <div className="font-extrabold text-indigo-950 uppercase tracking-wider text-[11px] border-b pb-1 border-indigo-250/20">
                      SISA
                    </div>
                    <div className="flex justify-between text-indigo-900 text-[11px] font-black">
                      <span className="text-slate-650">Sisa Kas Tunai</span>
                      <span>Rp {pdfMetrics.sisaSebelumNabung.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Nabung & Sisa Uang Tunai */}
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-2xs space-y-1.5">
                    <div className="font-extrabold text-indigo-950 uppercase tracking-wider text-[11px] border-b pb-1 border-slate-100">
                      PENDAPATAN TRANSFER
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600">RP</span>
                      <span className="font-bold">{pdfMetrics.incomeTransferTotal.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-100 pt-1.5 mt-1 text-[11px]">
                      <span>TOTAL PENDAPATAN</span>
                      <span className="text-indigo-700">Rp {pdfMetrics.totalIncomeCombine.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900 border-t border-slate-100 pt-1.5 mt-1 text-[11px]">
                      <span>TOTAL PENDAPATAN + METKO KEMARIN</span>
                      <span className="text-indigo-700">Rp {pdfMetrics.totalIncomePlusMetko.toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-2xs space-y-1.5">
                    <div className="font-extrabold text-indigo-950 uppercase tracking-wider text-[11px] border-b pb-1 border-slate-100">
                      NABUNG
                    </div>
                    <div className="flex justify-between text-amber-700 text-[11px]">
                      <span className="text-slate-600">Rp</span>
                      <span className="font-black">Rp {pdfMetrics.nabungTotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>

                  <div className="bg-[#ecfdf5] p-4 rounded-xl border border-emerald-250 shadow-2xs space-y-1.5">
                    <div className="font-extrabold text-emerald-950 uppercase tracking-wider text-[11px] border-b pb-1 border-emerald-150">
                      SISA UANG TUNAI
                    </div>
                    <div className="flex justify-between text-emerald-800 text-[11px]">
                      <span className="text-emerald-700 font-bold">Rp.</span>
                      <span className="font-black">Rp {pdfMetrics.sisaUangTunai.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Saldo Rekening */}
                <div className="md:col-span-2 lg:col-span-1">
                  <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-2xs space-y-2 h-full flex flex-col justify-between">
                    <div>
                      <div className="font-extrabold text-indigo-300 uppercase tracking-wider text-[11px] border-b pb-1 border-slate-800">
                        SALDO REKENING
                      </div>
                      <div className="space-y-1.5 text-[11px] mt-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">SALDO AWAL</span>
                          <span className="font-bold text-white">Rp {pdfMetrics.rekeningSaldoAwal.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">PENDAPATAN TF</span>
                          <span className="font-bold text-emerald-400">Rp {pdfMetrics.incomeTransferTotal.toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">NABUNG</span>
                          <span className="font-bold text-amber-400">Rp {pdfMetrics.nabungTotal.toLocaleString("id-ID")}</span>
                        </div>
                        {pdfMetrics.expenseTransferTotal > 0 && (
                          <div className="flex justify-between text-red-400 italic font-mono">
                            <span className="text-slate-450 text-[10px]">PENGELUARAN TF</span>
                            <span className="font-bold text-[10px]">-Rp {pdfMetrics.expenseTransferTotal.toLocaleString("id-ID")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-between font-black text-indigo-200 border-t border-slate-800 pt-2 mt-4 text-[12px]">
                      <span>SALDO AKHIR REKENING</span>
                      <span className="text-emerald-400 font-mono">Rp {pdfMetrics.rekeningSaldoAkhir.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Column Left: Visual stats totals cockpit */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Net Savings Box */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-md border border-indigo-950 relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-indigo-500 opacity-10 rounded-full blur-xl pointer-events-none" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Selisih Bersih (Pencapaian)</span>
                <h3 className={`text-2xl font-black tracking-tight mt-1.5 ${stats.netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {stats.netBalance >= 0 ? "+" : ""}
                  Rp {stats.netBalance.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>Pembukuan Arus Kas Periode Terpilih</span>
                </p>
              </div>

              {/* Automatic Tabungan box */}
              {stats.savingTotal > 0 && (
                <div className="bg-emerald-50/70 border border-emerald-100/60 p-4 rounded-3xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400 block">Dana Terpindahkan</span>
                      <span className="text-xs font-bold text-emerald-900">Rp {stats.savingTotal.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                  <span className="bg-emerald-100/50 text-emerald-800 px-2 py-0.5 rounded-lg text-[9px] font-bold border border-emerald-200/50">Nabung Aman</span>
                </div>
              )}

              {/* Split Tunai vs Transfer (Aliran Dana Otomatis) */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Rincian Jenis Pembayaran</span>
                </h3>

                <div className="space-y-4 pt-1">
                  {/* Pemasukan block */}
                  <div>
                    <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest block mb-2">Sumber Pemasukan</span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-medium text-slate-400 block mb-0.5">TUNAI</span>
                        <span className="text-xs font-bold text-slate-800 block">
                          Rp {stats.incomeTunai.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-medium text-slate-400 block mb-0.5">TRANSFER/BANK</span>
                        <span className="text-xs font-bold text-slate-800 block">
                          Rp {stats.incomeTransfer.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-150 border-dashed" />

                  {/* Pengeluaran block */}
                  <div>
                    <span className="text-[10px] font-extrabold text-red-500 uppercase tracking-widest block mb-2">Pos Pengeluaran</span>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-medium text-slate-400 block mb-0.5">TUNAI</span>
                        <span className="text-xs font-bold text-slate-700 block">
                          Rp {stats.expenseTunai.toLocaleString("id-ID")}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] font-medium text-slate-400 block mb-0.5">TRANSFER/BANK</span>
                        <span className="text-xs font-bold text-slate-700 block">
                          Rp {stats.expenseTransfer.toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Column Right: Interactive Trend Chart & Breakdown grids */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Visual Modern Trend Charts Card component */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-indigo-600" />
                      <span>Tren Arus Kas Keuangan</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Layout pergerakan saldo tunai masuk (hijau) vs keluar (merah)</p>
                  </div>
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Grafik Interaktif
                  </span>
                </div>

                {renderTrendChart()}
              </div>

              {/* Category breakdown dual boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Pie/Donut Chart visual */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2 tracking-wide">
                      <PieChart className="w-4 h-4 text-pink-500" />
                      <span>Distribusi Pengeluaran</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Beban alokasi per kategori pos pembelanjaan</p>
                  </div>

                  <div className="flex justify-center py-2">
                    {customDonutChart || (
                      <p className="text-xs text-slate-400 italic py-6">Belum ada pengeluaran pada periode ini.</p>
                    )}
                  </div>

                  {/* Donut Legend items */}
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {stats.categoriesExpense.slice(0, 4).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600 font-medium truncate">{item.category}</span>
                        </div>
                        <span className="font-bold text-slate-800 font-mono text-[11px]">
                          {item.percentage.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cash Progress targets table limits */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-2 tracking-wide">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span>Aliran Pemasukan</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">Sumber dana pemasukan saku & bank</p>
                  </div>

                  {stats.categoriesIncome.length === 0 ? (
                    <div className="h-56 flex items-center justify-center text-xs text-slate-400 italic border border-dashed border-slate-100 rounded-2xl">
                      Belum ada dana masuk pada periode ini
                    </div>
                  ) : (
                    <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
                      {stats.categoriesIncome.map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-700">{item.category}</span>
                            <span className="font-extrabold text-emerald-600 font-mono">
                              Rp {item.amount.toLocaleString("id-ID")}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.percentage}%` }}
                              transition={{ duration: 0.5 }}
                              className="bg-emerald-500 h-full rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Comprehensive category table with indicators */}
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <h4 className="text-sm font-black text-slate-800 mb-4">Urutan Beban Belanja (Tertinggi)</h4>
                
                {stats.categoriesExpense.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada pengeluaran belanja yang tercatat.</p>
                ) : (
                  <div className="space-y-3.5">
                    {stats.categoriesExpense.map((item, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">{item.category}</span>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-slate-500">Rp {item.amount.toLocaleString("id-ID")}</span>
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              {item.percentage.toFixed(1)}% porsi
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.percentage}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>

          </>
        )}
      </div>

      {/* ================= PRINT CHRONICLE (ONLY SHOWN IN PRINTER / EXP PDF) ================= */}
      <div className="hidden only-print print-container font-sans text-black p-8 space-y-6">
        
        {/* Kop Surat / Letterhead */}
        <div className="border-b-4 border-double border-slate-900 pb-4 text-center">
          <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900">
            {companyProfile?.name || "DN MANAJEMEN KEUANGAN"}
          </h1>
          {companyProfile ? (
            <div className="text-[10px] text-slate-600 mt-1 space-y-0.5">
              <p className="font-semibold">{companyProfile.businessType}</p>
              <p>{companyProfile.address}</p>
              <p className="font-mono">Telp: {companyProfile.phone} | Surel: {companyProfile.email} | NPWP: {companyProfile.npwp}</p>
            </div>
          ) : (
            <p className="text-xs tracking-widest text-slate-500 uppercase mt-1">Sistem Laporan Pembukuan Kas Personal &amp; Bisnis Terintegrasi</p>
          )}
          
          <div className="mt-4 flex justify-between items-center px-1 text-[9px] font-mono text-slate-500">
            <span>Model: Sistem Kas DN Manajemen Keuangan</span>
            <span>Tanggal Cetak: {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} WIB</span>
          </div>
        </div>

        {/* User Identity Info */}
        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disusun Oleh/Untuk:</span>
            <p className="font-bold text-slate-800 text-sm mt-0.5">{user?.name || "Pengguna Sistem"}</p>
            <p className="font-mono text-slate-500 text-[10px] mt-0.5">Username: @{user?.username || "user"}</p>
            <p className="text-slate-500 text-[10px]">Email: {user?.email || "-"}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Periode Laporan:</span>
            <p className="font-extrabold text-indigo-900 text-sm mt-0.5 uppercase tracking-wide">{formattedPeriodLabel}</p>
            <p className="text-slate-500 text-[10px] mt-0.5">Filter Jenis: {filterType === 'harian' ? 'Harian' : filterType === 'mingguan' ? 'Mingguan (7 Hari)' : filterType === 'bulanan' ? 'Bulanan' : 'Tahunan'}</p>
            <p className="text-slate-500 text-[10px]">Jumlah Ledger: {filteredTransactions.length} transaksi</p>
          </div>
        </div>

        {/* ================= EXACT USER REQUESTED RECONCILIATION FORMAT SECTION ================= */}
        <div className="border-2 border-slate-900 p-8 rounded-lg font-mono text-xs text-slate-900 space-y-6 max-w-2xl mx-auto tracking-wide" style={{ lineHeight: "1.6" }}>
          
          {/* PENDAPATAN TUNAI */}
          <div className="space-y-1">
            <div className="font-extrabold">PENDAPATAN TUNAI</div>
            <div className="flex justify-between pl-6 font-medium text-slate-600 italic">
              <span>SALDO AWAL KAS TUNAI / METKO KEMARIN</span>
              <span>Rp {pdfMetrics.cashSaldoAwal.toLocaleString("id-ID")}</span>
            </div>
            {pdfMetrics.incomeTunaiList.length === 0 ? (
              <div className="pl-6 text-slate-500">NIHIL Rp 0</div>
            ) : (
              pdfMetrics.incomeTunaiList.map((item, idx) => (
                <div key={idx} className="flex justify-between pl-6 font-medium">
                  <span>{item.category}</span>
                  <span>Rp {item.amount.toLocaleString("id-ID")}</span>
                </div>
              ))
            )}
            <div className="flex justify-between font-extrabold border-t border-slate-900 pt-1 mt-1 pl-6">
              <span>TOTAL</span>
              <span>Rp {pdfMetrics.incomeTunaiTotal.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* PENGELUARAN TUNAI */}
          <div className="space-y-1 pt-1">
            <div className="font-extrabold">PENGELUARAN TUNAI</div>
            <div className="flex justify-between pl-6 font-medium">
              <span>Total</span>
              <span>Rp {pdfMetrics.expenseTunaiTotal.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* SISA */}
          <div className="space-y-1 pt-1">
            <div className="font-extrabold pb-0.5 border-b border-dashed border-slate-300">SISA</div>
            <div className="flex justify-between pl-6 font-extrabold pt-0.5">
              <span>Rp</span>
              <span>Rp {pdfMetrics.sisaSebelumNabung.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* PENDAPATAN TRANSFER */}
          <div className="space-y-1 pt-1">
            <div className="font-extrabold">PENDAPATAN TRANSFER</div>
            <div className="flex justify-between pl-6 font-medium">
              <span>RP</span>
              <span>{pdfMetrics.incomeTransferTotal.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between font-extrabold border-t border-slate-900 pt-1 mt-1 pl-6">
              <span>TOTAL PENDAPATAN</span>
              <span>Rp {pdfMetrics.totalIncomeCombine.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between font-black border-t border-slate-900 pt-1 mt-1 pl-6">
              <span>TOTAL PENDAPATAN + METKO KEMARIN</span>
              <span>Rp {pdfMetrics.totalIncomePlusMetko.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* NABUNG */}
          <div className="space-y-1 pt-1">
            <div className="font-extrabold">NABUNG</div>
            <div className="flex justify-between pl-6 font-extrabold">
              <span>Rp</span>
              <span>Rp {pdfMetrics.nabungTotal.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* SISA UANG TUNAI */}
          <div className="space-y-1 pt-1">
            <div className="font-extrabold">SISA UANG TUNAI</div>
            <div className="flex justify-between pl-6 font-extrabold">
              <span>Rp.</span>
              <span>Rp {pdfMetrics.sisaUangTunai.toLocaleString("id-ID")}</span>
            </div>
          </div>

          {/* SALDO REKENING */}
          <div className="space-y-1 pt-1">
            <div className="font-extrabold">SALDO REKENING</div>
            <div className="space-y-1 pl-6">
              <div className="flex justify-between font-medium">
                <span>SALDO AWAL</span>
                <span>Rp {pdfMetrics.rekeningSaldoAwal.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>PENDAPATAN TF</span>
                <span>Rp {pdfMetrics.incomeTransferTotal.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>NABUNG</span>
                <span>Rp {pdfMetrics.nabungTotal.toLocaleString("id-ID")}</span>
              </div>
              {pdfMetrics.expenseTransferTotal > 0 && (
                <div className="flex justify-between italic text-slate-700 font-medium">
                  <span>PENGELUARAN TF</span>
                  <span>-Rp {pdfMetrics.expenseTransferTotal.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold border-t-2 border-slate-900 pt-2 mt-2 text-sm text-[#000]">
                <span>SALDO AKHIR REKENING</span>
                <span>Rp {pdfMetrics.rekeningSaldoAkhir.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed ledger table in PDF */}
        <div className="space-y-2 pt-2 page-break-before">
          <h3 className="text-[10px] font-extrabold uppercase tracking-widest text-[#1e293b] border-b border-[#cbd5e1] pb-1">Daftar Rincian Arus Kas Transaksi</h3>
          
          {chronologicalTransactions.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">Belum ada transaksi terekam pada periode ini.</p>
          ) : (
            <table className="print-table w-full text-[9px]">
              <thead>
                <tr>
                  <th className="w-8 text-center">No</th>
                  <th className="w-24 text-left">Tanggal</th>
                  <th className="text-left">Kategori</th>
                  <th className="text-left">Keterangan / Deskripsi</th>
                  <th className="w-14 text-center">Metode</th>
                  <th className="w-20 text-center">Tipe Transaksi</th>
                  <th className="w-28 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody>
                {chronologicalTransactions.map((tx, idx) => (
                  <tr key={tx.id}>
                    <td className="text-center text-slate-500">{idx + 1}</td>
                    <td className="font-mono">{new Date(tx.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="font-bold text-[#0f172a]">{tx.category}</td>
                    <td className="text-slate-650 italic">{tx.description || "-"}</td>
                    <td className="text-center lowercase text-slate-500 font-mono text-[8px]">{tx.method}</td>
                    <td className="text-center capitalize font-bold">
                      <span className="print-badge">
                        {tx.type === "pemasukan" ? "Masuk" : tx.type === "pengeluaran" ? "Keluar" : "Celengan"}
                      </span>
                    </td>
                    <td className={`text-right font-bold font-mono text-[10px] ${tx.type === "pemasukan" ? "text-emerald-700" : tx.type === "pengeluaran" ? "text-red-700" : "text-indigo-700"}`}>
                      {tx.type === "pengeluaran" ? "-" : tx.type === "pemasukan" ? "+" : ""}Rp {tx.amount.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tanda Tangan Section */}
        <div className="grid grid-cols-2 gap-4 pt-10 text-[9px]">
          <div className="text-center h-20 flex flex-col justify-between">
            <span className="text-slate-600">Disetujui &amp; Disahkan Oleh,</span>
            <div className="border-t border-slate-800 w-32 mx-auto pt-1 font-bold">
              (................................)
            </div>
          </div>
          <div className="text-center h-20 flex flex-col justify-between">
            <span className="text-slate-600">Penanggung Jawab Laporan,</span>
            <div className="border-t border-slate-800 w-32 mx-auto pt-1 font-bold">
              (................................)
            </div>
          </div>
        </div>

      </div>

      {/* ================= PDF GUIDE MODAL (NO-PRINT) ================= */}
      {showPdfGuide && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 no-print">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-indigo-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <FileDown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">Panduan Ekspor PDF</h3>
                  <p className="text-[10px] text-emerald-100 font-medium">Tips untuk hasil dokumen resolusi tinggi</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPdfGuide(false)}
                className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-950 leading-relaxed font-semibold">
                  Sistem menggunakan mesin render native browser untuk hasil ekspor PDF vektor beresolusi tinggi, tajam, dan siap cetak. Ikuti langkah sederhana berikut di jendela print setelah ini:
                </p>
              </div>

              <div className="space-y-3.5 text-left">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-xs flex items-center justify-center shrink-0">1</div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800">Pilih Tujuan (Destination)</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Pada kolom tujuan pencetakan, klik dropdown dan ubah pilihan menjadi <strong>"Simpan sebagai PDF"</strong> atau <strong>"Save as PDF"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-xs flex items-center justify-center shrink-0">2</div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800">Centang Opsi Grafis Latar Belakang</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Buka menu <strong>"Setelan Lainnya" / "More Settings"</strong>, gulir ke bawah lalu pastikan Anda memberi centang pada pilihan <strong>"Background graphics" / "Grafis latar belakang"</strong> agar desain tabel, warna badge, dan latar belakang logo tercetak secara penuh.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold font-mono text-xs flex items-center justify-center shrink-0">3</div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800">Ukuran Kertas & Margin</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Gunakan ukuran kertas <strong>A4</strong> dengan orientasi <strong>Portrait (Tegak)</strong>, dan biarkan setelan margin pada pilihan <strong>Default</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
              <button
                onClick={() => setShowPdfGuide(false)}
                className="flex-1 py-2.5 border border-slate-205 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowPdfGuide(false);
                  setTimeout(() => {
                    window.print();
                  }, 250);
                }}
                className="flex-[1.5] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-100 cursor-pointer text-center"
              >
                <Printer className="w-4 h-4" />
                <span>Buka &amp; Simpan PDF</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
