import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, Clock, MonitorPlay, HeartPulse, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Analytics() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/analytics').then(res => res.json()).then(data => setStats(data));
  }, []);

  if (!stats) return <div className="p-8 text-center text-slate-500">Loading Analytics...</div>;

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

  const walkinData = [
    { name: 'Walk-in', value: stats.dailyStats?.walkin || 0 },
    { name: 'Online (LINE)', value: stats.dailyStats?.online || 0 }
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex items-start gap-4">
          <Link to="/staff" className="mt-1 w-10 h-10 bg-white border-2 border-slate-200 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">รายงานสรุปข้อมูล (สำหรับผู้อำนวยการ)</h1>
            <p className="text-sm text-slate-500 font-medium">สำหรับผู้อำนวยการ รพ.สต. และประเมินผลการให้บริการ</p>
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
             <p className="text-4xl font-black text-slate-900">92<span className="text-lg font-medium text-slate-400">%</span></p>
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
      </div>
    </div>
  );
}
