/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from "react";
import { motion } from "motion/react";
import { User, CompanyProfile } from "../types";
import { Lock, User as UserIcon, LogIn, AlertCircle, Sparkles } from "lucide-react";
import { collection, doc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "company", "profile"), (docSnap) => {
      if (docSnap.exists()) setCompanyProfile(docSnap.data() as CompanyProfile);
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username dan password wajib diisi");
      return;
    }

    setLoading(true);

    try {
      const usersRef = collection(db, "users");

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

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <span>{loading ? "Memproses..." : "Masuk ke Aplikasi"}</span>
              <LogIn className="w-4 h-4" />
            </button>
          </form>
          </motion.div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Hak Cipta © {new Date().getFullYear()} {companyProfile?.appName || "DN Manajemen Keuangan"}. Berjalan aman pada peramban Anda.
        </p>
      </div>
    </div>
  );
}
