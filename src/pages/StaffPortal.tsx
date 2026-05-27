import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Users, MonitorPlay, BarChart3, ArrowLeft, Settings, BellRing, History, X, Search } from 'lucide-react';

export default function StaffPortal() {
  const [searchParams] = useSearchParams();
  const isKioskSetup = searchParams.get('mode') === 'kiosk';
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState('');
  
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [noShowData, setNoShowData] = useState<any>(null);
  const [noShowLoading, setNoShowLoading] = useState(false);
  const [noShowQuery, setNoShowQuery] = useState('');

  const fetchNoShows = async () => {
    setNoShowLoading(true);
    try {
      const res = await fetch('/api/admin/no-shows');
      const data = await res.json();
      if (data.success) {
        setNoShowData(data);
      }
    } catch (err) {
      console.error("Failed to fetch no-shows", err);
    }
    setNoShowLoading(false);
  };

  const handleCronTrigger = async () => {
    setTriggering(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/cron/defaulter-tracking', { method: 'POST' });
      const data = await res.json();
      setMessage(`ส่งแจ้งเตือนขาดนัดสำเร็จ: ${data.notifications_sent} รายการ`);
      // Auto-refresh the no-shows dataset
      fetchNoShows();
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">แจ้งเตือนการขาดนัด</h3>
              <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">ส่งแจ้งเตือนขาดนัด</p>
              {message && (
                <div className="absolute top-6 right-6 bg-slate-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest animate-in fade-in zoom-in text-center p-2">
                  {message}
                </div>
              )}
            </button>

            <button 
              onClick={() => {
                fetchNoShows();
                setShowNoShowModal(true);
              }}
              className="group text-left p-10 bg-white border border-slate-100 rounded-[40px] shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 relative"
            >
              <div className="w-20 h-20 bg-rose-50/50 text-rose-600 rounded-[24px] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <History className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">ประวัติและสถิติการขาดนัด</h3>
              <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">ดูรายละเอียดและประวัติ</p>
            </button>
          </div>
        )}

        {/* No-Shows History & Statistics Modal */}
        {showNoShowModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
              
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-1.5">
                    <History className="w-3 h-3" />
                    ข้อมูลประวัติ
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">ประวัติและสถิติการขาดนัด</h2>
                </div>
                <button 
                  onClick={() => setShowNoShowModal(false)}
                  className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 overflow-y-auto flex-1 space-y-8">
                {noShowLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-12 h-12 border-4 border-rose-500 border-t-rose-100 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">กำลังโหลดข้อมูล...</p>
                  </div>
                ) : !noShowData || noShowData.list.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <History className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">ยังไม่มีประวัติการขาดนัด</h3>
                    <p className="text-sm text-slate-400 font-medium">เมื่อส่งระบบแจ้งเตือนขาดนัด ข้อมูลผู้ป่วยที่ไม่ได้เข้ารักษาวันนี้จะปรากฏที่นี่</p>
                  </div>
                ) : (
                  <>
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">จำนวนรวมขาดนัด</span>
                        <span className="text-4xl font-black text-rose-600 mt-2">{noShowData.stats.total} <span className="text-sm font-medium text-slate-400">ราย</span></span>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">จองออนไลน์แล้วขาดนัด</span>
                        <span className="text-4xl font-black text-slate-800 mt-2">{noShowData.stats.online} <span className="text-sm font-medium text-slate-400">ราย</span></span>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">วอล์กอินแล้วขาดนัด</span>
                        <span className="text-4xl font-black text-slate-800 mt-2">{noShowData.stats.walkin} <span className="text-sm font-medium text-slate-400">ราย</span></span>
                      </div>
                    </div>

                    {/* Service Stats Progress Bars */}
                    {noShowData.stats.byService.length > 0 && (
                      <div className="bg-slate-50/50 p-6 border border-slate-100 rounded-3xl">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">สถิติแยกตามการบริการ</h3>
                        <div className="space-y-4">
                          {noShowData.stats.byService.map((srv: any) => {
                            const percentage = Math.round((srv.count / noShowData.stats.total) * 100);
                            return (
                              <div key={srv.id} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                                  <span>{srv.name}</span>
                                  <span>{srv.count} ราย ({percentage}%)</span>
                                </div>
                                <div className="w-full h-3 bg-slate-200/50 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${srv.color && srv.color.startsWith('bg-') ? srv.color : 'bg-blue-500'}`} 
                                    style={{ 
                                      width: `${percentage}%`
                                    }} 
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* List Table */}
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">รายชื่อผู้ขาดนัดทั้งหมด</h3>
                        <div className="relative w-full sm:w-80">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none animate-pulse">
                            <Search className="h-4 w-4 text-rose-500" />
                          </span>
                          <input
                            type="text"
                            value={noShowQuery}
                            onChange={(e) => setNoShowQuery(e.target.value)}
                            placeholder="ค้นหาชื่อ, เลขบัตรประชาชน หรือเลขคิว..."
                            className="block w-full pl-10 pr-4 py-2 border-2 border-slate-100 rounded-2xl bg-slate-50/50 focus:bg-white focus:border-rose-500 text-xs font-bold outline-none transition-all placeholder:text-slate-400/80 shadow-inner"
                          />
                        </div>
                      </div>

                      <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider">
                              <th className="py-4 px-6">เลขคิว</th>
                              <th className="py-4 px-6">ชื่อ-นามสกุล</th>
                              <th className="py-4 px-6">บริการ</th>
                              <th className="py-4 px-6">ช่องทางการนัด</th>
                              <th className="py-4 px-6">เบอร์ติดต่อ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(() => {
                              const filteredList = (noShowData.list || []).filter((q: any) => {
                                const query = noShowQuery.toLowerCase().trim();
                                if (!query) return true;
                                return (
                                  (q.full_name || '').toLowerCase().includes(query) ||
                                  (q.citizen_id || '').toLowerCase().includes(query) ||
                                  (q.queue_number || '').toLowerCase().includes(query) ||
                                  (q.phone || '').toLowerCase().includes(query)
                                );
                              });

                              if (filteredList.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={5} className="py-12 px-6 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                                      🔍 ไม่พบข้อมูลที่ต้องการค้นหา
                                    </td>
                                  </tr>
                                );
                              }

                              return filteredList.map((q: any) => (
                                <tr key={q.id} className="text-slate-700 font-medium text-xs hover:bg-slate-50/50 transition-colors">
                                  <td className="py-4 px-6 font-black text-rose-600 text-sm">{q.queue_number}</td>
                                  <td className="py-4 px-6">
                                    <div className="font-bold text-slate-900">{q.full_name}</div>
                                    {q.citizen_id && <div className="text-[10px] text-slate-400 tracking-wider">เลขบัตร: {q.citizen_id}</div>}
                                  </td>
                                  <td className="py-4 px-6">
                                    <span 
                                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm shadow-slate-100 ${q.color_code && q.color_code.startsWith('bg-') ? q.color_code : 'bg-slate-500'}`}
                                    >
                                      {q.service_name}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6">
                                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${q.booking_type === 'Online' ? 'text-blue-600 bg-blue-50 border border-blue-200' : 'text-amber-600 bg-amber-50 border border-amber-200'}`}>
                                      {q.booking_type}
                                    </span>
                                  </td>
                                  <td className="py-4 px-6 font-mono text-slate-500 font-bold">
                                    {q.phone || '-'}
                                  </td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

            </div>
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
