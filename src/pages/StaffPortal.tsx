import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, MonitorPlay, BarChart3, ArrowLeft, Settings, BellRing } from 'lucide-react';

export default function StaffPortal() {
  const [searchParams] = useSearchParams();
  const isKioskSetup = searchParams.get('mode') === 'kiosk';
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState('');

  const handleCronTrigger = async () => {
    setTriggering(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/cron/defaulter-tracking', { method: 'POST' });
      const data = await res.json();
      setMessage(`ส่งแจ้งเตือนขาดนัดสำเร็จ: ${data.notifications_sent} รายการ`);
    } catch (e) {
      setMessage('เกิดข้อผิดพลาดในการประมวลผล');
    }
    setTriggering(false);
    setTimeout(() => setMessage(''), 5000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans p-8 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-20 gap-8">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-teal-100">
              <Settings className="w-3 h-3" />
              จัดการระดับสูง
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              {isKioskSetup ? 'ตั้งค่าคีออส' : 'ศูนย์ควบคุมระบบ'}
            </h1>
            <p className="text-slate-400 font-bold text-sm mt-2 uppercase tracking-[0.2em]">
              {isKioskSetup ? 'จุดลงทะเบียนด้วยตนเองอัตโนมัติ' : 'ระบบบริหารข้อมูลโรงพยาบาลอัจฉริยะ'}
            </p>
          </div>
          <Link to="/" className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-600 rounded-2xl font-bold text-sm transition-all shadow-sm">
            <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก
          </Link>
        </header>

        {isKioskSetup ? (
          <div className="max-w-3xl mx-auto">
            <Link 
              to="/kiosk" 
              className="group flex flex-col items-center text-center p-16 bg-white border border-slate-100 rounded-[60px] shadow-2xl shadow-slate-200/50 hover:-translate-y-2 transition-all transition-duration-500"
            >
              <div className="w-24 h-24 bg-teal-50 rounded-[32px] flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-teal-600 transition-all duration-500">
                <MonitorPlay className="w-10 h-10 text-teal-600 group-hover:text-white" />
              </div>
              <h3 className="text-3xl font-black mb-4 text-slate-900 tracking-tight">จุดแนะนำลงทะเบียน (Walk-in)</h3>
              <p className="text-slate-400 font-bold text-lg mb-10 max-w-sm">ติดตั้งหน้านี้ถาวรสำหรับเครื่อง Kiosk บริเวณทางเข้าเพื่อรับคิวอัตโนมัติ</p>
              <div className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xl group-hover:bg-teal-600 transition-colors">
                เปิดโหมดคีออส
              </div>
            </Link>
            
            <div className="mt-20 text-center">
              <Link to="/staff-login" className="text-slate-300 hover:text-teal-600 font-black text-xs uppercase tracking-[0.3em] transition-all">
                เปลี่ยนไปหน้าจัดการระบบ
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <StaffCard
              to="/admin"
              icon={<Users className="w-10 h-10" />}
              title="จัดการคิวพยาบาล"
              desc="กระดานควบคุมหน้าห้องตรวจ"
              color="text-teal-600"
              bg="bg-teal-50/50"
            />
            <StaffCard
              to="/tv"
              icon={<MonitorPlay className="w-10 h-10" />}
              title="จอแสดงผลทีวี"
              desc="จอประกาศเลขคิวสาธารณะ"
              color="text-indigo-600"
              bg="bg-indigo-50/50"
            />
            <StaffCard
              to="/analytics"
              icon={<BarChart3 className="w-10 h-10" />}
              title="สถิติและรายงาน"
              desc="ข้อมูลเชิงลึกและการประเมินผล"
              color="text-rose-600"
              bg="bg-rose-50/50"
            />
            <StaffCard
              to="/admin?campaign=true"
              icon={<Users className="w-10 h-10" />}
              title="จัดการมหกรรมสุขภาพ"
              desc="กำหนดโหมดเปิดรอบ 500 คิว"
              color="text-teal-600"
              bg="bg-teal-50/50"
            />
            <button 
              onClick={handleCronTrigger}
              disabled={triggering}
              className="group text-left p-10 bg-white border border-slate-100 rounded-[40px] shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-2 transition-all transition-duration-500 relative"
            >
              <div className="w-20 h-20 bg-amber-50/50 text-amber-600 rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <BellRing className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">จำลองระบบ Cron</h3>
              <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">ส่งแจ้งเตือนขาดนัด</p>
              {message && (
                <div className="absolute top-6 right-6 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest animate-in fade-in zoom-in text-center p-2">
                  {message}
                </div>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StaffCard({ to, icon, title, desc, bg, color }: any) {
  return (
    <Link to={to} className={`group block p-10 bg-white border border-slate-100 rounded-[40px] shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500`}>
      <div className={`w-20 h-20 ${bg} ${color} rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{title}</h3>
      <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">{desc}</p>
    </Link>
  );
}
