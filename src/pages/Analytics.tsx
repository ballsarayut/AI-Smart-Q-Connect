import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Clock, MonitorPlay, HeartPulse, ArrowLeft, BrainCircuit, Calendar, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { io } from 'socket.io-client';

const socket = io();

// Date Handlers
const formatThaiDateTime = (isoString: string) => {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';
  } catch (e) {
    return isoString;
  }
};

// Date Handlers
const getThailandToday = () => {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + 7);
  return d.toISOString().split('T')[0];
}
const getStartOfWeek = () => {
  const today = getThailandToday();
  const d = new Date(today); // UTC midnight
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().split('T')[0];
}
const getStartOfMonth = () => {
  const today = getThailandToday();
  return `${today.substring(0, 8)}01`;
}
const getStartOfYear = () => {
  const today = getThailandToday();
  return `${today.substring(0, 5)}01-01`;
}

export default function Analytics() {
  const [stats, setStats] = useState<any>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  
  const [startDate, setStartDate] = useState(getThailandToday());
  const [endDate, setEndDate] = useState(getThailandToday());

  useEffect(() => {
    const fetchAnalytics = () => {
      fetch(`/api/analytics?start=${startDate}&end=${endDate}`)
        .then(res => res.json())
        .then(data => setStats(data));
    };
    
    fetchAnalytics();
    
    socket.on('queue_updated', fetchAnalytics);
    
    return () => {
      socket.off('queue_updated', fetchAnalytics);
    };
  }, [startDate, endDate]);

  const handleFetchInsights = async () => {
    setLoadingInsights(true);
    try {
      const response = await fetch('/api/analytics/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stats)
      });
      const data = await response.json();
      setInsights(data.insights);
    } catch (err) {
      console.error(err);
      setInsights("เกิดข้อผิดพลาดในการโหลด AI Insights");
    } finally {
      setLoadingInsights(false);
    }
  };

  if (!stats) return <div className="p-8 text-center text-slate-500">Loading Analytics...</div>;

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

  const walkinData = [
    { name: 'Walk-in', value: stats.dailyStats?.walkin || 0 },
    { name: 'Online (LINE)', value: stats.dailyStats?.online || 0 }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Link to="/staff" className="mt-1 w-10 h-10 bg-white border-2 border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">รายงานสรุปข้อมูล (สำหรับผู้อำนวยการ)</h1>
              <p className="text-sm text-slate-500 font-medium">สำหรับผู้อำนวยการ รพ.สต. และประเมินผลการให้บริการ</p>
            </div>
          </div>
          
          <div className="bg-white p-3 rounded-xl border-2 border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => {setStartDate(getThailandToday()); setEndDate(getThailandToday());}} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${startDate === getThailandToday() && endDate === getThailandToday() ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                วันนี้
              </button>
              <button onClick={() => {setStartDate(getStartOfWeek()); setEndDate(getThailandToday());}} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${startDate === getStartOfWeek() && endDate === getThailandToday() ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                สัปดาห์นี้
              </button>
              <button onClick={() => {setStartDate(getStartOfMonth()); setEndDate(getThailandToday());}} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${startDate === getStartOfMonth() && endDate === getThailandToday() ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                เดือนนี้
              </button>
              <button onClick={() => {setStartDate(getStartOfYear()); setEndDate(getThailandToday());}} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${startDate === getStartOfYear() && endDate === getThailandToday() ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                ปีนี้
              </button>
            </div>
            <div className="flex items-center gap-2 px-2">
              <div className="flex items-center gap-2">
                <input type="date" value={startDate} onChange={e => {if (e.target.value) setStartDate(e.target.value)}} className="text-xs font-medium border border-slate-300 rounded px-2 py-1 outline-none text-slate-700 bg-white" />
                <span className="text-slate-400 text-xs">-</span>
                <input type="date" value={endDate} onChange={e => {if (e.target.value) setEndDate(e.target.value)}} className="text-xs font-medium border border-slate-300 rounded px-2 py-1 outline-none text-slate-700 bg-white" />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
             <div className="flex items-center gap-4 mb-2">
               <div className="p-3 bg-teal-50 text-teal-600 rounded-xl"><Users className="w-6 h-6"/></div>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">ผู้ป่วยทั้งหมด (วันนี้)</p>
             </div>
             <p className="text-4xl font-black text-slate-900">{stats.dailyStats?.total || 0} <span className="text-lg font-medium text-slate-400">คน</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
             <div className="flex items-center gap-4 mb-2">
               <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><Clock className="w-6 h-6"/></div>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">เวลารอคอยเฉลี่ย</p>
             </div>
             <p className="text-4xl font-black text-teal-600">{stats.avgWaitTimeMins} <span className="text-lg font-medium text-slate-400">นาที</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
             <div className="flex items-center gap-4 mb-2">
               <div className="p-3 bg-teal-50 text-teal-600 rounded-xl"><MonitorPlay className="w-6 h-6"/></div>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">อัตราการจองคิวออนไลน์</p>
             </div>
             <p className="text-4xl font-black text-slate-900">
               {stats.dailyStats?.total ? Math.round((stats.dailyStats.online / stats.dailyStats.total) * 100) : 0}%
             </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
             <div className="flex items-center gap-4 mb-2">
               <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><HeartPulse className="w-6 h-6"/></div>
               <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">ความพึงพอใจประเมิน</p>
             </div>
             <p className="text-4xl font-black text-slate-900">{stats?.satisfactionPercentage || 0}<span className="text-lg font-medium text-slate-400">%</span></p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Service Types Pie Chart */}
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">สัดส่วนประเภทการรับบริการ (Service Analytics)</h3>
             <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.serviceStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats.serviceStats.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} คิว`, 'จำนวน']} />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Booking Type Pie Chart */}
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">ช่องทางการเข้ารับบริการ (Walk-in vs Online)</h3>
             <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={walkinData}
                      cx="50%"
                      cy="50%"
                      innerRadius={0}
                      outerRadius={110}
                      dataKey="value"
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#22c55e" />
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} คิว`, 'จำนวน']} />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Peak Time Bar Chart */}
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm lg:col-span-2">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">ช่วงเวลาที่คนไข้หนาแน่น (Peak Time Analysis)</h3>
             <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.peakTimes} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600}} />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="จำนวนคิว" />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

        </div>

        {/* Patient Reviews Section */}
        <div className="mt-8">
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  รีวิวและคะแนนความพึงพอใจการบริการ (Patient Reviews & Ratings)
                </h3>
                <p className="text-xs text-slate-500 font-medium">คะแนนความพึงพอใจและข้อคิดเห็นจริงจากผู้มารับการรักษา</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-4 py-2 rounded-2xl border border-emerald-200 self-start sm:self-auto font-black text-xs uppercase tracking-wider">
                🌟 ทรานแซกชันจริง {stats.reviews?.length || 0} รีวิว
              </div>
            </div>

            {(!stats.reviews || stats.reviews.length === 0) ? (
              <div className="py-12 text-center text-slate-400 font-bold text-sm bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                ⭐ ยังไม่มีข้อมูลรีวิวความพึงพอใจในรอบข้อมูลนี้
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-1">
                {stats.reviews.map((rev: any) => {
                  const initials = (rev.full_name || 'พ').trim().substring(0, 1);
                  return (
                    <div 
                      key={rev.id} 
                      className="bg-slate-50/50 hover:bg-slate-50 border-2 border-slate-100 hover:border-slate-200/50 p-5 rounded-2xl shadow-sm hover:shadow transition-all flex flex-col justify-between gap-4 animate-in fade-in zoom-in-95 duration-300"
                    >
                      <div>
                        {/* Upper row: Avatar & name + Queue */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-black flex items-center justify-center text-xs shadow-inner">
                              {initials}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-xs sm:text-sm">{rev.full_name}</div>
                              <div className="text-[10px] text-slate-400 font-bold">{formatThaiDateTime(rev.completed_at)}</div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-xs font-black text-rose-500">{rev.queue_number}</div>
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full text-white bg-indigo-500 shadow-sm">
                              {rev.service_name}
                            </span>
                          </div>
                        </div>

                        {/* Middle row: Stars */}
                        <div className="flex gap-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map((starIdx) => (
                            <Star 
                              key={starIdx}
                              className={`w-4 h-4 ${starIdx <= (rev.satisfaction_score || 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                            />
                          ))}
                        </div>

                        {/* Comment text */}
                        <p className="text-slate-600 font-medium text-xs leading-relaxed italic bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          "{rev.satisfaction_comment}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* AI Insights Section */}
        <div className="mt-8">
          <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-500" />
                  AI ประมวลผลข้อมูล (Gemini)
                </h3>
                <p className="text-xs text-slate-500 font-medium">ให้ AI ช่วยประเมินและให้คำแนะนำเพื่อปรับปรุงบริการของ รพ.สต.</p>
              </div>
              <button 
                onClick={handleFetchInsights}
                disabled={loadingInsights}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                {loadingInsights ? 'กำลังประมวลผล...' : 'เริ่มการวิเคราะห์ด้วย AI'}
              </button>
            </div>
            
            {insights && (
              <div className="mt-4 p-6 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700">
                <div className="prose prose-slate prose-sm max-w-none">
                  <Markdown>{insights}</Markdown>
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}
