import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';

export default function StaffLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get('mode');

  // Simple hardcoded credentials
  const ADMIN_USER = 'admin';
  const ADMIN_PASS = '1234';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      localStorage.setItem('staff_authenticated', 'true');
      const target = mode === 'kiosk' ? '/staff?mode=kiosk' : '/staff';
      navigate(target);
    } else {
      setError(true);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-teal-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 border border-teal-100">
            <Lock className="w-10 h-10 text-teal-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Staff Entrance</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(false); }}
                placeholder="USERNAME"
                className={`w-full bg-slate-50 border-2 ${error ? 'border-red-100' : 'border-slate-100'} rounded-3xl py-5 px-6 text-xl font-black text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-teal-500 transition-all text-center uppercase tracking-widest`}
                autoFocus
                required
              />
            </div>
            
            <div className="relative">
              <input 
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder="PASSWORD"
                className={`w-full bg-slate-50 border-2 ${error ? 'border-red-100' : 'border-slate-100'} rounded-3xl py-5 px-6 text-xl font-black text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-teal-500 transition-all text-center uppercase tracking-widest`}
                required
              />
            </div>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-center font-bold text-sm"
            >
              ข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง
            </motion.p>
          )}

          <button 
            type="submit"
            className="w-full bg-slate-900 hover:bg-teal-600 text-white rounded-3xl py-5 text-xl font-black shadow-xl shadow-slate-900/10 active:scale-95 transition-all mt-2"
          >
            เข้าสู่ระบบ
          </button>

          {/* MOCK LOGIN SECTION (For Dev/Demo) */}
          <div className="pt-6 pb-2 border-t border-slate-100 mt-6 space-y-3">
            <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">จำลองการเข้าสู่ระบบ (Demo)</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('staff_authenticated', 'true');
                  navigate('/staff');
                }}
                className="bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-600 border border-slate-200 hover:border-teal-200 py-3 rounded-2xl font-bold text-sm transition-all"
              >
                เข้าสู่ระบบ Staff
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('staff_authenticated', 'true');
                  navigate('/admin');
                }}
                className="bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-600 border border-slate-200 hover:border-teal-200 py-3 rounded-2xl font-bold text-sm transition-all"
              >
                ผู้ดูแลระบบ Admin
              </button>
            </div>
            <button
                type="button"
                onClick={() => {
                  localStorage.setItem('staff_authenticated', 'true');
                  navigate('/kiosk');
                }}
                className="w-full bg-slate-50 hover:bg-teal-50 text-slate-600 hover:text-teal-600 border border-slate-200 hover:border-teal-200 py-3 rounded-2xl font-bold text-sm transition-all"
              >
                เข้าสู่ระบบ Kiosk
              </button>
          </div>

          <button 
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-slate-300 font-black flex items-center justify-center gap-2 hover:text-teal-600 transition-all pt-4 text-xs uppercase tracking-[0.3em]"
          >
            <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก
          </button>
        </form>
      </div>
    </div>
  );
}
