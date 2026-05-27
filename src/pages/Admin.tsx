import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Queue, Service } from '../types';
import { Play, SkipForward, CheckCircle, CheckCircle2, AlertCircle, UserPlus, Clock, Search, ArrowLeft, Layers as ServiceIcon, Zap, Settings, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import LineSimulator from '../components/LineSimulator';

const socket = io();

export default function Admin() {
  const [searchParams] = useSearchParams();
  const isCampaignMode = searchParams.get('campaign') === 'true';

  const [queues, setQueues] = useState<Queue[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  // Walk-in form state
  const [showWalkin, setShowWalkin] = useState(false);
  const [citizenId, setCitizenId] = useState('');
  const [fullName, setFullName] = useState('');
  const [serviceId, setServiceId] = useState('');

  // Service Hours Settings state
  const [openTime, setOpenTime] = useState('08:30');
  const [closeTime, setCloseTime] = useState('16:30');
  const [hospitalLat, setHospitalLat] = useState('13.7563');
  const [hospitalLng, setHospitalLng] = useState('100.5018');
  const [mapLink, setMapLink] = useState('');
  const [lineToken, setLineToken] = useState('');
  const [lineLiffId, setLineLiffId] = useState('');
  const [lineAdmin, setLineAdmin] = useState('');
  const [campaignCapacity, setCampaignCapacity] = useState('500');
  const [campaignTitle, setCampaignTitle] = useState('มหกรรมสุขภาพ / ฉีดวัคซีน');
  const [campaignDesc, setCampaignDesc] = useState('โหมด Mass Campaign: ระบบทำการกระจายคิวอัตโนมัติ เพื่อลดความแออัด');
  const [campaignStartDate, setCampaignStartDate] = useState('');
  const [campaignEndDate, setCampaignEndDate] = useState('');
  const [isEditingCampaignInfo, setIsEditingCampaignInfo] = useState(false);
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showServiceManagement, setShowServiceManagement] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [newSlotStart, setNewSlotStart] = useState('08:30');
  const [newSlotEnd, setNewSlotEnd] = useState('10:30');
  const [newSlotCapacity, setNewSlotCapacity] = useState(15);
  const [newSlotServiceId, setNewSlotServiceId] = useState('');
  const [newSlotDays, setNewSlotDays] = useState<string[]>(['0','1','2','3','4','5','6']);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testLineLoading, setTestLineLoading] = useState(false);
  const [testLineResult, setTestLineResult] = useState<{success?: boolean, error?: string, message?: string} | null>(null);

  // New Service states
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceMinutes, setNewServiceMinutes] = useState(15);

  const parseMapLink = (url: string) => {
    setMapLink(url);
    // Standard Google Maps URL pattern: .../@13.7563,100.5018,15z/...
    const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(coordRegex);
    if (match) {
      setHospitalLat(match[1]);
      setHospitalLng(match[2]);
      return;
    }

    // Alternative pattern: ...?q=13.7563,100.5018... or ...ll=13.7563,100.5018...
    const qRegex = /[?&](q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const qMatch = url.match(qRegex);
    if (qMatch) {
      setHospitalLat(qMatch[2]);
      setHospitalLng(qMatch[3]);
    }
  };

  const fetchQueues = () => {
    fetch('/api/queues').then(res => res.json()).then(data => setQueues(data));
  };

  const fetchSlots = () => {
    fetch('/api/admin/slots').then(res => res.json()).then(data => setSlots(data));
  };

  const fetchServices = () => {
    fetch('/api/services').then(res => res.json()).then(data => setServices(data));
  };

  useEffect(() => {
    fetchQueues();
    fetchSlots();
    fetchServices();
    
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.service_open_time) setOpenTime(data.service_open_time);
        if (data.service_close_time) setCloseTime(data.service_close_time);
        if (data.hospital_lat) setHospitalLat(data.hospital_lat);
        if (data.hospital_lng) setHospitalLng(data.hospital_lng);
        if (data.hospital_map_link !== undefined) setMapLink(data.hospital_map_link);
        if (data.line_channel_access_token !== undefined) setLineToken(data.line_channel_access_token);
        if (data.line_liff_id !== undefined) setLineLiffId(data.line_liff_id);
        if (data.line_admin_uid !== undefined) setLineAdmin(data.line_admin_uid);
        if (data.campaign_capacity !== undefined) setCampaignCapacity(data.campaign_capacity);
        if (data.campaign_title !== undefined) setCampaignTitle(data.campaign_title);
        if (data.campaign_desc !== undefined) setCampaignDesc(data.campaign_desc);
        if (data.campaign_start_date !== undefined) setCampaignStartDate(data.campaign_start_date);
        if (data.campaign_end_date !== undefined) setCampaignEndDate(data.campaign_end_date);
      });

    socket.on('queue_updated', () => {
      fetchQueues(); // Simplest way: re-fetch all active queues on update
    });
    
    socket.on('services_updated', (updated: Service[]) => {
      setServices(updated);
    });

    socket.on('settings_updated', (data: any) => {
        if (data.service_open_time) setOpenTime(data.service_open_time);
        if (data.service_close_time) setCloseTime(data.service_close_time);
        if (data.hospital_lat) setHospitalLat(data.hospital_lat);
        if (data.hospital_lng) setHospitalLng(data.hospital_lng);
        if (data.hospital_map_link !== undefined) setMapLink(data.hospital_map_link);
        if (data.line_channel_access_token !== undefined) setLineToken(data.line_channel_access_token);
        if (data.line_liff_id !== undefined) setLineLiffId(data.line_liff_id);
        if (data.line_admin_uid !== undefined) setLineAdmin(data.line_admin_uid);
        if (data.campaign_capacity !== undefined) setCampaignCapacity(data.campaign_capacity);
        if (data.campaign_title !== undefined) setCampaignTitle(data.campaign_title);
        if (data.campaign_desc !== undefined) setCampaignDesc(data.campaign_desc);
        if (data.campaign_start_date !== undefined) setCampaignStartDate(data.campaign_start_date);
        if (data.campaign_end_date !== undefined) setCampaignEndDate(data.campaign_end_date);
    });

    socket.on('slots_updated', () => {
      fetch('/api/admin/slots').then(res => res.json()).then(data => setSlots(data));
    });

    return () => {
      socket.off('queue_updated');
      socket.off('services_updated');
      socket.off('settings_updated');
      socket.off('slots_updated');
    };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/queues/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  };

  const handleTestLine = async () => {
    if (!lineToken || !lineAdmin) {
      setTestLineResult({ error: "โปรดระบุ LINE Channel Access Token และ Admin LINE User ID ก่อนทดสอบ (และต้องใส่ค่าให้ตรงกับเครื่องของตนเอง)" });
      return;
    }
    
    setTestLineLoading(true);
    setTestLineResult(null);
    try {
      const res = await fetch('/api/settings/test-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat: lineToken, uid: lineAdmin })
      });
      const data = await res.json();
      if (!res.ok) {
        setTestLineResult({ error: data.error });
      } else {
        setTestLineResult({ success: true, message: data.message });
      }
    } catch (err: any) {
      if (err && err.message && err.message.toLowerCase().includes('failed to fetch')) {
        setTestLineResult({ error: "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (Server อาจกำลังรีสตาร์ท หรือส่วนขยายเบราว์เซอร์เช่น AdBlock อาจทำการบล็อกการเชื่อมต่อ)"});
      } else {
        setTestLineResult({ error: err.message });
      }
    } finally {
      setTestLineLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const currentRes = await fetch('/api/settings');
      const current = await currentRes.json();
      
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...current,
          service_open_time: openTime,
          service_close_time: closeTime,
          hospital_lat: hospitalLat,
          hospital_lng: hospitalLng,
          hospital_map_link: mapLink,
          line_channel_access_token: lineToken,
          line_liff_id: lineLiffId,
          line_admin_uid: lineAdmin,
          campaign_title: campaignTitle,
          campaign_desc: campaignDesc,
          campaign_start_date: campaignStartDate,
          campaign_end_date: campaignEndDate
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const submitWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/queues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        citizen_id: citizenId,
        full_name: fullName,
        service_id: serviceId,
        booking_type: 'Walk-in',
        role: 'patient'
      })
    });
    setCitizenId('');
    setFullName('');
    setServiceId('');
    setShowWalkin(false);
  };

  const addSlot = async () => {
    await fetch('/api/admin/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: newSlotStart,
        end_time: newSlotEnd,
        capacity: newSlotCapacity,
        service_id: newSlotServiceId,
        days_of_week: newSlotDays.join(',')
      })
    });
    setNewSlotServiceId('');
    setNewSlotDays(['0','1','2','3','4','5','6']);
    fetchSlots();
  };

  const deleteSlot = async (id: number) => {
    await fetch(`/api/admin/slots/${id}`, { method: 'DELETE' });
    fetchSlots();
  };

  const toggleSlotStatus = async (slot: any) => {
    await fetch(`/api/admin/slots/${slot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...slot, active: slot.active === 1 ? 0 : 1 })
    });
    fetchSlots();
  };

  const addService = async () => {
    if (!newServiceName) return;
    await fetch('/api/admin/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_name: newServiceName,
        estimated_minutes: newServiceMinutes,
        color_code: 'bg-teal-500'
      })
    });
    setNewServiceName('');
    fetchServices();
  };

  const deleteService = async (id: string) => {
    await fetch(`/api/admin/services/${id}`, { method: 'DELETE' });
    fetchServices();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* Header */}
      <header className="h-20 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/staff" className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="font-black text-xl leading-none text-slate-900 tracking-tight">ระบบบริหารจัดการคิว</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ส่วนงานพยาบาลและคัดกรอง</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setShowServiceManagement(!showServiceManagement);
              setShowSettings(false);
              setShowWalkin(false);
            }}
            className="px-5 py-2.5 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-200 border border-slate-200 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm"
          >
            <ServiceIcon className="w-4 h-4" />
            <span className="hidden md:inline uppercase tracking-widest">บริการ</span>
          </button>
          <button 
            onClick={() => {
              setShowSettings(!showSettings);
              setShowServiceManagement(false);
              setShowWalkin(false);
            }}
            className="px-5 py-2.5 bg-white text-slate-500 hover:text-teal-600 hover:border-teal-200 border border-slate-200 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-sm"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden md:inline uppercase tracking-widest">ตั้งค่า</span>
          </button>
          <button 
            onClick={() => {
              setShowWalkin(!showWalkin);
              if (showSettings) setShowSettings(false);
            }}
            className="px-5 py-2.5 bg-slate-900 text-white hover:bg-teal-600 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-lg shadow-slate-900/10"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden md:inline uppercase tracking-widest">เพิ่มวอล์คอิน</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 md:p-12 overflow-y-auto w-full max-w-7xl mx-auto flex flex-col gap-4">
          
          {isCampaignMode && (
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-3xl p-6 text-white shadow-xl shadow-teal-200/50 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex-1 w-full relative group">
                <button 
                  onClick={() => setIsEditingCampaignInfo(!isEditingCampaignInfo)} 
                  className="absolute -top-2 -right-2 bg-white/30 hover:bg-white/50 p-2 rounded-full backdrop-blur-sm transition-all focus:outline-none z-10 shadow-sm"
                  title="ตั้งค่าประกาศประชาสัมพันธ์โครงการ"
                >
                  <Settings className="w-4 h-4 text-white" />
                </button>
                {isEditingCampaignInfo ? (
                   <div className="flex flex-col gap-2 w-full pr-8">
                     <input 
                       className="w-full bg-white/20 text-white placeholder-white/60 outline-none font-black text-xl rounded px-2 py-1" 
                       value={campaignTitle}
                       onChange={e => setCampaignTitle(e.target.value)}
                       placeholder="ชื่อโครงการ (เช่น มหกรรมฉีดวัคซีน)"
                     />
                     <div className="flex gap-2 items-center">
                        <span className="text-xs font-bold whitespace-nowrap">เริ่มต้น:</span>
                        <input type="date" value={campaignStartDate} onChange={e => setCampaignStartDate(e.target.value)} className="bg-white/20 text-white outline-none rounded px-2 py-1 text-sm color-scheme-dark" />
                        <span className="text-xs font-bold whitespace-nowrap">สิ้นสุด:</span>
                        <input type="date" value={campaignEndDate} onChange={e => setCampaignEndDate(e.target.value)} className="bg-white/20 text-white outline-none rounded px-2 py-1 text-sm color-scheme-dark" />
                     </div>
                     <textarea
                       className="w-full bg-white/20 text-white placeholder-white/60 outline-none font-medium text-sm rounded px-2 py-1 resize-none h-16"
                       value={campaignDesc}
                       onChange={e => setCampaignDesc(e.target.value)}
                       placeholder="รายละเอียดโครงการ..."
                     />
                     <div className="flex gap-2">
                       <button onClick={async () => {
                           setIsEditingCampaignInfo(false);
                           const currentRes = await fetch('/api/settings');
                           const current = await currentRes.json();
                           await fetch('/api/settings', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({...current, campaign_title: campaignTitle, campaign_desc: campaignDesc, campaign_start_date: campaignStartDate, campaign_end_date: campaignEndDate})
                           });
                       }} className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-3 py-1.5 rounded uppercase tracking-widest transition-colors">บันทึก</button>
                     </div>
                   </div>
                ) : (
                  <>
                    <h2 className="text-xl font-black mb-1 flex items-center gap-2">
                      <Zap className="w-5 h-5 fill-teal-200" /> {campaignTitle}
                    </h2>
                    <p className="text-teal-100 text-sm font-medium pr-8">{campaignDesc} สถานะปัจจุบัน: {services.find(s => s.id === 'service_campaign')?.is_active ? 'เปิดรับจอง' : 'ปิดรับจอง'}</p>
                  </>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                <button
                  onClick={async () => {
                     await fetch('/api/admin/services/service_campaign/toggle', { method: 'POST' });
                  }}
                  className={`px-4 py-2 rounded-xl font-bold text-sm shadow-md transition-all uppercase tracking-widest ${services.find(s => s.id === 'service_campaign')?.is_active ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200' : 'bg-white text-teal-700 hover:bg-teal-50 shadow-black/10'}`}
                >
                  {services.find(s => s.id === 'service_campaign')?.is_active ? 'ปิดรับจอง' : 'เปิดรับจอง'}
                </button>
                <div className="bg-white/20 px-4 py-2 rounded-xl text-center backdrop-blur-sm border border-white/20 transition-all">
                  <p className="text-[10px] uppercase tracking-widest font-bold">ยอดจองรวม</p>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-2xl">{queues.filter(q => q.service_name.includes('มหกรรม')).length} / </p>
                    {isEditingCapacity ? (
                       <input 
                         type="number" 
                         value={campaignCapacity}
                         min="1"
                         className="w-16 bg-white/30 text-white placeholder-white outline-none font-black text-2xl rounded text-center"
                         onChange={e => setCampaignCapacity(e.target.value)}
                         onBlur={async () => {
                           setIsEditingCapacity(false);
                           const currentRes = await fetch('/api/settings');
                           const current = await currentRes.json();
                           await fetch('/api/settings', {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({...current, campaign_capacity: campaignCapacity})
                           });
                         }}
                         autoFocus
                       />
                    ) : (
                       <p className="font-black text-2xl cursor-pointer hover:text-teal-200" onClick={() => setIsEditingCapacity(true)} title="คลิกเพื่อแก้ไขตัวเลขนี้">
                         {campaignCapacity}
                       </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showServiceManagement && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-100 rounded-[32px] p-10 mb-12 shadow-xl shadow-slate-200/50 max-w-3xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
                  <ServiceIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">ตั้งค่าบริการ</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">การจัดการระบบหลังบ้าน</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-end border border-slate-100">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">ชื่อบริการ</label>
                  <input type="text" value={newServiceName} onChange={e => setNewServiceName(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold" placeholder="เช่น ตรวจทั่วไป" />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">เวลาเฉลี่ย (นาที)</label>
                  <input type="number" value={newServiceMinutes} onChange={e => setNewServiceMinutes(parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold" />
                </div>
                <button type="button" onClick={addService} className="bg-slate-900 text-white rounded-xl p-3.5 font-black text-xs uppercase tracking-widest hover:bg-teal-600 transition-all">เพิ่มบริการ</button>
              </div>

              <div className="space-y-3">
                {services.map(service => (
                  <div key={service.id} className="flex items-center justify-between px-6 py-4 rounded-2xl border bg-white border-slate-100 shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="font-black text-slate-900 text-lg tracking-tight">{service.service_name}</div>
                      <div className="text-[10px] px-3 py-1 bg-slate-100 rounded-full font-black text-slate-400 tracking-widest uppercase">{service.estimated_minutes} นาที</div>
                    </div>
                    <button type="button" onClick={() => deleteService(service.id)} className="text-[10px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest transition-all">ลบ</button>
                  </div>
                ))}
                {services.length === 0 && <p className="text-center font-bold text-slate-300 py-8">ยังไม่มีบริการที่กำหนด</p>}
              </div>
            </motion.div>
          )}

          {showSettings && (
            <motion.form 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSaveSettings} 
              className="bg-white border border-slate-100 rounded-[32px] p-10 mb-12 shadow-xl shadow-slate-200/50 max-w-3xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">ตั้งค่าปฏิทินและเวลา</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">จัดการพารามิเตอร์ระบบ</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">เวลาเปิดทำการ</label>
                  <input 
                    type="time" 
                    value={openTime} 
                    onChange={e => setOpenTime(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-teal-500 focus:bg-white font-black text-lg transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">เวลาปิดทำการ</label>
                  <input 
                    type="time" 
                    value={closeTime} 
                    onChange={e => setCloseTime(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-teal-500 focus:bg-white font-black text-lg transition-all"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-8">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                  <span>ลิงก์ตำแหน่ง Google Maps</span>
                  <button 
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((pos) => {
                          setHospitalLat(pos.coords.latitude.toString());
                          setHospitalLng(pos.coords.longitude.toString());
                          setMapLink(`https://www.google.com/maps/@${pos.coords.latitude},${pos.coords.longitude},17z`);
                        });
                      }
                    }}
                    className="text-[10px] text-teal-600 font-black hover:underline cursor-pointer"
                  >
                    ใช้ตำแหน่งปัจจุบัน
                  </button>
                </label>
                <input 
                  type="text" 
                  value={mapLink} 
                  onChange={e => parseMapLink(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-teal-500 focus:bg-white font-medium text-sm transition-all"
                  placeholder="วางลิงก์ Google Maps ที่นี่..."
                />
              </div>

              <div className="flex flex-col gap-4 pt-8 border-t border-slate-50 mb-8">
                <div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight mb-2 text-green-600 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" /> การแจ้งเตือนผ่าน LINE (Messaging API)
                  </h3>
                  <p className="text-xs font-medium text-slate-500 mb-6">รับการแจ้งเตือนคิวอัตโนมัติผ่านทางแอปพลิเคชัน LINE</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    LINE Channel Access Token
                  </label>
                  <input
                    type="password"
                    value={lineToken}
                    onChange={e => setLineToken(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-green-500 focus:bg-white font-medium text-sm transition-all"
                    placeholder="วาง Channel Access Token (Long-lived) ที่นี่..."
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">รับได้จากแท็บ Messaging API ใน LINE Developers Console</p>
                </div>
                <div className="mt-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    LINE LIFF ID
                  </label>
                  <input
                    type="text"
                    value={lineLiffId}
                    onChange={e => setLineLiffId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-green-500 focus:bg-white font-medium text-sm transition-all"
                    placeholder="เช่น 1234567890-abcdefgh"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">เพื่อดึง User ID ของผู้ใช้เมื่อเปิดผ่านริชเมนูใน LINE อัตโนมัติ</p>
                </div>
                <div className="mt-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Admin LINE User ID (ตัวเลือก - สำหรับแอดมินรับข้อความ)
                  </label>
                  <input
                    type="text"
                    value={lineAdmin}
                    onChange={e => setLineAdmin(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 outline-none focus:border-green-500 focus:bg-white font-medium text-sm transition-all"
                    placeholder="เช่น U1234567890abcdef1234567890abcdef"
                  />
                  <div className="mt-4 flex flex-col items-start gap-2">
                    <button
                      type="button"
                      onClick={handleTestLine}
                      disabled={testLineLoading}
                      className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {testLineLoading ? "กำลังทดสอบ..." : "ทดสอบส่งการแจ้งเตือนไปที่ Admin"}
                    </button>
                    {testLineResult && (
                      <div className={`p-4 rounded-xl text-xs font-medium border ${testLineResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} w-full mt-2 animate-in fade-in zoom-in duration-300`}>
                        {testLineResult.success ? (
                          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {testLineResult.message}</div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="font-bold flex items-center gap-1"><AlertCircle className="w-4 h-4" /> เกิดข้อผิดพลาดจากฝั่ง LINE API:</span>
                            <span>{testLineResult.error}</span>
                            <span className="text-red-500/80 text-[10px] mt-1 block">ตรวจสอบว่าคุณกรอก Channel Access Token ถูกต้อง และได้เพิ่ม Official Account (Bot) เป็นเพื่อนแล้ว</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                <div className="text-emerald-600 font-bold text-xs uppercase tracking-widest">
                  {saveSuccess && "บันทึกข้อมูลเรียบร้อย!"}
                </div>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-teal-600 transition-all disabled:opacity-50 shadow-lg shadow-slate-900/10"
                >
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                </button>
              </div>

              <div className="mt-12 pt-10 border-t border-slate-50">
                <h3 className="font-black text-slate-900 text-lg mb-6 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-teal-600" /> รอบการจองล่วงหน้า
                </h3>
                
                <div className="bg-slate-50 rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-5 gap-6 items-end border border-slate-100">
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">บริการ (ทุกบริการ ถ้าไม่ระบุ)</label>
                    <select value={newSlotServiceId} onChange={e => setNewSlotServiceId(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold appearance-none">
                      <option value="">-- รวมทุกบริการ --</option>
                      {services.filter(s => s.is_active !== 0).map(s => <option key={s.id} value={s.id}>{s.service_name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 md:col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">วันที่ให้บริการ</label>
                    <div className="flex flex-wrap gap-2">
                       {[{id:'1',label:'จ.'}, {id:'2',label:'อ.'}, {id:'3',label:'พ.'}, {id:'4',label:'พฤ.'}, {id:'5',label:'ศ.'}, {id:'6',label:'ส.'}, {id:'0',label:'อา.'}].map(day => (
                         <label key={day.id} className={`flex-1 min-w-[40px] text-center cursor-pointer text-[10px] px-2 py-3 rounded-xl border font-black uppercase tracking-widest transition-all ${newSlotDays.includes(day.id) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={newSlotDays.includes(day.id)}
                              onChange={(e) => {
                                if (e.target.checked) setNewSlotDays(prev => [...prev, day.id]);
                                else setNewSlotDays(prev => prev.filter(d => d !== day.id));
                              }}
                            />
                            {day.label}
                         </label>
                       ))}
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">เริ่มต้น</label>
                    <input type="time" value={newSlotStart} onChange={e => setNewSlotStart(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold" />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">สิ้นสุด</label>
                    <input type="time" value={newSlotEnd} onChange={e => setNewSlotEnd(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold" />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest">ความจุ</label>
                    <input type="number" value={newSlotCapacity} onChange={e => setNewSlotCapacity(parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold" />
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <button type="button" onClick={addSlot} className="w-full bg-white text-slate-900 border border-slate-200 rounded-xl p-3.5 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">เพิ่มรอบ</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {slots.map(slot => (
                    <div key={slot.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between px-6 py-4 rounded-2xl border transition-all gap-4 ${slot.active ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50/50 border-transparent opacity-50'}`}>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="font-black text-slate-900 text-lg tracking-tight">{slot.start_time} — {slot.end_time}</div>
                          <div className="text-[10px] px-3 py-1 bg-slate-100 rounded-full font-black text-slate-600 tracking-widest uppercase">จำกัด: {slot.capacity} ท่าน</div>
                          {slot.service_id && <div className="text-[10px] px-3 py-1 bg-teal-50 text-teal-600 rounded-full font-black tracking-widest uppercase truncate max-w-[150px]">{slot.service_name}</div>}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400">
                          ให้บริการวัน: {
                            slot.days_of_week 
                              ? slot.days_of_week.split(',').map((d: string) => ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][parseInt(d)]).join(', ')
                              : 'ทุกวัน'
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                        <button type="button" onClick={() => toggleSlotStatus(slot)} className={`text-[10px] font-black uppercase tracking-widest transition-all ${slot.active ? 'text-rose-500 hover:text-rose-600' : 'text-emerald-500 hover:text-emerald-600'}`}>
                          {slot.active ? 'ปิดการนัด' : 'เปิดการนัด'}
                        </button>
                        <button type="button" onClick={() => deleteSlot(slot.id)} className="text-[10px] font-black text-slate-300 hover:text-rose-500 uppercase tracking-widest transition-all">ลบ</button>
                      </div>
                    </div>
                  ))}
                  {slots.length === 0 && <p className="text-center font-bold text-slate-300 py-8">ยังไม่มีรอบการจองนัดหมายที่กำหนด</p>}
                </div>
              </div>
            </motion.form>
          )}

          {showWalkin && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-100 rounded-[32px] p-10 mb-12 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row items-end gap-6"
            >
              <div className="w-full md:flex-1">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">เลขบัตรประชาชน / สแกนสมาร์ทการ์ด</label>
                 <div className="relative">
                   <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                   <input type="text" value={citizenId} onChange={e=>setCitizenId(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-teal-500 focus:bg-white font-bold" placeholder="ระบุเลขบัตร 13 หลัก..."/>
                 </div>
              </div>
              <div className="w-full md:flex-1">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">ชื่อ-นามสกุล</label>
                 <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 outline-none focus:border-teal-500 focus:bg-white font-bold" placeholder="ชื่อผู้รับบริการ"/>
              </div>
              <div className="w-full md:flex-1">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">ประเภทบริการ</label>
                 <select value={serviceId} onChange={e=>setServiceId(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 outline-none focus:border-teal-500 focus:bg-white font-bold appearance-none">
                    <option value="">เลือกบริการ...</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.service_name}</option>)}
                 </select>
              </div>
              <button disabled={!citizenId || !serviceId} onClick={submitWalkin} className="w-full md:w-auto bg-teal-600 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-teal-500/10">
                ลงทะเบียน
              </button>
            </motion.div>
          )}

          {/* Queues List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {queues.length === 0 ? (
              <div className="col-span-full py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-400 font-bold text-lg">ยังไม่มีรายการคิวรอรับบริการ</p>
              </div>
            ) : queues.map((q) => (
              <div key={q.id} className={`bg-white rounded-[40px] border border-slate-100 overflow-hidden shadow-xl shadow-slate-200/40 flex flex-col transition-all duration-500 ${q.status === 'Calling' ? 'ring-4 ring-teal-500/10 scale-105 z-10' : ''}`}>
                <div className={`px-6 py-4 border-b border-slate-50 flex justify-between items-center ${q.booking_type === 'Online' ? 'bg-teal-50/30' : 'bg-slate-50/50'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${q.booking_type === 'Online' ? 'bg-teal-500' : 'bg-slate-400'}`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${q.booking_type === 'Online' ? 'text-teal-600' : 'text-slate-400'}`}>
                      {q.booking_type === 'Online' ? 'ออนไลน์' : 'วอล์คอิน'}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-slate-300 flex items-center gap-1 uppercase tracking-widest">{format(new Date(q.created_at), 'HH:mm')}</span>
                </div>
                
                <div className="p-8 flex-1 text-center">
                  <div className={`mx-auto w-16 h-1 bg-slate-100 rounded-full mb-6 ${q.color_code.replace('bg-', 'bg-')}`} />
                  <h2 className="text-7xl font-black text-slate-900 tracking-tighter mb-2 leading-none">{q.queue_number}</h2>
                  <p className="text-xs text-teal-600 font-black uppercase tracking-[0.2em]">{q.service_name}</p>
                  
                  <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col items-center">
                    <p className="text-base text-slate-900 font-black leading-tight mb-2">{q.full_name}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {q.preferred_time ? (
                        <span className="inline-flex items-center gap-2 text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-teal-100">
                          <Clock className="w-3 h-3" /> {q.preferred_time} น.
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-[10px] font-black text-slate-400 px-3 py-1.5 rounded-full uppercase tracking-widest">
                          คิวทั่วไป
                        </span>
                      )}
                      
                      {q.status === 'Waiting' && (
                        <span className="inline-flex items-center gap-2 text-[10px] font-black text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-orange-100">
                          รอ {q.estimated_wait_time} นาที
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 bg-slate-50">
                  {q.status === 'Waiting' ? (
                    <button onClick={() => updateStatus(q.id, 'Calling')} className="py-6 text-xs font-black text-teal-600 hover:bg-teal-100 flex items-center justify-center gap-3 transition-all uppercase tracking-widest border-t border-slate-100">
                      <Play className="w-4 h-4 fill-teal-600" /> เริ่มการตรวจ
                    </button>
                  ) : q.status === 'Calling' ? (
                    <div className="grid grid-cols-3">
                      <button onClick={() => updateStatus(q.id, 'Skipped')} className="p-4 text-[10px] font-black text-rose-500 hover:bg-rose-50 flex flex-col items-center justify-center gap-2 border-r border-slate-100 transition-all uppercase tracking-widest">
                        <SkipForward className="w-5 h-5" /> ข้าม
                      </button>
                      <button onClick={() => updateStatus(q.id, 'Calling')} className="p-4 text-[10px] font-black text-teal-600 hover:bg-teal-100 flex flex-col items-center justify-center gap-2 border-r border-slate-100 transition-all uppercase tracking-widest">
                        <Play className="w-5 h-5 fill-teal-600" /> เรียกซ้ำ
                      </button>
                      <button onClick={() => updateStatus(q.id, 'Completed')} className="p-4 text-[10px] font-black text-slate-900 hover:bg-slate-200 flex flex-col items-center justify-center gap-2 transition-all uppercase tracking-widest">
                        <CheckCircle className="w-5 h-5" /> เสร็จสิ้น
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

        </main>
        <LineSimulator />
    </div>
  );
}
