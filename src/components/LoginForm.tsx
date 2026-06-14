/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, CompanyProfile } from "../types";
import { Lock, Mail, User as UserIcon, LogIn, ChevronRight, AlertCircle, Sparkles } from "lucide-react";
import { collection, doc, setDoc, getDoc, getDocs, query, where, writeBatch, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "company", "profile"), (docSnap) => {
      if (docSnap.exists()) setCompanyProfile(docSnap.data() as CompanyProfile);
    });
    return () => unsub();
  }, []);

  const handleDemoLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const demoUser: User = {
        id: "demo-user",
        username: "demo",
        name: "Nurul Huda",
        email: "demo@keuangan.id"
      };

      // Ensure demo user exists in Firestore
      const userDocRef = doc(db, "users", "demo-user");
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const demoProfile = {
          ...demoUser,
          password: "demo"
        };
        await setDoc(userDocRef, demoProfile);
      }

      // Ensure initial transactions exist in Firestore
      const transactionsRef = collection(db, "transactions");
      const q = query(transactionsRef, where("userId", "==", "demo-user"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        const batch = writeBatch(db);
        const today = new Date().toISOString().split("T")[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        const lastWeek = new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0];
        const lastMonth = new Date(Date.now() - 86400000 * 20).toISOString().split("T")[0];

        const initialTransactions = [
          {
            id: "tx-demo-1",
            userId: "demo-user",
            type: "pemasukan",
            method: "transfer",
            amount: 7500000,
            category: "Pendapatan",
            description: "Pendapatan Bulanan Utama",
            date: lastMonth,
            createdAt: new Date(lastMonth).toISOString()
          },
          {
            id: "tx-demo-2",
            userId: "demo-user",
            type: "pengeluaran",
            method: "transfer",
            amount: 850000,
            category: "Tagihan & Listrik",
            description: "Bayar internet dan Listrik PLN",
            date: yesterday,
            createdAt: new Date(yesterday).toISOString()
          },
          {
            id: "tx-demo-3",
            userId: "demo-user",
            type: "pengeluaran",
            method: "tunai",
            amount: 45000,
            category: "Makanan & Minuman",
            description: "Makan siang bakso kota",
            date: today,
            createdAt: new Date(today).toISOString()
          },
          {
            id: "tx-demo-4",
            userId: "demo-user",
            type: "pemasukan",
            method: "tunai",
            amount: 250000,
            category: "Bisnis/Penjualan",
            description: "Hasil penjualan barang bekas",
            date: yesterday,
            createdAt: new Date(yesterday).toISOString()
          },
          {
            id: "tx-demo-5",
            userId: "demo-user",
            type: "pengeluaran",
            method: "transfer",
            amount: 320000,
            category: "Belanja Harian",
            description: "Belanja bulanan Indomaret",
            date: lastWeek,
            createdAt: new Date(lastWeek).toISOString()
          },
          {
            id: "tx-demo-6",
            userId: "demo-user",
            type: "pengeluaran",
            method: "tunai",
            amount: 120000,
            category: "Transportasi",
            description: "Isi bensin Pertamax motor",
            date: lastWeek,
            createdAt: new Date(lastWeek).toISOString()
          },
          {
            id: "tx-demo-7",
            userId: "demo-user",
            type: "pengeluaran",
            method: "transfer",
            amount: 150000,
            category: "Hiburan",
            description: "Langganan Netflix & Spotify",
            date: lastMonth,
            createdAt: new Date(lastMonth).toISOString()
          }
        ];

        initialTransactions.forEach((tx) => {
          const docRef = doc(db, "transactions", tx.id);
          batch.set(docRef, tx);
        });

        await batch.commit();
      }

      onLoginSuccess(demoUser);
    } catch (err: any) {
      console.error("Gagal inisialisasi Demo Firebase:", err);
      setError("Gagal menyambungkan akun demo ke server database Firebase: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username dan password wajib diisi");
      return;
    }

    if (!isLogin && !name) {
      setError("Nama lengkap wajib diisi untuk registrasi");
      return;
    }

    setLoading(true);

    try {
      const usersRef = collection(db, "users");

      if (isLogin) {
        // Handle Login via Firestore
        const q = query(usersRef, where("username", "==", username.trim()));
        const querySnapshot = await getDocs(q);
        let foundUser: any = null;

        querySnapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.password === password) {
            foundUser = d;
          }
        });

        if (foundUser) {
          onLoginSuccess({
            id: foundUser.id,
            username: foundUser.username,
            name: foundUser.name,
            email: foundUser.email
          });
        } else {
          setError("Username atau password salah");
          setLoading(false);
        }
      } else {
        // Handle Register via Firestore
        const qUsername = query(usersRef, where("username", "==", username.trim()));
        const usernameSnap = await getDocs(qUsername);
        if (!usernameSnap.empty) {
          setError("Username sudah terdaftar");
          setLoading(false);
          return;
        }

        if (email.trim() !== "") {
          const qEmail = query(usersRef, where("email", "==", email.trim()));
          const emailSnap = await getDocs(qEmail);
          if (!emailSnap.empty) {
            setError("Email sudah terdaftar");
            setLoading(false);
            return;
          }
        }

        const userId = `user-${Date.now()}`;
        const newUser = {
          id: userId,
          username: username.trim(),
          name: name.trim(),
          email: email.trim(),
          password: password
        };

        await setDoc(doc(db, "users", userId), newUser);

        onLoginSuccess({
          id: newUser.id,
          username: newUser.username,
          name: newUser.name,
          email: newUser.email
        });
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Firebase auth/db error:", err);
      setError("Gagal menghubungi server database: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-indigo-600 to-slate-900" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm text-indigo-600 mb-4"
        >
          <Sparkles className="w-8 h-8" />
        </motion.div>
        
        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
          {companyProfile?.appName ? (
            companyProfile.appName.split(' ').map((word, idx, arr) => (
              idx === arr.length - 1 ? <span key={idx} className="text-indigo-600">{word}</span> : <span key={idx}>{word} </span>
            ))
          ) : (
            <>DN <span className="text-indigo-600">Manajemen Keuangan</span></>
          )}
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
          {companyProfile?.appName || "DN Manajemen Keuangan"} – Solusi cerdas atur pemasukan & pengeluaran usaha dan pribadi Anda.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-slate-100 sm:px-10"
        >
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-start gap-2.5 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setError("");
              }}
              className={`flex-1 py-2 text-center text-sm font-medium rounded-lg transition-all duration-200 ${
                isLogin ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Masuk
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError("");
              }}
              className={`flex-1 py-2 text-center text-sm font-medium rounded-lg transition-all duration-200 ${
                !isLogin ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Daftar Baru
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {!isLogin && (
                <motion.div
                  key="fullName"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1"
                >
                  <label className="text-xs font-semibold text-slate-700">Nama Lengkap</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      placeholder="Masukkan nama lengkap"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}

              {!isLogin && (
                <motion.div
                  key="emailAddress"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1"
                >
                  <label className="text-xs font-semibold text-slate-700">Alamat Email (Opsional)</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                      placeholder="contoh@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  placeholder="Username Anda"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-6 py-2.5 px-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-100"
            >
              <span>{loading ? "Memproses..." : isLogin ? "Masuk ke Aplikasi" : "Daftar Akun Baru"}</span>
              <LogIn className="w-4 h-4" />
            </button>
          </form>

          <div className="relative mt-6 mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400">Atau coba instant</span>
            </div>
          </div>

          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full flex items-center justify-between py-2.5 px-4 bg-slate-50 text-slate-700 rounded-xl hover:bg-indigo-50/50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 active:scale-[0.98] transition-all cursor-pointer font-medium text-sm"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Gunakan Akun Demo</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </button>
          </motion.div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Hak Cipta © {new Date().getFullYear()} {companyProfile?.appName || "DN Manajemen Keuangan"}. Berjalan aman pada peramban Anda.
        </p>
      </div>
    </div>
  );
}
