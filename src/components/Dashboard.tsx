/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, FormEvent } from "react";
import { User, Transaction, INCOME_CATEGORIES, EXPENSE_CATEGORIES, CompanyProfile } from "../types";
import { parseTransactionText } from "../utils/parser";
import ReportView from "./ReportView";
import TransactionsList from "./TransactionsList";
import { 
  LogOut, Sparkles, Plus, Wallet, CreditCard, ChevronRight,
  TrendingUp, TrendingDown, DollarSign, Calendar, ListTodo, AlertTriangle, Check, BookOpen, PiggyBank,
  LayoutDashboard, History, BarChart3, Target, Settings, Users, FolderTree, RefreshCw, Trash2, Edit2, ShieldAlert,
  Building, MapPin, Phone, Mail, FileText, Cpu, Monitor
} from "lucide-react";
import { motion } from "motion/react";
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, onSnapshot, writeBatch } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<"ringkasan" | "transaksi" | "laporan" | "anggaran" | "tabungan" | "pengaturan">("ringkasan");
  
  // Smart Quick Add state
  const [smartInput, setSmartInput] = useState("");
  const [smartFeedback, setSmartFeedback] = useState<any>(null);
  
  // Manual Input form state (Optional toggled modal)
  const [showManualForm, setShowManualForm] = useState(false);
  const [formType, setFormType] = useState<"pemasukan" | "pengeluaran">("pengeluaran");
  const [formMethod, setFormMethod] = useState<"tunai" | "transfer">("tunai");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  
  // Edit state
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  // Budget Limits states
  const [budgetLimitCategory, setBudgetLimitCategory] = useState("Makanan & Minuman");
  const [budgetLimitAmount, setBudgetLimitAmount] = useState("");
  const [budgetLimits, setBudgetLimits] = useState<Record<string, number>>({
    "Makanan & Minuman": 1000000,
    "Belanja Harian": 2000000,
    "Transportasi": 500000
  });

  // Success Notification banner
  const [toastMessage, setToastMessage] = useState("");

  // Savings ("Nabung") states
  const [savingsAmount, setSavingsAmount] = useState("");
  const [savingsDescription, setSavingsDescription] = useState("Setor tunai ke rekening bank");
  const [savingsDate, setSavingsDate] = useState(new Date().toISOString().split("T")[0]);

  // Dynamic Categories states
  const [incomeCategories, setIncomeCategories] = useState<string[]>(INCOME_CATEGORIES);
  const [expenseCategories, setExpenseCategories] = useState<string[]>(EXPENSE_CATEGORIES);

  // Settings sub-tab state
  const [settingsActiveTab, setSettingsActiveTab] = useState<"pengguna" | "kategori" | "reset" | "perusahaan">("pengguna");

  // Company Profile states
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyFormName, setCompanyFormName] = useState("");
  const [companyFormAppName, setCompanyFormAppName] = useState("");
  const [companyFormReportTitle, setCompanyFormReportTitle] = useState("");
  const [companyFormAddress, setCompanyFormAddress] = useState("");
  const [companyFormPhone, setCompanyFormPhone] = useState("");
  const [companyFormEmail, setCompanyFormEmail] = useState("");
  const [companyFormBusinessType, setCompanyFormBusinessType] = useState("");
  const [companyFormNpwp, setCompanyFormNpwp] = useState("");
  const [companyFormDescription, setCompanyFormDescription] = useState("");

  // User Management lists
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userFormMode, setUserFormMode] = useState<"tambah" | "edit">("tambah");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userFormName, setUserFormName] = useState("");
  const [userFormUsername, setUserFormUsername] = useState("");
  const [userFormEmail, setUserFormEmail] = useState("");
  const [userFormPassword, setUserFormPassword] = useState("");
  const [userFormError, setUserFormError] = useState("");

  // Category modification states
  const [incCatInput, setIncCatInput] = useState("");
  const [expCatInput, setExpCatInput] = useState("");
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editingCatType, setEditingCatType] = useState<"income" | "expense" | null>(null);
  const [editingCatNewName, setEditingCatNewName] = useState("");

  // Reset states
  const [resetPin, setResetPin] = useState("");
  const [resetError, setResetError] = useState("");

  // Initial Balance States
  const [initialCashBalance, setInitialCashBalance] = useState<number>(0);
  const [initialTransferBalance, setInitialTransferBalance] = useState<number>(0);
  const [formInitialCash, setFormInitialCash] = useState<string>("0");
  const [formInitialTransfer, setFormInitialTransfer] = useState<string>("0");
  const [isSavingBalances, setIsSavingBalances] = useState(false);

  // Auto-fill initial balance form fields when database changes
  useEffect(() => {
    setFormInitialCash(String(initialCashBalance));
    setFormInitialTransfer(String(initialTransferBalance));
  }, [initialCashBalance, initialTransferBalance]);

  // Load user-specific data from Firestore in real-time
  useEffect(() => {
    if (!user?.id) return;

    // 1. Listen to user profile doc for budget limits, custom categories & initial balances
    const userDocRef = doc(db, "users", user.id);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.incomeCategories) setIncomeCategories(data.incomeCategories);
        if (data.expenseCategories) setExpenseCategories(data.expenseCategories);
        if (data.budgetLimits) setBudgetLimits(data.budgetLimits);

        const cashVal = Number(data.initialCashBalance) || 0;
        const transVal = Number(data.initialTransferBalance) || 0;
        setInitialCashBalance(cashVal);
        setInitialTransferBalance(transVal);
      } else {
        // Automatically initialize user doc with fallback settings if it doesn't exist
        const defaultDoc = {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          password: "",
          incomeCategories: INCOME_CATEGORIES,
          expenseCategories: EXPENSE_CATEGORIES,
          budgetLimits: budgetLimits,
          initialCashBalance: 0,
          initialTransferBalance: 0
        };
        setDoc(userDocRef, defaultDoc).catch(err => {
          console.error("Gagal melakukan inisialisasi dokumen pengguna:", err);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.id}`);
    });

    // 2. Listen to all transactions list
    const qTx = query(collection(db, "transactions"));
    const unsubTx = onSnapshot(qTx, (querySnapshot) => {
      const txs: Transaction[] = [];
      querySnapshot.forEach((docSnap) => {
        txs.push(docSnap.data() as Transaction);
      });
      // Sort transactions by date and createdAt timestamp descending
      txs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
    });

    // 3. Listen to all users list for settings User Management
    const unsubUsersList = onSnapshot(collection(db, "users"), (querySnapshot) => {
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push(docSnap.data());
      });
      setUsersList(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    // 4. Listen to Company Profile in real-time
    const companyDocRef = doc(db, "company", "profile");
    const unsubCompany = onSnapshot(companyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CompanyProfile;
        setCompanyProfile(data);
      } else {
        const defaultCompany: CompanyProfile = {
          id: "profile",
          name: "Apotek Assyifa Farma Cideres",
          address: "Jl Raya Cideres Ds Cipaku Kec Kadipaten - Majalengka",
          phone: "+62 22 4567 890",
          email: "support@dn-manajemen.co.id",
          businessType: "Apotek",
          npwp: "31.456.789.2-401.000",
          description: "Perusahaan finansial terpadu yang membantu bisnis Anda mencatat kas, setoran, serta mengawasi likuiditas perusahaan.",
          updatedAt: new Date().toISOString()
        };
        setDoc(companyDocRef, defaultCompany).catch(err => {
          console.error("Gagal inisialisasi profil perusahaan:", err);
        });
      }
    }, (error) => {
      console.warn("Profil perusahaan belum dimuat:", error);
    });

    return () => {
      unsubUser();
      unsubTx();
      unsubUsersList();
      unsubCompany();
    };
  }, [user.id]);

  // Toast trigger
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3000);
  };

  // Real-time Indonesian natural language parsing feedback
  useEffect(() => {
    if (!smartInput.trim()) {
      setSmartFeedback(null);
      return;
    }
    const result = parseTransactionText(smartInput);
    if (result.amount > 0) {
      setSmartFeedback(result);
    } else {
      setSmartFeedback(null);
    }
  }, [smartInput]);

  // Calculations for financial cockpit
  const metrics = useMemo(() => {
    let totalPemasukan = 0;
    let totalPengeluaran = 0;
    let cashBalance = initialCashBalance;
    let transferBalance = initialTransferBalance;
    let pemasukanTunai = 0;
    let pemasukanTransfer = 0;
    let pengeluaranTunai = 0;
    let pengeluaranTransfer = 0;

    transactions.forEach((tx) => {
      const amt = tx.amount;
      if (tx.type === "pemasukan") {
        totalPemasukan += amt;
        if (tx.method === "tunai") {
          cashBalance += amt;
          pemasukanTunai += amt;
        } else {
          transferBalance += amt;
          pemasukanTransfer += amt;
        }
      } else if (tx.type === "pengeluaran") {
        totalPengeluaran += amt;
        if (tx.method === "tunai") {
          cashBalance -= amt;
          pengeluaranTunai += amt;
        } else {
          transferBalance -= amt;
          pengeluaranTransfer += amt;
        }
      } else if (tx.type === "nabung") {
        cashBalance -= amt;
        transferBalance += amt;
      }
    });

    return {
      totalPemasukan,
      totalPengeluaran,
      saldoTotal: cashBalance + transferBalance,
      cashBalance,
      transferBalance,
      pemasukanTunai,
      pemasukanTransfer,
      pengeluaranTunai,
      pengeluaranTransfer
    };
  }, [transactions, initialCashBalance, initialTransferBalance]);

  // Trigger adding Smart / automatic transaction
  const handleSmartSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!smartFeedback) return;

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: smartFeedback.type,
      method: smartFeedback.method,
      amount: smartFeedback.amount,
      category: smartFeedback.category,
      description: smartFeedback.description,
      date: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "transactions", newTx.id), newTx);
      const labelType = newTx.type === "pemasukan" ? "Pemasukan" : "Pengeluaran";
      triggerToast(`Berhasil mencatatkan ${labelType} otomatis: Rp ${newTx.amount.toLocaleString("id-ID")}`);
      setSmartInput("");
      setSmartFeedback(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `transactions/${newTx.id}`);
    }
  };

  // Manual Transaction submission (Add or Edit)
  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formAmount.replace(/[^0-9]/g, ""));
    
    if (!amountNum || amountNum <= 0) {
      alert("Masukkan jumlah dana yang valid");
      return;
    }
    if (!formCategory) {
      alert("Pilih kategori");
      return;
    }
    if (!formDescription.trim()) {
      alert("Masukkan penjelasan transaksi");
      return;
    }

    try {
      if (editingTransactionId) {
        // Editing in Firestore
        const existingTx = transactions.find(t => t.id === editingTransactionId);
        const updatedTx: Transaction = {
          id: editingTransactionId,
          userId: existingTx?.userId || user.id,
          type: formType,
          method: formMethod,
          amount: amountNum,
          category: formCategory,
          description: formDescription,
          date: formDate,
          createdAt: existingTx?.createdAt || new Date().toISOString()
        };
        await setDoc(doc(db, "transactions", editingTransactionId), updatedTx);
        triggerToast("Transaksi berhasil diperbarui");
        setEditingTransactionId(null);
      } else {
        // Adding new in Firestore
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          userId: user.id,
          type: formType,
          method: formMethod,
          amount: amountNum,
          category: formCategory,
          description: formDescription,
          date: formDate,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, "transactions", newTx.id), newTx);
        triggerToast("Transaksi manual berhasil ditambahkan");
      }

      // Reset Form
      setFormAmount("");
      setFormDescription("");
      setShowManualForm(false);
    } catch (error) {
      handleFirestoreError(error, editingTransactionId ? OperationType.UPDATE : OperationType.CREATE, `transactions/${editingTransactionId || "new"}`);
    }
  };

  // Delete transaction handler
  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, "transactions", id));
      triggerToast("Transaksi dihapus");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  // Edit transaction dialog trigger
  const handleEditTrigger = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setFormType(tx.type as any);
    setFormMethod(tx.method as any);
    setFormAmount(tx.amount.toString());
    setFormCategory(tx.category);
    setFormDescription(tx.description);
    setFormDate(tx.date);
    setShowManualForm(true);
  };

  // Save budget limit changes
  const handleSaveBudget = async (e: FormEvent) => {
    e.preventDefault();
    const limitAmt = parseFloat(budgetLimitAmount);
    if (isNaN(limitAmt) || limitAmt <= 0) {
      alert("Format budget tidak valid");
      return;
    }

    const updated = {
      ...budgetLimits,
      [budgetLimitCategory]: limitAmt
    };
    
    try {
      await setDoc(doc(db, "users", user.id), { budgetLimits: updated }, { merge: true });
      setBudgetLimits(updated);
      setBudgetLimitAmount("");
      triggerToast(`Budget ${budgetLimitCategory} berhasil diatur!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  // Submit Savings ("Nabung") transaction (Move Cash to Bank Account)
  const handleSaveTransfer = async (e: FormEvent) => {
    e.preventDefault();
    const cleanAmt = savingsAmount.replace(/[^0-9]/g, "");
    const amt = parseFloat(cleanAmt);

    if (isNaN(amt) || amt <= 0) {
      alert("Masukkan jumlah dana menabung yang valid");
      return;
    }

    if (amt > metrics.cashBalance) {
      alert(`Maaf, saldo tunai saku Anda tidak mencukupi (Tersedia: Rp ${metrics.cashBalance.toLocaleString("id-ID")})`);
      return;
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      type: "nabung",
      method: "transfer",
      amount: amt,
      category: "Tabungan",
      description: savingsDescription.trim() || "Setor tunai ke rekening bank",
      date: savingsDate || new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "transactions", newTx.id), newTx);
      triggerToast(`Berhasil menabung Rp ${amt.toLocaleString("id-ID")} ke rekening!`);
      setSavingsAmount("");
      setSavingsDescription("Setor tunai ke rekening bank");
      setSavingsDate(new Date().toISOString().split("T")[0]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `transactions/${newTx.id}`);
    }
  };

  // Compute total money saved so far
  const totalSaved = useMemo(() => {
    return transactions
      .filter(t => t.type === "nabung")
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // User Management Submit
  const handleUserFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUserFormError("");

    if (!userFormName.trim() || !userFormUsername.trim() || !userFormPassword.trim()) {
      setUserFormError("Kolom Nama Lengkap, Username, dan Kata Sandi wajib diisi!");
      return;
    }

    try {
      if (userFormMode === "tambah") {
        // Check duplicate username/email
        const exists = usersList.some(
          (u: any) => u.username.toLowerCase() === userFormUsername.toLowerCase().trim() || 
                      (userFormEmail.trim() !== "" && u.email && u.email.toLowerCase() === userFormEmail.toLowerCase().trim())
        );
        if (exists) {
          setUserFormError("Username atau email sudah digunakan oleh akun lain.");
          return;
        }

        const newUserId = `user-${Date.now()}`;
        const newUser = {
          id: newUserId,
          username: userFormUsername.trim(),
          name: userFormName.trim(),
          email: userFormEmail.trim(),
          password: userFormPassword,
          incomeCategories: INCOME_CATEGORIES,
          expenseCategories: EXPENSE_CATEGORIES,
          budgetLimits: {
            "Makanan & Minuman": 1000000,
            "Belanja Harian": 2000000,
            "Transportasi": 500000
          }
        };

        await setDoc(doc(db, "users", newUserId), newUser);
        triggerToast(`User "${userFormName}" berhasil ditambahkan!`);
        setShowUserModal(false);
        
        setUserFormName("");
        setUserFormUsername("");
        setUserFormEmail("");
        setUserFormPassword("");
      } else {
        // Editing
        const exists = usersList.some(
          (u: any) => u.id !== selectedUserId && 
                      (u.username.toLowerCase() === userFormUsername.toLowerCase().trim() || 
                      (userFormEmail.trim() !== "" && u.email && u.email.toLowerCase() === userFormEmail.toLowerCase().trim()))
        );
        if (exists) {
          setUserFormError("Username atau email sudah digunakan oleh akun lain.");
          return;
        }

        const updated = {
          username: userFormUsername.trim(),
          name: userFormName.trim(),
          email: userFormEmail.trim(),
          password: userFormPassword
        };

        await updateDoc(doc(db, "users", selectedUserId!), updated);

        // If the currently logged-in user is updated, sink their session!
        if (selectedUserId === user.id) {
          const updatedCurrentUser = {
            id: user.id,
            username: userFormUsername.trim(),
            name: userFormName.trim(),
            email: userFormEmail.trim()
          };
          localStorage.setItem("currentUser", JSON.stringify(updatedCurrentUser));
          triggerToast("Akun Anda berhasil diperbarui! Memuat ulang...");
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          triggerToast(`User "${userFormName}" berhasil diperbarui!`);
        }
        setShowUserModal(false);
        
        setUserFormName("");
        setUserFormUsername("");
        setUserFormEmail("");
        setUserFormPassword("");
      }
    } catch (err: any) {
      console.error("Gagal melakukan aksi user managemen:", err);
      setUserFormError("Terjadi kesalahan database: " + err.message);
    }
  };

  const handleEditUserTrigger = (u: any) => {
    setSelectedUserId(u.id);
    setUserFormName(u.name);
    setUserFormUsername(u.username);
    setUserFormEmail(u.email);
    setUserFormPassword(u.password || "");
    setUserFormMode("edit");
    setUserFormError("");
    setShowUserModal(true);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus user "${userName}"? Semua data transaksi user ini juga akan dihapus.`)) {
      try {
        // Delete transactions belonging to them
        const q = query(collection(db, "transactions"), where("userId", "==", userId));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
          batch.delete(doc(db, "transactions", docSnap.id));
        });
        await batch.commit();

        // Delete user's profile
        await deleteDoc(doc(db, "users", userId));

        triggerToast(`User "${userName}" dan data transaksinya telah dihapus.`);

        // If they deleted themselves, logout!
        if (userId === user.id) {
          triggerToast("Anda menghapus akun sendiri. Keluar otomatis...");
          setTimeout(() => {
            onLogout();
          }, 1000);
        }
      } catch (err: any) {
        console.error("Gagal menghapus user:", err);
        alert("Gagal menghapus kueri/user: " + err.message);
      }
    }
  };

  // Category modification utilities
  const saveIncomeCategoriesList = async (newList: string[]) => {
    setIncomeCategories(newList);
    try {
      await updateDoc(doc(db, "users", user.id), { incomeCategories: newList });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const saveExpenseCategoriesList = async (newList: string[]) => {
    setExpenseCategories(newList);
    try {
      await updateDoc(doc(db, "users", user.id), { expenseCategories: newList });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const handleAddIncomeCategory = async (e: FormEvent) => {
    e.preventDefault();
    const cat = incCatInput.trim();
    if (!cat) return;
    if (incomeCategories.some(c => c.toLowerCase() === cat.toLowerCase())) {
      alert("Kategori pendapatan ini sudah ada!");
      return;
    }
    const updated = [...incomeCategories, cat];
    await saveIncomeCategoriesList(updated);
    setIncCatInput("");
    triggerToast(`Kategori "${cat}" berhasil ditambahkan!`);
  };

  const handleAddExpenseCategory = async (e: FormEvent) => {
    e.preventDefault();
    const cat = expCatInput.trim();
    if (!cat) return;
    if (expenseCategories.some(c => c.toLowerCase() === cat.toLowerCase())) {
      alert("Kategori pengeluaran ini sudah ada!");
      return;
    }
    const updated = [...expenseCategories, cat];
    await saveExpenseCategoriesList(updated);
    setExpCatInput("");
    triggerToast(`Kategori "${cat}" berhasil ditambahkan!`);
  };

  const handleRenameCategory = async (e: FormEvent) => {
    e.preventDefault();
    const newName = editingCatNewName.trim();
    if (!newName || !editingCatName || !editingCatType) return;

    try {
      if (editingCatType === "income") {
        if (incomeCategories.some(c => c !== editingCatName && c.toLowerCase() === newName.toLowerCase())) {
          alert("Nama kategori ini sudah terpakai!");
          return;
        }
        const updated = incomeCategories.map(c => c === editingCatName ? newName : c);
        await saveIncomeCategoriesList(updated);

        // Migrate all transactions matching previous category name of this user in Firestore
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.id),
          where("type", "==", "pemasukan"),
          where("category", "==", editingCatName)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
          batch.update(doc(db, "transactions", docSnap.id), { category: newName });
        });
        await batch.commit();

        triggerToast(`Kategori berhasil diubah menjadi "${newName}"`);
      } else {
        if (expenseCategories.some(c => c !== editingCatName && c.toLowerCase() === newName.toLowerCase())) {
          alert("Nama kategori ini sudah terpakai!");
          return;
        }
        const updated = expenseCategories.map(c => c === editingCatName ? newName : c);
        await saveExpenseCategoriesList(updated);

        // Migrate all transactions
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.id),
          where("type", "==", "pengeluaran"),
          where("category", "==", editingCatName)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
          batch.update(doc(db, "transactions", docSnap.id), { category: newName });
        });
        await batch.commit();

        triggerToast(`Kategori berhasil diubah menjadi "${newName}"`);
      }

      setEditingCatName(null);
      setEditingCatType(null);
      setEditingCatNewName("");
    } catch (err: any) {
      console.error("Gagal mengganti nama kategori:", err);
      alert("Gagal merubah nama kategori: " + err.message);
    }
  };

  const handleDeleteCategory = async (catName: string, type: "income" | "expense") => {
    if (confirm(`Apakah Anda yakin ingin menghapus kategori "${catName}"? Semua transaksi ber-kategori ini akan diletakkan ke "Lain-lain"`)) {
      try {
        if (type === "income") {
          const updated = incomeCategories.filter(c => c !== catName);
          await saveIncomeCategoriesList(updated);

          const q = query(
            collection(db, "transactions"),
            where("userId", "==", user.id),
            where("type", "==", "pemasukan"),
            where("category", "==", catName)
          );
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach((docSnap) => {
            batch.update(doc(db, "transactions", docSnap.id), { category: "Lain-lain" });
          });
          await batch.commit();

          triggerToast(`Kategori pendapatan "${catName}" berhasil dihapus.`);
        } else {
          const updated = expenseCategories.filter(c => c !== catName);
          await saveExpenseCategoriesList(updated);

          const q = query(
            collection(db, "transactions"),
            where("userId", "==", user.id),
            where("type", "==", "pengeluaran"),
            where("category", "==", catName)
          );
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach((docSnap) => {
            batch.update(doc(db, "transactions", docSnap.id), { category: "Lain-lain" });
          });
          await batch.commit();

          triggerToast(`Kategori pengeluaran "${catName}" berhasil dihapus.`);
        }
      } catch (err: any) {
        console.error("Gagal menghapus kategori:", err);
        alert("Gagal menghapus kategori: " + err.message);
      }
    }
  };

  // Reset and defaults handler
  const handleResetData = async (e: FormEvent) => {
    e.preventDefault();
    setResetError("");

    if (resetPin !== "1234") {
      setResetError("PIN salah! Akses ditolak. Silakan gunakan PIN default 1234.");
      return;
    }

    if (confirm("PERINGATAN KRITIS: Tindakan ini tidak dapat dibatalkan. Apakah Anda benar-benar yakin ingin menghapus semua rekam transaksi, batas anggaran, dan preferensi kategori Anda?")) {
      try {
        // Delete all transactions of this user in Firestore
        const q = query(collection(db, "transactions"), where("userId", "==", user.id));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
          batch.delete(doc(db, "transactions", docSnap.id));
        });
        await batch.commit();

        // Overwrite user document with defaults
        const userDocRef = doc(db, "users", user.id);
        await updateDoc(userDocRef, {
          incomeCategories: INCOME_CATEGORIES,
          expenseCategories: EXPENSE_CATEGORIES,
          budgetLimits: {
            "Makanan & Minuman": 1000000,
            "Belanja Harian": 2000000,
            "Transportasi": 500000
          }
        });

        // Reset states in memory
        setIncomeCategories(INCOME_CATEGORIES);
        setExpenseCategories(EXPENSE_CATEGORIES);
        setBudgetLimits({
          "Makanan & Minuman": 1000000,
          "Belanja Harian": 2000000,
          "Transportasi": 500000
        });

        setResetPin("");
        triggerToast("Semua data transaksi dan konfigurasi Anda berhasil di-reset ke default pabrik!");
      } catch (err: any) {
        console.error("Gagal melakukan reset:", err);
        setResetError("Gagal mereset data: " + err.message);
      }
    }
  };

  // Company Profile action handlers
  const startEditingCompany = () => {
    if (companyProfile) {
      setCompanyFormName(companyProfile.name || "");
      setCompanyFormAppName(companyProfile.appName || "");
      setCompanyFormReportTitle(companyProfile.reportTitle || "");
      setCompanyFormAddress(companyProfile.address || "");
      setCompanyFormPhone(companyProfile.phone || "");
      setCompanyFormEmail(companyProfile.email || "");
      setCompanyFormBusinessType(companyProfile.businessType || "");
      setCompanyFormNpwp(companyProfile.npwp || "");
      setCompanyFormDescription(companyProfile.description || "");
    } else {
      setCompanyFormName("Apotek Assyifa Farma Cideres");
      setCompanyFormAppName("DN Manajemen Keuangan");
      setCompanyFormReportTitle("MANAJEMEN KEUANGAN APOTEK ASSYIFA FARMA CIDERES");
      setCompanyFormAddress("Jl Raya Cideres Ds Cipaku Kec Kadipaten - Majalengka");
      setCompanyFormPhone("");
      setCompanyFormEmail("");
      setCompanyFormBusinessType("Apotek");
      setCompanyFormNpwp("");
      setCompanyFormDescription("");
    }
    setIsEditingCompany(true);
  };

  const handleUpdateCompanyProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyFormName.trim()) {
      triggerToast("Nama perusahaan wajib diisi!");
      return;
    }

    try {
      const companyDocRef = doc(db, "company", "profile");
      const updatedProfile: CompanyProfile = {
        id: "profile",
        name: companyFormName || "",
        appName: companyFormAppName || "",
        reportTitle: companyFormReportTitle || "",
        address: companyFormAddress || "",
        phone: companyFormPhone || "",
        email: companyFormEmail || "",
        businessType: companyFormBusinessType || "",
        npwp: companyFormNpwp || "",
        description: companyFormDescription || "",
        updatedAt: new Date().toISOString()
      };
      await setDoc(companyDocRef, updatedProfile);
      setIsEditingCompany(false);
      triggerToast("Profil perusahaan berhasil diperbarui!");
    } catch (err: any) {
      console.error("Gagal memperbarui profil perusahaan:", err);
      triggerToast("Gagal memperbarui: " + err.message);
    }
  };

  const handleSaveInitialBalances = async (e: FormEvent) => {
    e.preventDefault();
    const cash = Number(formInitialCash) || 0;
    const trans = Number(formInitialTransfer) || 0;
    if (cash < 0 || trans < 0) {
      triggerToast("Saldo awal tidak boleh negatif!");
      return;
    }

    setIsSavingBalances(true);
    try {
      const userDocRef = doc(db, "users", user.id);
      await setDoc(userDocRef, {
        initialCashBalance: cash,
        initialTransferBalance: trans
      }, { merge: true });
      triggerToast("Saldo awal berhasil diperbarui!");
    } catch (error: any) {
      console.error("Gagal menyimpan saldo awal:", error);
      triggerToast("Gagal menyimpan saldo: " + error.message);
    } finally {
      setIsSavingBalances(false);
    }
  };

  // Compute spending over budget limits for the current month
  const budgetAlerts = useMemo(() => {
    const alerts: { category: string; spent: number; limit: number; pct: number }[] = [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Filter current month expenses
    const thisMonthExpenses = transactions.filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "pengeluaran" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    Object.keys(budgetLimits).forEach((cat) => {
      const limit = budgetLimits[cat];
      const spent = thisMonthExpenses
        .filter(t => t.category === cat)
        .reduce((sum, t) => sum + t.amount, 0);

      const pct = limit > 0 ? (spent / limit) * 100 : 0;
      if (pct >= 80) { // Notify at 80% or higher
        alerts.push({ category: cat, spent, limit, pct });
      }
    });

    return alerts;
  }, [transactions, budgetLimits]);

  // Navigation item configurations
  const NAV_ITEMS = [
    { id: "ringkasan", label: "Ringkasan", labelShort: "Home", icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: "transaksi", label: "Catatan Transaksi", labelShort: "Histori", icon: <History className="w-4 h-4 shrink-0" /> },
    { id: "laporan", label: "Analitik Laporan", labelShort: "Laporan", icon: <BarChart3 className="w-4 h-4 shrink-0" /> },
    { id: "anggaran", label: "Batas Anggaran", labelShort: "Anggaran", icon: <Target className="w-4 h-4 shrink-0" /> },
    { id: "tabungan", label: "Celengan Pintar", labelShort: "Tabungan", icon: <PiggyBank className="w-4 h-4 shrink-0" /> },
    { id: "pengaturan", label: "Pengaturan", labelShort: "Atur", icon: <Settings className="w-4 h-4 shrink-0" /> },
  ] as const;

  // Determine greeting based on Indonesian timezone hour
  const greetingText = (() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "Selamat Pagi";
    if (hour >= 11 && hour < 15) return "Selamat Siang";
    if (hour >= 15 && hour < 18) return "Selamat Sore";
    return "Selamat Malam";
  })();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-28 md:pb-12">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-24 md:bottom-6 right-6 z-50 bg-slate-900 text-white py-3 px-5 rounded-2xl shadow-xl flex items-center gap-2.5 animate-bounce max-w-sm border border-slate-800">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner App Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-150">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-slate-900 uppercase">
                {companyProfile?.appName ? (
                  companyProfile.appName.split(' ').map((word, idx, arr) => (
                    idx === arr.length - 1 ? <span key={idx} className="text-indigo-600">{word}</span> : <span key={idx}>{word} </span>
                  ))
                ) : (
                  <>DN <span className="text-indigo-600">Manajemen Keuangan</span></>
                )}
              </span>
              <span className="hidden leading-none sm:inline-block ml-4 px-3 py-1 bg-green-100/80 text-green-700 text-xs font-bold rounded-full border border-green-200/50">
                Sistem Otomatis Aktif
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-none">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-mono mt-1">@{user.username}</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-slate-50 hover:bg-red-50 text-slate-700 hover:text-red-700 rounded-lg text-xs font-bold transition-colors border border-slate-200 cursor-pointer shadow-xs"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation Sub-header (Shown on MD screens and above) */}
      <nav className="bg-white border-b border-slate-200/80 sticky top-16 z-30 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1.5 py-2.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setShowManualForm(false);
                }}
                className={`relative px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === item.id 
                    ? "text-indigo-700" 
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="desktop-active-indicator"
                    className="absolute inset-0 bg-indigo-50 border border-indigo-150 rounded-xl"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Container - Renders Active Tab panels dynamically */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* TAB 1: RINGKASAN PANEL */}
        {activeTab === "ringkasan" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-8"
          >
            {/* Header Greeting Gradient block */}
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-850 to-slate-900 text-white p-6 rounded-3xl shadow-md border border-indigo-950 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="absolute right-0 bottom-0 w-36 h-36 bg-indigo-500 opacity-20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute left-1/3 top-0 w-24 h-24 bg-purple-500 opacity-15 rounded-full blur-xl pointer-events-none" />
              
              <div className="space-y-1 relative z-10">
                <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-widest block">{greetingText},</span>
                <h2 className="text-xl md:text-2xl font-black tracking-tight">{user.name}</h2>
                <p className="text-xs text-indigo-100 font-medium max-w-lg">
                  Arus kas dompet Anda terpantau dengan baik. Gunakan ketikan otomatis di bawah untuk mencatat transaksi secepat kilat!
                </p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-md border border-white/10 px-4 py-3 rounded-2xl shrink-0 self-start md:self-auto relative z-10 flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-300 animate-pulse" />
                <div>
                  <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-300 block">Metode Cerdas AI</span>
                  <span className="text-xs font-bold text-white">Analisis Bahasa Pengguna</span>
                </div>
              </div>
            </div>

            {/* Status Dompet & Rekening Aktif */}
            <div className="space-y-3.5">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2 px-1">
                <Wallet className="w-4 h-4 text-indigo-600 animate-pulse" />
                <span>Posisi Dompet & Rekening (Saldo Berjalan)</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Card Total balance */}
                <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-white p-5 rounded-2xl relative overflow-hidden shadow-lg border border-slate-850 flex flex-col justify-between min-h-[140px] hover:shadow-xl transition-all duration-200">
                  <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-indigo-500 rounded-full opacity-10 blur-xl" />
                  <div>
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Total Saldo Gabungan</span>
                    <h3 className="text-3xl font-black tracking-tight mt-1 text-emerald-400">
                      Rp {metrics.saldoTotal.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="mt-4 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2 font-semibold">
                    <span className="text-emerald-400 font-mono">In: Rp {(metrics.totalPemasukan / 1000).toFixed(0)}k</span>
                    <span className="text-red-400 font-mono">Out: Rp {(metrics.totalPengeluaran / 1000).toFixed(0)}k</span>
                  </div>
                </div>

                {/* Card Uang Tunai */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-200 min-h-[140px] relative overflow-hidden">
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-50 rounded-full opacity-40 blur-lg" />
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Nominal Uang Tunai (Fisik)</span>
                    <h3 className="text-2xl font-black text-emerald-700 tracking-tight mt-1 font-mono">
                      Rp {metrics.cashBalance.toLocaleString("id-ID")}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">Sisa uang tunai fisik di dompet.</p>
                  </div>
                  <div className="mt-3 flex items-center text-emerald-600 text-xs font-semibold gap-1 z-10">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Lacak Saku Fisik</span>
                  </div>
                </div>

                {/* Card Uang di Rekening */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all duration-200 min-h-[140px] relative overflow-hidden">
                  <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-50 rounded-full opacity-40 blur-lg" />
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Nominal Uang di Rekening (Bank)</span>
                    <h3 className="text-2xl font-black text-indigo-700 tracking-tight mt-1 font-mono">
                      Rp {metrics.transferBalance.toLocaleString("id-ID")}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">Sisa saldo bank digital &amp; e-wallet.</p>
                  </div>
                  <div className="mt-3 flex items-center text-blue-600 text-xs font-semibold gap-1 z-10">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Lacak Bank &amp; E-Wallet</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rekap Arus Masuk Keluar */}
            <div className="space-y-3.5 pt-2">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2 px-1">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>Rincian Arus Aliran Dana Masuk vs Keluar Buku</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card Pendapatan Tunai */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pendapatan Tunai</p>
                    <h2 className="text-xl font-bold text-slate-900 mt-1.5 font-mono">
                      Rp {metrics.pemasukanTunai.toLocaleString("id-ID")}
                    </h2>
                  </div>
                  <div className="mt-3 flex items-center text-emerald-600 text-xs font-semibold gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Tunai Saku</span>
                  </div>
                </div>

                {/* Card Pendapatan Transfer */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pendapatan Transfer</p>
                    <h2 className="text-xl font-bold text-slate-900 mt-1.5 font-mono">
                      Rp {metrics.pemasukanTransfer.toLocaleString("id-ID")}
                    </h2>
                  </div>
                  <div className="mt-3 flex items-center text-indigo-600 text-xs font-semibold gap-1">
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Bank &amp; e-Wallet</span>
                  </div>
                </div>

                {/* Card Pengeluaran Tunai */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pengeluaran Tunai</p>
                    <h2 className="text-xl font-bold text-slate-900 mt-1.5 font-mono">
                      Rp {metrics.pengeluaranTunai.toLocaleString("id-ID")}
                    </h2>
                  </div>
                  <div className="mt-3 flex items-center text-red-600 text-xs font-semibold gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Belanja Fisik</span>
                  </div>
                </div>

                {/* Card Pengeluaran Transfer */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pengeluaran Transfer</p>
                    <h2 className="text-xl font-bold text-slate-900 mt-1.5 font-mono">
                      Rp {metrics.pengeluaranTransfer.toLocaleString("id-ID")}
                    </h2>
                  </div>
                  <div className="mt-3 flex items-center text-slate-500 text-xs font-semibold gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    <span>Autodebit &amp; QRIS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Budget limit alerts on Homepage */}
            {budgetAlerts.length > 0 && (
              <section className="bg-amber-50 border border-amber-100 p-4.5 rounded-2xl flex flex-col sm:flex-row gap-3.5 items-start">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="text-sm font-bold text-amber-800">Peringatan Kuota Anggaran Bulanan!</h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Sejumlah pos belanja Anda telah terpakai melampaui limit 80% kuota bulan ini:
                  </p>
                  <div className="flex flex-wrap gap-2.5 mt-2.5">
                    {budgetAlerts.map(alert => (
                      <span key={alert.category} className="bg-amber-100/90 text-amber-900 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-amber-200">
                        {alert.category} ({alert.pct.toFixed(0)}% terpakai)
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Prompt Parser Input card */}
            <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <span>Input Pencatatan Sistem Otomatis</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ketik peristiwa keuangan Anda dalam kalimat Bahasa Indonesia bebas, teknologi AI lokas kami mendeteksi nominal secara real-time!
                </p>
              </div>

              <form onSubmit={handleSmartSubmit} className="space-y-3">
                <div className="relative">
                  <input
                    type="text"
                    className="w-full pl-4 pr-24 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner font-medium"
                    placeholder="Contoh: 'beli bakso mami 25 ribu tunai' atau 'pendapatan bulanan bonus 5.5 jt transfer'"
                    value={smartInput}
                    onChange={(e) => setSmartInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!smartFeedback}
                    className="absolute right-2.5 top-2.5 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs cursor-pointer transition-all disabled:cursor-not-allowed"
                  >
                    Simpan
                  </button>
                </div>

                {smartFeedback && (
                  <div className="bg-emerald-50/60 border border-emerald-100/60 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deteksi Sistem:</span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                        smartFeedback.type === "pemasukan" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>
                        {smartFeedback.type === "pemasukan" ? "Pemasukan" : "Pengeluaran"}
                      </span>
                      <span className="bg-slate-100/90 text-slate-700 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-slate-200">
                        {smartFeedback.category}
                      </span>
                      <span className="bg-slate-100/90 text-slate-700 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-slate-200">
                        {smartFeedback.method === "tunai" ? "Tunai" : "Transfer"}
                      </span>
                      <span className="text-slate-800 text-xs font-bold font-mono">
                        Rp {smartFeedback.amount.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <span className="text-xs text-slate-600 italic truncate max-w-xs block font-medium">
                      &quot;{smartFeedback.description}&quot;
                    </span>
                  </div>
                )}
                
                <div className="bg-slate-50 p-3 rounded-2xl text-[11px] text-slate-500 space-y-1 border border-slate-100 flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold text-slate-600 block">Form Buku Cepat:</span>
                    Cukup tulis nominal uang (e.g. 100rb, 2.5 juta, 15000), cara bayar (e.g. tunai/transfer), dan belanja untuk apa. Sistem otomatis merapikannya.
                  </p>
                </div>
              </form>
            </section>

            {/* Side-by-side Overview Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Widget A: Tabungan Saya */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <PiggyBank className="w-4 h-4 text-indigo-600" />
                    <span>Dana Celengan Aktif</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Rekapitulasi sisa uang fisik yang aman dipindahtangankan ke digital.</p>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/40 text-center space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide block">Tabungan Mandiri Terkumpul</span>
                  <span className="text-xl font-black text-indigo-700 font-mono">Rp {totalSaved.toLocaleString("id-ID")}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                    <span>Kemajuan Tabungan</span>
                    <span>{metrics.saldoTotal > 0 ? ((totalSaved / metrics.saldoTotal) * 100).toFixed(0) : 0}% Ambalan</span>
                  </div>
                  <div className="w-full bg-slate-150 h-1.5 rounded-full overflow-hidden relative">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((totalSaved / Math.max(100000, metrics.saldoTotal)) * 100, 100)}%` }}
                    />
                  </div>
                  <button 
                    onClick={() => setActiveTab("tabungan")}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-indigo-700 font-bold rounded-lg text-[10px] cursor-pointer transition-colors block text-center uppercase"
                  >
                    Masuk ke Halaman Tabungan
                  </button>
                </div>
              </div>

              {/* Widget B: Anggaran Snapshot */}
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-600" />
                    <span>Batas Anggaran Snapshot</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Batas limit kuota pengeluaran untuk 3 kategori teratas Anda.</p>
                </div>

                <div className="space-y-3">
                  {Object.keys(budgetLimits).slice(0, 2).map((cat) => {
                    const limit = budgetLimits[cat];
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    const spent = transactions
                      .filter(t => t.type === "pengeluaran" && t.category === cat && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
                      .reduce((sum, t) => sum + t.amount, 0);
                    const pct = Math.min((spent / limit) * 100, 100);

                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between items-center text-[11px] font-semibold">
                          <span className="text-slate-600 truncate">{cat}</span>
                          <span className="text-slate-500 text-[10px] font-mono">
                            {pct.toFixed(0)}% terpakai
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setActiveTab("anggaran")}
                  className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer transition-colors block text-center uppercase mt-1"
                >
                  Kelola Kuota Anggaran
                </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* TAB 2: CATATAN TRANSAKSI PANEL (RIWAYAT) */}
        {activeTab === "transaksi" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Header Riwayat Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800">Riwayat & Pencatatan Transaksi</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Telusuri, lakukan pengeditan nilai, atau hapus entri secara penuh.</p>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setEditingTransactionId(null);
                  setFormAmount("");
                  setFormCategory("Makanan & Minuman");
                  setFormDescription("");
                  setShowManualForm(!showManualForm);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all ${
                  showManualForm 
                    ? "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-100" 
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>{showManualForm ? "Tutup Form Manual" : "Input Transaksi Manual"}</span>
              </button>
            </div>

            {/* Manual Form expanded blocks */}
            {showManualForm && (
              <motion.section 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm"
              >
                <form onSubmit={handleManualSubmit} className="space-y-4 pt-1">
                  <h3 className="text-sm font-bold text-slate-850">
                    {editingTransactionId ? "Koreksi / Ubah Detail Transaksi" : "Pencatatan Transaksi Baru (Formulir)"}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Type Choice */}
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wide">Tipe Transaksi</label>
                      <div className="flex gap-1.5 mt-1 border border-slate-200 p-1 bg-white rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setFormType("pengeluaran");
                            setFormCategory("Makanan & Minuman");
                          }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            formType === "pengeluaran" ? "bg-red-500 text-white" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Pengeluaran
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormType("pemasukan");
                            setFormCategory("Pendapatan");
                          }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            formType === "pemasukan" ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Pemasukan
                        </button>
                      </div>
                    </div>

                    {/* Method Choice */}
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wide">Metode Dana</label>
                      <div className="flex gap-1.5 mt-1 border border-slate-200 p-1 bg-white rounded-xl">
                        <button
                          type="button"
                          onClick={() => setFormMethod("tunai")}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            formMethod === "tunai" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Tunai
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormMethod("transfer")}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                            formMethod === "transfer" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          Transfer
                        </button>
                      </div>
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wide">Kategori</label>
                      <select
                        className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 cursor-pointer text-slate-800"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                      >
                        {formType === "pemasukan"
                          ? Array.from(new Set([...incomeCategories, ...(formCategory ? [formCategory] : [])])).map(c => <option key={c} value={c}>{c}</option>)
                          : Array.from(new Set([...expenseCategories, ...(formCategory ? [formCategory] : [])])).map(c => <option key={c} value={c}>{c}</option>)
                        }
                      </select>
                    </div>

                    {/* Date Selection */}
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wide">Tanggal Transaksi</label>
                      <input
                        type="date"
                        className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Amount */}
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wide">Jumlah Dana (Rupiah)</label>
                      <input
                        type="text"
                        className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-indigo-500"
                        placeholder="Contoh: 150000"
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-400 tracking-wide">Penjelasan Singkat</label>
                      <input
                        type="text"
                        className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
                        placeholder="Contoh: Beli bensin roda dua"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualForm(false);
                        setEditingTransactionId(null);
                      }}
                      className="px-4 py-2 hover:bg-slate-100 text-slate-500 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
                    >
                      {editingTransactionId ? "Simpan Perubahan" : "Masukkan Entri"}
                    </button>
                  </div>
                </form>
              </motion.section>
            )}

            {/* List Table wrapper of Transactions list */}
            <div className="bg-white p-1 rounded-3xl border border-slate-100 shadow-sm">
              <TransactionsList 
                transactions={transactions} 
                onDeleteTransaction={handleDeleteTransaction}
                onEditTransaction={handleEditTrigger}
              />
            </div>
          </motion.div>
        )}

        {/* TAB 3: LAPORAN & ANALITIK MODERN */}
        {activeTab === "laporan" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            <ReportView 
              transactions={transactions} 
              user={user} 
              companyProfile={companyProfile} 
              initialCashBalance={initialCashBalance}
              initialTransferBalance={initialTransferBalance}
            />
          </motion.div>
        )}

        {/* TAB 4: BATAS ANGGARAN (BUDGETING) */}
        {activeTab === "anggaran" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in"
          >
            {/* Limit Configuration Block */}
            <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Atur Batas Anggaran (Budget)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Batas porsi maksimal biaya bulanan</p>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                Batasi pengeluaran bulanan Anda demi melestarikan sisa kas. Ketika pengeluaran Anda pada satu kategori telah mencapai 80%, sistem akan memberikan notifikasi instan.
              </p>

              <form onSubmit={handleSaveBudget} className="space-y-4.5 pt-2">
                <div>
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Kategori Pengeluaran</label>
                  <select
                    className="w-full mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-indigo-500 cursor-pointer text-slate-800"
                    value={budgetLimitCategory}
                    onChange={(e) => setBudgetLimitCategory(e.target.value)}
                  >
                    {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Kuota Limit Bulanan (Rp)</label>
                  <input
                    type="number"
                    className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono focus:outline-indigo-500"
                    placeholder="Contoh: 1500000"
                    value={budgetLimitAmount}
                    onChange={(e) => setBudgetLimitAmount(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors text-center shadow-md shadow-slate-100 flex items-center justify-center gap-1.5"
                >
                  <Target className="w-4 h-4" />
                  <span>Tetapkan Kuota Limit</span>
                </button>
              </form>
            </div>

            {/* Quotas Current month Progress view list */}
            <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-emerald-600" />
                  <span>Daftar Pemakaian Kuota Anggaran Bulan Ini</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Beban dinamis belanja berjalan dihitung otomatis dari riwayat transaksi.</p>
              </div>

              <div className="space-y-4.5 pt-2">
                {Object.keys(budgetLimits).length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50 border border-dashed border-slate-150 rounded-2xl">
                    Belum ada batas anggaran yang ditetapkan. Buat satu di panel kiri.
                  </p>
                ) : (
                  Object.keys(budgetLimits).map((cat) => {
                    const limit = budgetLimits[cat];
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    const spent = transactions
                      .filter(t => t.type === "pengeluaran" && t.category === cat && new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear)
                      .reduce((sum, t) => sum + t.amount, 0);
                    const pct = Math.min((spent / limit) * 100, 100);

                    return (
                      <div key={cat} className="space-y-2 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700">{cat}</span>
                          <span className="font-mono text-[11px] text-slate-500 font-semibold">
                            Rp {spent.toLocaleString("id-ID")} / <span className="text-slate-800 font-bold">Rp {limit.toLocaleString("id-ID")}</span>
                          </span>
                        </div>
                        
                        <div className="w-full bg-slate-150 h-2.5 rounded-full overflow-hidden relative">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct >= 100 ? "bg-red-500 shadow-xs shadow-red-100" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[9px] text-slate-400 font-extrabold uppercase">
                          <span>PEMAKAIAN: {pct.toFixed(1)}%</span>
                          <span className={pct >= 100 ? "text-red-500" : pct >= 80 ? "text-amber-500" : "text-emerald-500"}>
                            {pct >= 100 ? "OVER-BUDGET!" : pct >= 80 ? "MENDEKATI LIMIT!" : "AMAN"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: CELENGAN MODEREN (TABUNGAN PINTAR) */}
        {activeTab === "tabungan" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in"
          >
            {/* Visual illustrations and counters column */}
            <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black animate-bounce shadow-2xs">
                    <PiggyBank className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">Menabung Pintar</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Mutasi kas Tunai Saku ke Digital</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Pindahkan dana yang tersisa di dompet fisik Anda secara cerdas! Tabungan ini mensimulasikan penyetoran sisa uang kas tunai ke dalam saldo bank digital, memperkuat likuiditas non-tunai Anda.
                </p>
              </div>

              <div className="bg-indigo-900/95 text-white p-5 rounded-2xl text-center space-y-1 shadow-md shadow-indigo-100 border border-indigo-950">
                <span className="text-[9px] uppercase font-bold text-indigo-300 tracking-widest block font-sans">Total Celengan Saat Ini</span>
                <span className="text-2xl font-black text-white font-mono block">Rp {totalSaved.toLocaleString("id-ID")}</span>
                <span className="text-[10px] font-sans text-indigo-200 block font-medium opacity-80">Dari Kas Dompet Fisik</span>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="flex justify-between text-[11px] font-medium text-slate-500 uppercase">
                  <span className="font-bold">Alokasi Kas Saku</span>
                  <span className="font-mono font-bold text-indigo-600">{metrics.saldoTotal > 0 ? ((totalSaved / metrics.saldoTotal) * 100).toFixed(1) : 0}% porsi</span>
                </div>
                
                {/* Visual meter tracking */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
                  <div 
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((totalSaved / Math.max(100000, metrics.saldoTotal)) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 font-extrabold uppercase mt-1">
                  <span>TABUNGAN MANDIRI</span>
                  <span>PRESTASI</span>
                </div>
              </div>
            </div>

            {/* Deposit submission card */}
            <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Setor Sisa Kas Fisik demi Keamanan</h3>
                <p className="text-[10px] text-slate-400 font-medium">Berdasarkan data keuangan Anda, saldo tunai saku tersedia melimpah.</p>
              </div>

              {/* Quick denomination buttons */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Pilih Jumlah Nominal Cepat (Rupiah)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[20000, 50000, 100000, 200000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSavingsAmount(val.toString())}
                      className="py-2.5 px-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-205 hover:border-indigo-200 rounded-xl text-xs font-black text-slate-700 transition-colors cursor-pointer text-center"
                    >
                      Rp {val >= 1000 ? `${val / 1000}rb` : val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Form */}
              <form onSubmit={handleSaveTransfer} className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Nominal Penyetoran (Rp)</label>
                  <input
                    type="number"
                    value={savingsAmount}
                    onChange={(e) => setSavingsAmount(e.target.value)}
                    placeholder="Contoh: 50000"
                    className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold font-mono focus:outline-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Tanggal Nabung</label>
                  <input
                    type="date"
                    value={savingsDate}
                    onChange={(e) => setSavingsDate(e.target.value)}
                    className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold focus:outline-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-extrabold text-slate-400 tracking-wider">Catatan Belanja / Tujuan Tabungan</label>
                  <input
                    type="text"
                    value={savingsDescription}
                    onChange={(e) => setSavingsDescription(e.target.value)}
                    placeholder="Contoh: Tabungan dana darurat kuliah"
                    className="w-full mt-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500"
                  />
                </div>

                {/* Balance validation banner */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-sans">
                  <span className="text-slate-500 font-bold">Uang Tunai Saku Tersedia:</span>
                  <span className={`font-mono font-black text-xs ${metrics.cashBalance <= 0 ? "text-red-500 font-extrabold" : "text-emerald-600"}`}>
                    Rp {metrics.cashBalance.toLocaleString("id-ID")}
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors text-center shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Ambil Kas & Tabungkan</span>
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* TAB 6: PENGATURAN SYSTEM (MANAJEMEN USER, KATEGORI, RESET) */}
        {activeTab === "pengaturan" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Header Pengaturan */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-2xs">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Pengaturan Sistem</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Kelola akun pengguna, profil perusahaan/institusi Anda, kustomisasi kategori anggaran & harian, serta reset data.</p>
                </div>
              </div>
            </div>

            {/* Sub-navigation tabs block */}
            <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-100 p-1 rounded-2xl max-w-2xl gap-1.5">
              <button
                onClick={() => setSettingsActiveTab("pengguna")}
                className={`py-2.5 px-3 text-center text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  settingsActiveTab === "pengguna" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Manajemen User</span>
              </button>
              <button
                onClick={() => setSettingsActiveTab("perusahaan")}
                className={`py-2.5 px-3 text-center text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  settingsActiveTab === "perusahaan" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Building className="w-3.5 h-3.5 shrink-0" />
                <span>Profil Perusahaan</span>
              </button>
              <button
                onClick={() => setSettingsActiveTab("kategori")}
                className={`py-2.5 px-3 text-center text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  settingsActiveTab === "kategori" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FolderTree className="w-3.5 h-3.5 shrink-0" />
                <span>Kategori</span>
              </button>
              <button
                onClick={() => setSettingsActiveTab("reset")}
                className={`py-2.5 px-3 text-center text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  settingsActiveTab === "reset" ? "bg-white text-red-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Reset Data</span>
              </button>
            </div>

            {/* Sub-tab 1: MANAJEMEN USER */}
            {settingsActiveTab === "pengguna" && (
              <div className="space-y-6">
                {/* Users List Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Daftar Akun Pengguna</h3>
                      <p className="text-[10px] text-slate-400">Total terdaftar: {usersList.length} user di browser ini.</p>
                    </div>
                    {!showUserModal && (
                      <button
                        onClick={() => {
                          setUserFormMode("tambah");
                          setSelectedUserId(null);
                          setUserFormName("");
                          setUserFormUsername("");
                          setUserFormEmail("");
                          setUserFormPassword("");
                          setUserFormError("");
                          setShowUserModal(true);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah User</span>
                      </button>
                    )}
                  </div>

                  {/* Add / Edit Form Overlay Card */}
                  {showUserModal && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200/60 shadow-inner space-y-4"
                    >
                      <h4 className="text-xs font-bold text-slate-700">
                        {userFormMode === "tambah" ? "Tambah Akun Pengguna Baru" : "Edit Detail Akun Pengguna"}
                      </h4>

                      {userFormError && (
                        <div className="text-xs bg-red-50 border border-red-200 text-red-600 p-2.5 rounded-lg flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{userFormError}</span>
                        </div>
                      )}

                      <form onSubmit={handleUserFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Nama Lengkap</label>
                          <input
                            type="text"
                            placeholder="Marni Sania"
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                            value={userFormName}
                            onChange={(e) => setUserFormName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Username (Login)</label>
                          <input
                            type="text"
                            placeholder="marni"
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                            value={userFormUsername}
                            onChange={(e) => setUserFormUsername(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Alamat Email (Opsional)</label>
                          <input
                            type="email"
                            placeholder="marni@domain.com"
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                            value={userFormEmail}
                            onChange={(e) => setUserFormEmail(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Kata Sandi (Password)</label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                            value={userFormPassword}
                            onChange={(e) => setUserFormPassword(e.target.value)}
                          />
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-200/50 mt-1">
                          <button
                            type="button"
                            onClick={() => setShowUserModal(false)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            {userFormMode === "tambah" ? "Simpan Akun" : "Perbarui Akun"}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {usersList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Belum ada user terdaftar.</p>
                    ) : (
                      usersList.map((u: any) => (
                        <div
                          key={u.id}
                          className={`p-4 rounded-2xl border ${
                            u.id === user.id 
                              ? "bg-indigo-50/50 border-indigo-200" 
                              : "bg-slate-50/50 border-slate-200/80"
                          } flex items-center justify-between gap-4`}
                        >
                          <div className="truncate space-y-1">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-extrabold text-xs text-slate-800 truncate">{u.name}</span>
                              {u.id === user.id && (
                                <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-black tracking-wide shrink-0">
                                  AKUN ANDA
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono truncate">@{u.username}{u.email ? ` • ${u.email}` : ''}</p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleEditUserTrigger(u)}
                              className="p-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Edit User"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-1.5 bg-white hover:bg-red-50 hover:text-red-600 text-slate-400 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Hapus User"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Initial Balances Card */}
                <div id="settings-initial-balances" className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>Input Saldo Awal Utama</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Atur jumlah modal/saldo dasar Anda sebelum ditambahkan transaksi masuk dan keluar.</p>
                  </div>

                  <form onSubmit={handleSaveInitialBalances} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cash Balance */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <Wallet className="w-3.5 h-3.5 text-slate-400" />
                          <span>Saldo Awal Tunai (Cash/Saku)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                          <input
                            type="number"
                            min="0"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                            placeholder="0"
                            value={formInitialCash}
                            onChange={(e) => setFormInitialCash(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Bank Balance */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>Saldo Awal Rekening (Transfer)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                          <input
                            type="number"
                            min="0"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                            placeholder="0"
                            value={formInitialTransfer}
                            onChange={(e) => setFormInitialTransfer(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2.5 border-t border-slate-100">
                      <button
                        type="submit"
                        disabled={isSavingBalances}
                        className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1 transition-colors shadow-sm"
                      >
                        {isSavingBalances ? "Menyimpan..." : "Simpan Saldo Awal"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Sub-tab: PROFIL PERUSAHAAN */}
            {settingsActiveTab === "perusahaan" && (
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                      <Building className="w-5 h-5 text-indigo-600 shrink-0" />
                      <span>Identitas & Profil Perusahaan</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Atur informasi formal lembaga Anda yang akan tercermin pada identitas sistem serta kop laporan keuangan.</p>
                  </div>
                  {!isEditingCompany && (
                    <button
                      onClick={startEditingCompany}
                      className="px-4 py-2 border border-slate-200 hover:border-indigo-200 hover:bg-slate-50 bg-white text-slate-700 font-extrabold text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <Edit2 className="w-4 h-4 text-indigo-600" />
                      <span>Ubah Profil</span>
                    </button>
                  )}
                </div>

                {!isEditingCompany ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 space-y-3">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Detail Utama Perusahaan</span>
                        
                        <div className="flex items-start gap-3">
                          <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Nama Perusahaan</span>
                            <span className="text-sm font-semibold text-slate-800">{companyProfile?.name || "Apotek Assyifa Farma Cideres"}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Monitor className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Judul Aplikasi</span>
                            <span className="text-xs font-semibold text-slate-800">{companyProfile?.appName || "DN Manajemen Keuangan"}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Judul Cetak Laporan</span>
                            <span className="text-xs font-medium text-slate-700">{companyProfile?.reportTitle || "MANAJEMEN KEUANGAN APOTEK ASSYIFA FARMA CIDERES"}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Cpu className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Jenis Sektor Usaha</span>
                            <span className="text-xs font-medium text-slate-700">{companyProfile?.businessType || "Apotek"}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Nomor Pokok Wajib Pajak (NPWP)</span>
                            <span className="text-xs font-mono text-slate-700">{companyProfile?.npwp || "31.456.789.2-401.000"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 space-y-3">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Kontak & Lokasi</span>

                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Saluran Kontak Telepon</span>
                            <span className="text-xs font-medium text-slate-700">{companyProfile?.phone || "+62 22 4567 890"}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Alamat Surel Resmi</span>
                            <span className="text-xs font-medium text-slate-700">{companyProfile?.email || "support@dn-manajemen.co.id"}</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Lokasi Alamat Kantor</span>
                            <span className="text-xs font-semibold text-slate-700 leading-relaxed">{companyProfile?.address || "Jl Raya Cideres Ds Cipaku Kec Kadipaten - Majalengka"}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80">
                      <div className="flex items-start gap-3">
                        <BookOpen className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Deskripsi & Aktivitas Usaha</span>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed italic">
                            "{companyProfile?.description || "Perusahaan finansial terpadu yang membantu bisnis Anda mencatat kas, setoran, serta mengawasi likuiditas perusahaan."}"
                          </p>
                        </div>
                      </div>
                    </div>

                    {companyProfile?.updatedAt && (
                      <div className="text-right">
                        <span className="text-[9px] font-medium text-slate-400 font-mono">Pembaruan Terakhir: {new Date(companyProfile.updatedAt).toLocaleString("id-ID")}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleUpdateCompanyProfile} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Building className="w-3.5 h-3.5" />
                          <span>Nama Perusahaan *</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={companyFormName}
                          onChange={(e) => setCompanyFormName(e.target.value)}
                          placeholder="Masukkan nama resmi perusahaan"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Monitor className="w-3.5 h-3.5" />
                          <span>Judul Aplikasi</span>
                        </label>
                        <input
                          type="text"
                          value={companyFormAppName}
                          onChange={(e) => setCompanyFormAppName(e.target.value)}
                          placeholder="Contoh: DN Manajemen Keuangan"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Judul Cetak Laporan</span>
                        </label>
                        <input
                          type="text"
                          value={companyFormReportTitle}
                          onChange={(e) => setCompanyFormReportTitle(e.target.value)}
                          placeholder="Contoh: MANAJEMEN KEUANGAN APOTEK ASSYIFA FARMA"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5" />
                          <span>Sektor/Jenis Usaha</span>
                        </label>
                        <input
                          type="text"
                          value={companyFormBusinessType}
                          onChange={(e) => setCompanyFormBusinessType(e.target.value)}
                          placeholder="Contoh: Perdagangan Ritel atau Jasa Konsultasi"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Nomor NPWP</span>
                        </label>
                        <input
                          type="text"
                          value={companyFormNpwp}
                          onChange={(e) => setCompanyFormNpwp(e.target.value)}
                          placeholder="xx.xxx.xxx.x-xxx.xxx"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          <span>Telepon Hubung</span>
                        </label>
                        <input
                          type="text"
                          value={companyFormPhone}
                          onChange={(e) => setCompanyFormPhone(e.target.value)}
                          placeholder="Contoh: 021-xxxxxxxx / 08xxxxxxxxxx"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          <span>Surel (Email) Resmi</span>
                        </label>
                        <input
                          type="email"
                          value={companyFormEmail}
                          onChange={(e) => setCompanyFormEmail(e.target.value)}
                          placeholder="kontak@perusahaan.com"
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Alamat Lengkap Kantor</span>
                        </label>
                        <textarea
                          rows={2}
                          value={companyFormAddress}
                          onChange={(e) => setCompanyFormAddress(e.target.value)}
                          placeholder="Jalan, Gedung, Kota, Provinsi, Kode Pos..."
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>

                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Deskripsi Singkat Aktivitas Bisnis</span>
                        </label>
                        <textarea
                          rows={3}
                          value={companyFormDescription}
                          onChange={(e) => setCompanyFormDescription(e.target.value)}
                          placeholder="Deskripsikan secara singkat bidang usaha Anda dan visi utama pembukuan..."
                          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingCompany(false)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl cursor-pointer transition-all"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md shadow-indigo-100 transition-all"
                      >
                        Simpan Profil
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Sub-tab 2: MANAJEMEN KATEGORI */}
            {settingsActiveTab === "kategori" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column A: INCOME CATEGORIES */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-850 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Kategori Pendapatan (Income)</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Tambah, edit nama, atau hapus kategori pemasukan Anda.</p>
                  </div>

                  {/* Add form inline */}
                  <form onSubmit={handleAddIncomeCategory} className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                      placeholder="e.g. Dana Hibah"
                      value={incCatInput}
                      onChange={(e) => setIncCatInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </form>

                  {/* Categories list */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {incomeCategories.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-150 text-xs font-semibold text-slate-700 gap-3"
                      >
                        {editingCatName === cat && editingCatType === "income" ? (
                          <form onSubmit={handleRenameCategory} className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              className="flex-1 px-2.5 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-semibold focus:outline-none text-slate-800"
                              value={editingCatNewName}
                              onChange={(e) => setEditingCatNewName(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatName(null)}
                              className="text-[10px] px-2 py-1 bg-slate-205 text-slate-650 rounded font-bold hover:bg-slate-300 cursor-pointer"
                            >
                              Batal
                            </button>
                          </form>
                        ) : (
                          <>
                            <span className="truncate">{cat}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingCatName(cat);
                                  setEditingCatType("income");
                                  setEditingCatNewName(cat);
                                }}
                                className="p-1 hover:text-indigo-600 transition-colors hover:bg-indigo-50/50 rounded-md cursor-pointer"
                                title="Edit Kategori"
                              >
                                <Edit2 className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat, "income")}
                                className="p-1 hover:text-red-605 transition-colors hover:bg-red-50/50 rounded-md cursor-pointer"
                                title="Hapus Kategori"
                              >
                                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-655" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column B: EXPENSE CATEGORIES */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-red-850 flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4 text-red-600 shrink-0" />
                      <span>Kategori Pengeluaran (Expense)</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Tambah, edit nama, atau hapus kategori pembiayaan bulanan.</p>
                  </div>

                  {/* Add form inline */}
                  <form onSubmit={handleAddExpenseCategory} className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-indigo-500 text-slate-800"
                      placeholder="e.g. Zakat & Sedekah"
                      value={expCatInput}
                      onChange={(e) => setExpCatInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </form>

                  {/* Categories list */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {expenseCategories.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-150 text-xs font-semibold text-slate-700 gap-3"
                      >
                        {editingCatName === cat && editingCatType === "expense" ? (
                          <form onSubmit={handleRenameCategory} className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              className="flex-1 px-2.5 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-semibold focus:outline-none text-slate-800"
                              value={editingCatNewName}
                              onChange={(e) => setEditingCatNewName(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="submit"
                              className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCatName(null)}
                              className="text-[10px] px-2 py-1 bg-slate-200 text-slate-600 rounded font-bold hover:bg-slate-300 cursor-pointer"
                            >
                              Batal
                            </button>
                          </form>
                        ) : (
                          <>
                            <span className="truncate">{cat}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingCatName(cat);
                                  setEditingCatType("expense");
                                  setEditingCatNewName(cat);
                                }}
                                className="p-1 hover:text-indigo-600 transition-colors hover:bg-indigo-50/50 rounded-md cursor-pointer"
                                title="Edit Kategori"
                              >
                                <Edit2 className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat, "expense")}
                                className="p-1 hover:text-red-600 transition-colors hover:bg-red-50/50 rounded-md cursor-pointer"
                                title="Hapus Kategori"
                              >
                                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-600" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* Sub-tab 3: RESET DATA */}
            {settingsActiveTab === "reset" && (
              <div className="bg-white p-6 rounded-3xl border border-rose-100 shadow-sm max-w-lg space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>Reset Seluruh Data Transaksi (Opsi Pabrik)</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Hapus semua riwayat transaksi untuk memulai pembukuan kas dari awal kembali.</p>
                </div>

                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-xs text-rose-850 space-y-2">
                  <span className="font-extrabold text-rose-900 block uppercase tracking-wider text-[10px]">Peringatan Keamanan</span>
                  <p>
                    Tindakan ini akan mengosongkan riwayat kas tunai, kas transfer, tabungan/celengan, batas kuota anggaran, serta preferensi kategori Anda di server browser lokal Anda. Tindakan ini **tidak dapat diurungkan**.
                  </p>
                </div>

                <form onSubmit={handleResetData} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Masukkan PIN Pengaturan Default (1234)</label>
                    <input
                      type="password"
                      placeholder="••••"
                      maxLength={4}
                      className="w-32 text-center p-2.5 bg-slate-50 border border-slate-205 rounded-xl text-xs font-black font-mono tracking-widest focus:outline-red-500 focus:bg-white text-slate-900"
                      value={resetPin}
                      onChange={(e) => setResetPin(e.target.value)}
                    />
                  </div>

                  {resetError && (
                    <p className="text-xs text-red-600 font-extrabold font-mono">{resetError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold uppercase rounded-2xl text-xs cursor-pointer tracking-wider shadow-md shadow-red-100 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Reset Data Sekarang</span>
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}

      </main>

      {/* Mobile Floating Thumb Navigation Dock (Hidden on MD screens and above) */}
      <nav id="mobile-navigation-dock" className="md:hidden fixed bottom-4 left-4 right-4 z-45 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-2.5 flex items-center justify-around">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setShowManualForm(false);
            }}
            className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer flex-1 min-w-0 ${
              activeTab === item.id ? "text-indigo-600 scale-[1.03]" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {activeTab === item.id && (
              <motion.div
                layoutId="mobile-active-indicator"
                className="absolute inset-0 bg-indigo-50 border border-indigo-100 rounded-xl"
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
              />
            )}
            <span className="relative z-10">
              {item.icon}
            </span>
            <span className="relative z-10 text-[8px] font-extrabold mt-1 block truncate">
              {item.labelShort}
            </span>
          </button>
        ))}
      </nav>

    </div>
  );
}
