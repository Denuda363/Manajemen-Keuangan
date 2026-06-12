/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TransactionType, PaymentMethod, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../types";

export interface ParsedTransaction {
  type: TransactionType;
  method: PaymentMethod;
  amount: number;
  category: string;
  description: string;
}

/**
 * Parses numeric values from input like "15rb", "15k", "1.5juta", "50.000", "50000"
 */
function parseIndonesianAmount(text: string): number {
  const clean = text.toLowerCase().replace(/rp/g, "").replace(/\s+/g, "");
  
  // Find numeric values, allowing commas or decimals like 1,5 or 1.5
  const match = clean.match(/^([\d.,]+)(k|rb|ribu|jt|juta|m|milyar)?$/);
  if (!match) return 0;
  
  const numStr = match[1].replace(/,/g, "."); // convert Indonesian comma separator to dot or remove thousand separators
  // Correct multiple thousand dots vs decimal dot
  let value = 0;
  const dotsCount = (numStr.match(/\./g) || []).length;
  if (dotsCount > 1) {
    // If multiple dots, e.g. "50.000.000" -> remove them
    value = parseFloat(numStr.replace(/\./g, ""));
  } else if (dotsCount === 1) {
    // Single dot can be a thousands separator (e.g. 50.000) or decimal (e.g. 1.5)
    // If there are exactly three digits after it, it is likely thousands
    const parts = numStr.split(".");
    if (parts[1].length === 3) {
      value = parseFloat(numStr.replace(/\./g, ""));
    } else {
      value = parseFloat(numStr);
    }
  } else {
    value = parseFloat(numStr);
  }

  const multiplier = match[2];
  if (multiplier) {
    if (multiplier === "k" || multiplier === "rb" || multiplier === "ribu") {
      value *= 1000;
    } else if (multiplier === "jt" || multiplier === "juta") {
      value *= 1000000;
    } else if (multiplier === "m" || multiplier === "milyar") {
      value *= 1000000000;
    }
  }
  
  return isNaN(value) ? 0 : value;
}

/**
 * Automatically parses natural language text into transaction parameters
 */
export function parseTransactionText(inputText: string): ParsedTransaction {
  const cleanText = inputText.trim();
  const lowerText = cleanText.toLowerCase();

  // 1. Determine Type (Pemasukan/Pengeluaran): Look for income keywords
  let type: TransactionType = "pengeluaran"; // default is expense
  const incomeKeywords = [
    "pemasukan", "pendapatan", "gaji", "dapat", "terima", "gajian",
    "masuk", "cuan", "untung", "hibah", "bonus", "thr", "dividen"
  ];
  if (incomeKeywords.some(keyword => lowerText.includes(keyword))) {
    type = "pemasukan";
  }

  // 2. Determine Method (Tunai/Transfer):
  let method: PaymentMethod = "tunai"; // default
  const trsfKeywords = [
    "transfer", "bank", "m-banking", "mbanking", "gopay", "ovo", "shopeepay",
    "dana", "linkaja", "qris", "debit", "kredit", "tf"
  ];
  const cashKeywords = ["tunai", "cash", "dompet", "saku", "pegang"];

  if (trsfKeywords.some(keyword => lowerText.includes(keyword))) {
    method = "transfer";
  } else if (cashKeywords.some(keyword => lowerText.includes(keyword))) {
    method = "tunai";
  }

  // 3. Extract Amount & Description words
  const words = lowerText.split(/\s+/);
  let amount = 0;
  let amountWord = "";
  
  // Try to find the numeric keyword
  for (const word of words) {
    const cleanWord = word.replace(/[,.]/g, "");
    const hasDigits = /\d/.test(cleanWord);
    if (hasDigits) {
      const parsed = parseIndonesianAmount(word);
      if (parsed > 0) {
        amount = parsed;
        amountWord = word;
        break;
      }
    }
  }

  // 4. Construct description (clean original text of parsed amount, keywords for method/type)
  let description = cleanText;
  if (amountWord) {
    const regex = new RegExp(amountWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
    description = description.replace(regex, "");
  }
  
  // Clean auxiliary keywords from description to make it short and beautiful
  const stopWords = [
    "tunai", "cash", "transfer", "tf", "pemasukan", "pengeluaran", "qris", "gopay", "dana"
  ];
  
  let descWords = description.split(/\s+/).filter(word => {
    return !stopWords.includes(word.toLowerCase());
  });
  
  description = descWords.join(" ").replace(/,/g, "").trim();
  // Capitalize first letter
  if (description) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  } else {
    description = type === "pemasukan" ? "Pemasukan Lainnya" : "Pengeluaran Lainnya";
  }

  // 5. Automatic category matching
  let category = "Lain-lain";
  if (type === "pemasukan") {
    category = "Lain-lain";
    if (/gaji|salary|gajian/i.test(lowerText)) {
      category = "Pendapatan";
    } else if (/saham|crypto|emas|dividen|invest/i.test(lowerText)) {
      category = "Investasi";
    } else if (/jual|laku|dagang|bisnis|omset|toko/i.test(lowerText)) {
      category = "Bisnis/Penjualan";
    } else if (/bonus|hadiah|thr|angpao/i.test(lowerText)) {
      category = "Hadiah/Bonus";
    }
  } else {
    // expense categories
    category = "Lain-lain";
    if (/makan|minum|warteg|kopi|bakso|pecel|sate|restoran|cafe|mie|snack|jajan|starbucks|burger|kfc|mcd/i.test(lowerText)) {
      category = "Makanan & Minuman";
    } else if (/shopee|tokopedia|beli|belanja|supermarket|indomaret|alfamart|mall|baju|celana|sepatu|sabun/i.test(lowerText)) {
      category = "Belanja Harian";
    } else if (/gojek|grab|bensin|pertamax|parkir|toll|tol|ojek|bus|taxi|car|motor|kereta|pesawat|travel/i.test(lowerText)) {
      category = "Transportasi";
    } else if (/listrik|pln|wifi|internet|indihome|kuota|pulsa|telkomsel|kos|kontrakan|pajak|asuransi|air|pdam/i.test(lowerText)) {
      category = "Tagihan & Listrik";
    } else if (/obat|dokter|sakit|rs|rumah sakit|apotek|klinik|bpjs|vitamin/i.test(lowerText)) {
      category = "Kesehatan";
    } else if (/buku|sekolah|spp|atkata|kursus|kuliah|fotokopi/i.test(lowerText)) {
      category = "Pendidikan";
    } else if (/nonton|bioskop|netflix|game|cinema|spotify|hiburan|rekreasi|cafe|karoke|liburan|hotel/i.test(lowerText)) {
      category = "Hiburan";
    }
  }

  return {
    type,
    method,
    amount,
    category,
    description
  };
}
