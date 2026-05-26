import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, CheckCircle2, ChevronRight, Stethoscope, ArrowLeft, Settings, Trash2, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Kiosk() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<any>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceMinutes, setNewServiceMinutes] = useState(15);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editMinutes, setEditMinutes] = useState(15);

  const fetchServices = () => {
    fetch('/api/services').then(res => res.json()).then(data => setServices(data));
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName) return;
    await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_name: newServiceName, estimated_minutes: newServiceMinutes })
    });
    setNewServiceName('');
    setNewServiceMinutes(15);
    fetchServices();
  };

  const startEdit = (service: any) => {
    setEditingId(service.id);
    setEditName(service.service_name);
    setEditMinutes(service.estimated_minutes || 15);
  };

  const saveEdit = async (id: string) => {
    await fetch(`/api/admin/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_name: editName, estimated_minutes: editMinutes })
    });
    setEditingId(null);
    fetchServices();
  };

  const deleteService = async (id: string) => {
    setIsDeleting(true);
    await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
    fetchServices();
    setIsDeleting(false);
  };

  const handleRegister = async (service: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: 'ผู้รับบริการ Kiosk',
          phone: '',
          service_id: service.id,
          booking_type: 'Walk-in',
          citizen_id: `KIOSK-${Date.now()}` // Unique ID for kiosk walk-in
        })
      });
      const data = await res.json();
      setSelectedService(service);
      setTicket(data);
      setStep(3);
    } catch (error) {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedService(null);
    setFullName('');
    setPhone('');
    setTicket(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col">
      {/* Kiosk Header */}
      <div className="p-8 flex justify-between items-center bg-white border-b border-slate-100">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Q-FLOW <span className="text-teal-600">คีออส</span></h1>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">บริการรับคิวด้วยตนเอง (Self-Service)</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowSettings(true)} className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600">
            <Settings className="w-6 h-6" />
          </button>
          <Link to="/" className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center hover:bg-slate-100 transition-all">
            <ArrowLeft className="w-6 h-6 text-slate-400" />
          </Link>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-5xl"
            >
              <h2 className="text-5xl font-black text-center mb-16 tracking-tight text-slate-900">
                เลือกบริการที่ท่านต้องการ <br/>
                <span className="text-base font-bold text-slate-400 uppercase tracking-[0.3em]">กรุณาเลือกประเภทการรับบริการ</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {services.map(service => (
                  <button
                    key={service.id}
                    id={`service-btn-${service.id}`}
                    onClick={() => handleRegister(service)}
                    disabled={loading}
                    className="group relative bg-white border border-slate-200 p-10 rounded-[32px] hover:border-teal-500 hover:shadow-xl hover:shadow-teal-500/5 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex items-center gap-8">
                      <div className="w-24 h-24 bg-slate-50 group-hover:bg-teal-50 flex items-center justify-center rounded-[24px] transition-all">
                        <Stethoscope className="w-12 h-12 text-slate-400 group-hover:text-teal-600" />
                      </div>
                      <div>
                        <div className="text-3xl font-black mb-1 group-hover:text-teal-600 transition-all">{service.service_name}</div>
                        <div className="text-slate-400 font-bold text-lg">แตะที่นี่เพื่อรับคิวทันที</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm"
            >
              <div className="bg-white text-slate-900 p-10 rounded-[48px] shadow-2xl relative overflow-hidden ring-1 ring-slate-100">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-black text-teal-600 uppercase tracking-[0.3em]">ลงทะเบียนสำเร็จ</h3>
                </div>

                  <div className="text-center py-10 my-8 bg-slate-50 rounded-[32px] border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest leading-none">{selectedService?.service_name}</div>
                    <div className="text-8xl font-black tracking-tighter text-slate-900 leading-none">{ticket?.queue_number}</div>
                    {ticket?.estimated_wait_time > 0 && (
                      <div className="mt-6 px-4 py-2 bg-teal-50 rounded-xl inline-flex flex-col items-center border border-teal-100">
                         <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest leading-none mb-1">เวลารอประมาณ</span>
                         <span className="text-sm font-black text-teal-700 leading-none">{ticket.estimated_wait_time} นาที</span>
                      </div>
                    )}
                  </div>

                <div className="space-y-2 text-center mb-10">
                  <p className="font-bold text-slate-500 text-lg">กรุณารอเรียกคิวบริเวณจุดพักคอย</p>
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <button 
                  id="kiosk-finish-btn"
                  onClick={reset}
                  className="w-full bg-teal-600 text-white py-5 rounded-2xl font-black uppercase text-xl hover:bg-teal-700 transition-all shadow-md shadow-teal-600/10"
                >
                  เสร็จสิ้น
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="p-8 text-center text-slate-300 font-bold text-[10px] uppercase tracking-[0.3em]">
        ระบบความปลอดภัยทำงานปกติ • พัฒนาโดย Q-Flow
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[32px] shadow-2xl p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-900">ตั้งค่าบริการ</h2>
                <button onClick={() => setShowSettings(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold hover:bg-slate-200 transition-all">ปิด</button>
              </div>
              
              <form onSubmit={addService} className="flex flex-wrap sm:flex-nowrap gap-4 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ชื่อบริการ</label>
                  <input type="text" value={newServiceName} onChange={e => setNewServiceName(e.target.value)} placeholder="เช่น ตรวจโรคทั่วไป" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" required />
                </div>
                <div className="w-full sm:w-32">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">เวลา (นาที)</label>
                  <input type="number" value={newServiceMinutes} onChange={e => setNewServiceMinutes(Number(e.target.value))} min="1" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" required />
                </div>
                <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 transition-all flex items-center justify-center whitespace-nowrap">
                  เพิ่มบริการ
                </button>
              </form>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">บริการทั้งหมดที่มี {services.length} รายการ</h3>
                {services.map(service => (
                  <div key={service.id} className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/5 transition-all">
                    {editingId === service.id ? (
                      <div className="flex-1 flex flex-col sm:flex-row items-center gap-4 w-full">
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 w-full px-4 py-2 text-lg font-bold rounded-xl border border-teal-500 focus:outline-none" />
                        <input type="number" value={editMinutes} onChange={e => setEditMinutes(Number(e.target.value))} className="w-full sm:w-24 px-4 py-2 rounded-xl border border-teal-500 focus:outline-none" />
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(service.id)} className="px-4 py-2 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700">บันทึก</button>
                          <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">ยกเลิก</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-teal-50 text-teal-600`}>
                            <Stethoscope className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xl">{service.service_name}</div>
                            <div className="text-sm text-slate-500 font-bold mt-1">ใช้เวลาประมาณ {service.estimated_minutes || 15} นาที / คิว</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(service)} disabled={isDeleting} className="w-12 h-12 flex items-center justify-center text-teal-600 bg-teal-50 hover:bg-teal-600 hover:text-white rounded-xl transition-all disabled:opacity-50">
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button onClick={() => deleteService(service.id)} disabled={isDeleting} className="w-12 h-12 flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all disabled:opacity-50">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {services.length === 0 && (
                  <div className="text-center py-10 text-slate-400 font-bold border-2 border-dashed border-slate-100 rounded-3xl">ไม่มีบริการในระบบ</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
