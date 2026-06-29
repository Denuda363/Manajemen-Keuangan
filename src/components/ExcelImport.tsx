import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, AlertTriangle, CheckCircle, FileText, XCircle, FileSpreadsheet, Save } from "lucide-react";
import { Transaction, TransactionType, PaymentMethod } from "../types";

interface ExcelImportProps {
  onImport: (transactions: Omit<Transaction, "id" | "userId" | "createdAt">[]) => void;
  incomeCategories: string[];
  expenseCategories: string[];
}

interface ParsedRow {
  index: number;
  data: any;
  isValid: boolean;
  errors: string[];
  parsedTransaction?: Omit<Transaction, "id" | "userId" | "createdAt">;
}

export default function ExcelImport({ onImport, incomeCategories, expenseCategories }: ExcelImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws_data = [
      ["Tanggal", "Tipe", "Metode", "Jumlah", "Kategori", "Deskripsi"],
      ["2023-12-01", "pemasukan", "tunai", 500000, incomeCategories[0] || "Pendapatan", "Penjualan tunai"],
      ["2023-12-02", "pengeluaran", "transfer", 150000, expenseCategories[0] || "Belanja Harian", "Beli stok"],
      ["2023-12-03", "nabung", "transfer", 50000, "Tabungan", "Nabung harian"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Transaksi");
    XLSX.writeFile(wb, "Template_Import_Transaksi.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    processExcelFile(selectedFile);
  };

  const processExcelFile = (file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const rows: ParsedRow[] = jsonData.map((row, index) => {
          const errors: string[] = [];
          
          // Helper to get value ignoring case/spaces in keys
          const getValue = (keys: string[]) => {
            const rowKeys = Object.keys(row);
            const foundKey = rowKeys.find(k => keys.includes(k.toLowerCase().trim()));
            return foundKey ? row[foundKey] : undefined;
          };

          const rawDate = getValue(["tanggal", "date", "waktu"]);
          const rawType = getValue(["tipe", "type", "jenis"]);
          const rawMethod = getValue(["metode", "method", "pembayaran"]);
          const rawAmount = getValue(["jumlah", "amount", "nominal"]);
          const rawCategory = getValue(["kategori", "category"]);
          const rawDescription = getValue(["deskripsi", "description", "keterangan"]);

          let date = "";
          let type: TransactionType | null = null;
          let method: PaymentMethod | null = null;
          let amount = 0;
          let category = rawCategory ? String(rawCategory).trim() : "Lain-lain";
          let description = rawDescription ? String(rawDescription).trim() : "";

          // Date validation
          if (!rawDate) {
            errors.push("Tanggal kosong");
          } else {
            // Handle excel serial dates
            if (typeof rawDate === 'number') {
              const excelEpoch = new Date(1899, 11, 30);
              const jsDate = new Date(excelEpoch.getTime() + rawDate * 86400000);
              date = jsDate.toISOString().split('T')[0];
            } else {
              const parsedDate = new Date(rawDate);
              if (isNaN(parsedDate.getTime())) {
                errors.push("Format tanggal tidak valid (gunakan YYYY-MM-DD)");
              } else {
                date = parsedDate.toISOString().split('T')[0];
              }
            }
          }

          // Type validation
          if (!rawType) {
            errors.push("Tipe kosong");
          } else {
            const t = String(rawType).toLowerCase().trim();
            if (["pemasukan", "pengeluaran", "nabung"].includes(t)) {
              type = t as TransactionType;
            } else {
              errors.push("Tipe harus pemasukan, pengeluaran, atau nabung");
            }
          }

          // Method validation
          if (!rawMethod) {
            errors.push("Metode kosong");
          } else {
            const m = String(rawMethod).toLowerCase().trim();
            if (["tunai", "transfer"].includes(m)) {
              method = m as PaymentMethod;
            } else {
              errors.push("Metode harus tunai atau transfer");
            }
          }

          // Amount validation
          if (rawAmount === undefined || rawAmount === null) {
            errors.push("Jumlah kosong");
          } else {
            amount = Number(rawAmount);
            if (isNaN(amount) || amount <= 0) {
              errors.push("Jumlah harus berupa angka lebih besar dari 0");
            }
          }

          // Description fallback
          if (!description) {
            description = `${type === "pemasukan" ? "Pemasukan" : type === "pengeluaran" ? "Pengeluaran" : "Nabung"} ${category}`;
          }

          const isValid = errors.length === 0;

          return {
            index: index + 2, // Excel rows start at 1, header is 1, data starts at 2
            data: row,
            isValid,
            errors,
            parsedTransaction: isValid ? {
              type: type!,
              method: method!,
              amount,
              category,
              description,
              date
            } : undefined
          };
        });

        setParsedRows(rows);
      } catch (error) {
        console.error("Error reading excel file:", error);
        alert("Gagal membaca file Excel. Pastikan format file sesuai.");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = () => {
    const validTransactions = parsedRows
      .filter(row => row.isValid && row.parsedTransaction)
      .map(row => row.parsedTransaction!);
    
    if (validTransactions.length > 0) {
      onImport(validTransactions);
      setFile(null);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      alert(`Berhasil mengimpor ${validTransactions.length} transaksi!`);
    }
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const errorCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
          <span>Import Transaksi via Excel</span>
        </h3>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Unggah file Excel (.xlsx) untuk menambahkan banyak transaksi sekaligus.</p>
      </div>

      {!file && (
        <div className="space-y-6">
          <div className="bg-emerald-50/50 border border-emerald-100/50 p-4 rounded-2xl space-y-4">
            <div>
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                Langkah 1: Unduh Template
              </h4>
              <p className="text-[10px] text-emerald-700/80 mt-1 mb-3">Unduh template Excel agar format kolom sesuai dengan yang dikenali sistem.</p>
              <button
                onClick={downloadTemplate}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Unduh Template Excel
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                Langkah 2: Unggah File Excel
              </h4>
              <p className="text-[10px] text-slate-500 mt-1 mb-3">Isi data transaksi pada template yang diunduh, lalu unggah kembali ke sini.</p>
              
              <label className="w-full flex cursor-pointer">
                <div className="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 text-center">
                  <Upload className="w-4 h-4" />
                  <span>{isProcessing ? "Memproses..." : "Pilih & Unggah File .xlsx"}</span>
                </div>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  disabled={isProcessing}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {file && parsedRows.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              <div>
                <p className="text-xs font-bold text-slate-700">{file.name}</p>
                <p className="text-[10px] text-slate-500">{parsedRows.length} baris data ditemukan</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setFile(null);
                setParsedRows([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              Batal
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
              <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs font-bold text-emerald-700">{validCount} Valid</p>
            </div>
            <div className="flex-1 bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <p className="text-xs font-bold text-red-700">{errorCount} Error</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-[10px] md:text-xs">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-600 w-10">Brs</th>
                  <th className="px-3 py-2 font-semibold text-slate-600">Tanggal</th>
                  <th className="px-3 py-2 font-semibold text-slate-600">Tipe / Metode</th>
                  <th className="px-3 py-2 font-semibold text-slate-600">Nominal / Deskripsi</th>
                  <th className="px-3 py-2 font-semibold text-slate-600 text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedRows.map((row, i) => (
                  <tr key={i} className={row.isValid ? "bg-white hover:bg-slate-50" : "bg-red-50/50"}>
                    <td className="px-3 py-2 text-slate-400 font-mono">{row.index}</td>
                    <td className="px-3 py-2 text-slate-700">{row.parsedTransaction?.date || String(row.data.Tanggal || row.data.tanggal || '-')}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-700 capitalize">{row.parsedTransaction?.type || row.data.Tipe || row.data.tipe || '-'}</div>
                      <div className="text-slate-500 capitalize">{row.parsedTransaction?.method || row.data.Metode || row.data.metode || '-'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-800 font-mono">
                        Rp {(row.parsedTransaction?.amount || Number(row.data.Jumlah || row.data.jumlah) || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="text-slate-500 truncate max-w-[150px]">{row.parsedTransaction?.description || row.data.Deskripsi || row.data.deskripsi || '-'}</div>
                    </td>
                    <td className="px-3 py-2">
                      {row.isValid ? (
                        <div className="flex justify-center"><CheckCircle className="w-4 h-4 text-emerald-500" /></div>
                      ) : (
                        <div className="group relative flex justify-center cursor-help">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-800 text-white text-[9px] p-2 rounded-lg shadow-xl z-20">
                            <ul className="list-disc pl-3">
                              {row.errors.map((e, idx) => <li key={idx}>{e}</li>)}
                            </ul>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2">
            <button
              onClick={handleImport}
              disabled={validCount === 0}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Simpan {validCount} Transaksi Valid
            </button>
            {errorCount > 0 && (
              <p className="text-center text-[10px] text-red-500 mt-2 font-medium">
                * {errorCount} baris memiliki error dan akan dilewati
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
