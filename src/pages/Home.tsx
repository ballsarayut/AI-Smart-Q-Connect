import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, MonitorPlay, ShieldCheck, Menu, X, Heart, Users, Leaf, Bell, Search, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { Queue } from '../types';

const socket = io();

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeQueue, setActiveQueue] = useState<Queue | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<Queue | null>(null);
  const [searchError, setSearchError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCampaignActive, setIsCampaignActive] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('มหกรรมสุขภาพ / ฉีดวัคซีน');
  const [campaignDesc, setCampaignDesc] = useState('เพื่อความสะดวกรวดเร็วและลดความแออัด ท่านสามารถจองคิวเข้ารับบริการล่วงหน้าได้สูงสุด 10 วัน โปรดเลือกวันและรอบเวลาที่คุณสะดวก');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setSearchResult(null);
    
    try {
      const res = await fetch(`/api/queues/number/${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      
      if (res.ok) {
        setSearchResult(data);
      } else {
        setSearchError(data.error || 'ไม่พบข้อมูลคิว');
      }
    } catch (e) {
      setSearchError('เกิดข้อผิดพลาดในการค้นหา');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.campaign_title) setCampaignTitle(data.campaign_title);
        if (data.campaign_desc) setCampaignDesc(data.campaign_desc);
      } catch (e) {
        console.error(e);
      }
    };

    const fetchServices = async () => {
      try {
        const res = await fetch('/api/services');
        const data = await res.json();
        const campaign = data.find((s: any) => s.id === 'service_campaign');
        setIsCampaignActive(campaign?.is_active === 1);
      } catch (e) {
        console.error(e);
      }
    };

    const fetchActiveQueue = async () => {
      try {
        const res = await fetch('/api/queues');
        const data: Queue[] = await res.json();
        
        // Filter out campaign queues and find the currently calling or next-up queue
        const normalQueues = data.filter(q => !q.service_name.includes('มหกรรม'));
        const calling = normalQueues.filter(q => q.status === 'Calling' || q.status === 'In-progress');
        
        if (calling.length > 0) {
          setActiveQueue(calling[calling.length - 1]);
        } else {
          // If none calling, just show the next waiting maybe? Or just keep it null.
          setActiveQueue(null);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchSettings();
    fetchServices();
    fetchActiveQueue();

    socket.on('queue_updated', (updatedQueue: Queue) => {
      fetchActiveQueue();
      setSearchResult(prev => {
        if (prev && prev.id === updatedQueue.id) {
          return updatedQueue;
        }
        return prev;
      });
    });

    socket.on('services_updated', (updatedServices: any[]) => {
      const campaign = updatedServices.find((s: any) => s.id === 'service_campaign');
      setIsCampaignActive(campaign?.is_active === 1);
    });

    return () => {
      socket.off('queue_updated');
      socket.off('services_updated');
    };
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col items-center relative overflow-x-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-teal-50/50 rounded-full mix-blend-multiply filter blur-3xl"></div>
        <div className="absolute top-40 -right-20 w-[400px] h-[400px] bg-emerald-50/50 rounded-full mix-blend-multiply filter blur-3xl"></div>
        <div className="absolute -bottom-40 left-10 w-[600px] h-[600px] bg-cyan-50/50 rounded-full mix-blend-multiply filter blur-3xl"></div>
      </div>

      {/* Top Header / Admin Controls */}
      <div className="w-full p-6 flex justify-between items-center fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center relative shadow-md">
            <span className="text-white font-black text-2xl tracking-tighter relative z-10">Q</span>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-teal-500 rounded-full border-2 border-white"></div>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight flex-1">
            <span className="text-teal-500">AI</span> Smart <span className="text-teal-500">Q</span> Connect
          </h1>
        </div>
        {/* Desktop Menu */}
        <div className="hidden md:flex gap-3">
          <Link 
            to="/staff-login" 
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl font-bold text-xs transition-all uppercase tracking-widest border border-slate-100"
          >
            <ShieldCheck className="w-4 h-4" />
            จัดการระบบ
          </Link>
          <Link 
            to="/staff-login?mode=kiosk" 
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl font-bold text-xs transition-all uppercase tracking-widest border border-slate-100"
          >
            <MonitorPlay className="w-4 h-4" />
            ตั้งค่าคีออส
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-3 bg-slate-50 text-slate-600 rounded-xl border border-slate-100 hover:bg-slate-100 z-50 relative"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-6 bg-white shadow-2xl rounded-2xl p-4 flex flex-col gap-2 border border-slate-100 z-50 md:hidden"
          >
            <Link 
              to="/staff-login" 
              className="flex items-center gap-3 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-sm transition-all tracking-widest border border-slate-100"
            >
              <ShieldCheck className="w-5 h-5 text-slate-400" />
              จัดการระบบ
            </Link>
            <Link 
              to="/staff-login?mode=kiosk" 
              className="flex items-center gap-3 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-sm transition-all tracking-widest border border-slate-100"
            >
              <MonitorPlay className="w-5 h-5 text-slate-400" />
              ตั้งค่าคีออส
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-12 max-w-2xl w-full z-10">
        <header className="text-center mb-8">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm md:text-base text-slate-500 font-normal">
              เชื่อมต่อความ<span className="text-teal-600 font-bold">สะดวก</span> บริหารจัดการคิว<span className="text-teal-600 font-bold">อัจฉริยะ</span>
            </p>
            <div className="h-[2px] w-12 bg-teal-500 rounded-full" />
          </div>
        </header>

        {/* Core Values Badges */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-6 mb-10 w-full">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-50/80 rounded-2xl border border-teal-100 text-teal-700 backdrop-blur-sm shadow-sm"
          >
            <Heart className="w-4 h-4 text-teal-500 fill-teal-100" />
            <span className="font-bold text-sm tracking-tight text-teal-800">ใส่ใจสุขภาพ</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-emerald-700 backdrop-blur-sm shadow-sm"
          >
            <Users className="w-4 h-4 text-emerald-500 fill-emerald-100" />
            <span className="font-bold text-sm tracking-tight text-emerald-800">ลดความเหลื่อมล้ำ</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-50/80 rounded-2xl border border-cyan-100 text-cyan-700 backdrop-blur-sm shadow-sm"
          >
            <Leaf className="w-4 h-4 text-cyan-500 fill-cyan-100" />
            <span className="font-bold text-sm tracking-tight text-cyan-800">เป็นมิตรเข้าถึงง่าย</span>
          </motion.div>
        </div>

        {/* PRIMARY ACTION - Minimal but prominent */}
        {isCampaignActive && (
          <div className="w-full mb-8 relative group">
            {/* Notification Badge */}
            <div className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 z-20">
              <span className="relative flex h-10 w-10 sm:h-12 sm:w-12">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-10 w-10 sm:h-12 sm:w-12 bg-rose-500 items-center justify-center text-white font-black text-xs sm:text-sm shadow-lg border-2 border-white transform rotate-12">Hot!</span>
              </span>
            </div>
            
            <Link 
              to="/patient?service=service_campaign" 
              className="block w-full bg-gradient-to-br from-teal-500 via-teal-600 to-cyan-700 p-1 rounded-[40px] transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/40 active:scale-95 overflow-hidden relative"
            >
              {/* Background decorative elements */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                <div className="absolute top-20 right-0 w-60 h-60 bg-cyan-400 rounded-full blur-3xl mix-blend-overlay"></div>
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M0,100 C30,60 70,60 100,100 L100,0 L0,0 Z" fill="rgba(255,255,255,0.05)" />
                </svg>
              </div>

              <div className="bg-gradient-to-br from-teal-500/90 to-teal-700/90 backdrop-blur-sm h-full w-full rounded-[38px] p-6 sm:p-10 flex flex-col md:flex-row items-center gap-6 sm:gap-8 transition-colors duration-500 relative z-10 border border-teal-400/50">
                <div className="text-center md:text-left flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-white text-xs font-bold tracking-widest uppercase mb-3 border border-white/20 backdrop-blur-md">
                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                    ประกาศประชาสัมพันธ์
                  </div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 tracking-tight drop-shadow-md">{campaignTitle}</h2>
                  <p className="text-teal-50 text-sm sm:text-base md:text-lg leading-relaxed font-medium drop-shadow opacity-90 mb-4 whitespace-pre-line">
                    {campaignDesc}
                  </p>
                  
                  <div className="inline-flex items-center gap-2 px-5 py-3 sm:px-6 sm:py-3.5 bg-white text-teal-700 rounded-full font-black text-sm uppercase tracking-widest group-hover:bg-teal-50 transition-colors shadow-lg">
                    จองคิวทันที
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        <Link 
          to="/patient" 
          className="group w-full bg-slate-900 hover:bg-teal-600 p-1 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[40px] transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/20 active:scale-95"
        >
          <div className="bg-slate-900 group-hover:bg-teal-600 h-full w-full rounded-[38px] p-10 md:p-14 flex flex-col items-center gap-8 transition-colors duration-500">
            <div className="bg-white w-20 h-20 rounded-2xl flex items-center justify-center relative shadow-lg group-hover:scale-110 transition-all duration-500">
              <span className="text-slate-900 font-black text-5xl tracking-tighter relative z-10">Q</span>
              <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-teal-500 rounded-full border-[3px] border-white"></div>
            </div>
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">จองคิวออนไลน์</h2>
              <p className="text-slate-400 group-hover:text-teal-50 font-medium text-lg leading-relaxed">จองล่วงหน้าจากที่บ้าน มั่นใจ ปลอดภัย</p>
            </div>
          </div>
        </Link>
        
        {/* Realtime Queue Tracker */}
        {activeQueue && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full mt-6 bg-rose-50 rounded-[32px] p-6 md:p-8 flex items-center justify-between border-2 border-rose-100 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center shadow-md animate-pulse">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-600 uppercase tracking-widest mb-1">กำลังเรียกคิว (รพ.สต.)</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">{activeQueue.queue_number}</span>
                  <span className="text-slate-600 font-medium text-sm md:text-base hidden md:inline-block">({activeQueue.service_name})</span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">สถานที่</p>
              <p className="font-black text-slate-900 border-b-2 border-slate-200 pb-1">จุดคัดกรอง</p>
            </div>
          </motion.div>
        )}

        {/* Queue Status Checker widget */}
        <div className="w-full mt-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center">
              <Search className="w-5 h-5 text-slate-600" />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">ตรวจสอบสถานะคิวของคุณ</h3>
          </div>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="กรอกหมายเลขคิวของคุณ (เช่น A001)" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:flex-1 bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 outline-none focus:border-teal-500 transition-all font-bold text-slate-700 uppercase"
            />
            <button 
              type="submit" 
              disabled={isSearching || !searchQuery.trim()}
              className="w-full sm:w-auto bg-slate-900 text-white px-8 py-4 sm:py-0 rounded-2xl font-bold hover:bg-teal-600 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {isSearching ? 'กำลังค้นหา...' : 'ตรวจสอบ'}
            </button>
          </form>

          {searchError && (
            <div className="mt-4 p-4 bg-rose-50 text-rose-600 rounded-2xl font-medium border-2 border-rose-100">
              {searchError}
            </div>
          )}

          {searchResult && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 border-2 border-teal-100 bg-teal-50 rounded-2xl p-6"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-xs font-bold text-teal-600 tracking-widest uppercase mb-1">สถานะปัจจุบัน</p>
                  <p className="text-2xl font-black text-teal-900">{searchResult.status === 'Waiting' ? 'รอคิว' : searchResult.status === 'Calling' ? 'กำลังเรียก' : searchResult.status === 'Completed' ? 'เสร็จสิ้น' : searchResult.status === 'Skipped' ? 'ข้ามคิว' : 'ยกเลิก'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">หมายเลข</p>
                  <p className="text-2xl font-black text-slate-900">{searchResult.queue_number}</p>
                </div>
              </div>
              
              {searchResult.status === 'Waiting' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-teal-100/50 flex flex-col items-center justify-center text-center">
                    <Users className="w-6 h-6 text-slate-400 mb-2" />
                    <p className="text-3xl font-black text-slate-800">{searchResult.people_in_front || 0}</p>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">คิวก่อนหน้า</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-teal-100/50 flex flex-col items-center justify-center text-center">
                    <Clock className="w-6 h-6 text-slate-400 mb-2" />
                    <div className="flex items-baseline gap-1">
                      <p className="text-3xl font-black text-slate-800">{searchResult.estimated_wait_time || 0}</p>
                      <span className="text-sm font-bold text-slate-400">นาที</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">เวลาโดยประมาณ</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      {/* Discrete Footer Entry */}
      <footer className="w-full p-12 flex flex-col items-center gap-6">
        <div className="text-[10px] font-black text-slate-200 tracking-widest">
          © 2026 AI Smart Q Connect
        </div>
      </footer>
    </div>
  );
}
