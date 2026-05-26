import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MessageSquare, X, Send, BellRing, Settings, Check, HelpCircle, Shield, AlertCircle } from 'lucide-react';

const socket = io();

export default function LineSimulator() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [hasNew, setHasNew] = useState(false);
  
  // LINE Messaging API States
  const [channelAccessToken, setChannelAccessToken] = useState('');
  const [adminUid, setAdminUid] = useState('');
  const [enableBroadcast, setEnableBroadcast] = useState('false');
  
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sound generator
  const playChime = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (err) {
      console.log('Chime sound blocked or unsupported');
    }
  };

  useEffect(() => {
    // 1. Load existing messages (LINE logs)
    fetch('/api/line-logs')
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.reverse());
      })
      .catch((err) => console.log('Error loading line logs', err));

    // 2. Load system settings
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        setChannelAccessToken(data.line_channel_access_token || '');
        setAdminUid(data.line_admin_uid || '');
        setEnableBroadcast(data.line_enable_broadcast || 'false');
      })
      .catch((err) => console.log('Error loading settings', err));

    // 3. Listen to socket.io events
    const handleLineNotification = (newLog: any) => {
      setMessages((prev) => [...prev, newLog]);
      setHasNew(true);
      playChime();
    };

    socket.on('line_notification', handleLineNotification);

    return () => {
      socket.off('line_notification', handleLineNotification);
    };
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          line_channel_access_token: channelAccessToken,
          line_admin_uid: adminUid,
          line_enable_broadcast: enableBroadcast
        }),
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

  return (
    <>
      {/* Floating Messenger Icon */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setHasNew(false);
        }}
        id="line-simulator-toggle"
        className="fixed bottom-6 right-6 z-50 bg-[#06C755] hover:bg-[#05b04b] text-white p-4 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all active:scale-95 group border-2 border-white/20"
      >
        <div className="relative">
          <MessageSquare className="w-6 h-6 stroke-[2.5]" />
          {hasNew && (
            <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-455 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
            </span>
          )}
        </div>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold text-xs ml-0 group-hover:ml-2 whitespace-nowrap">
          ดูจำลองแชท LINE Bot
        </span>
      </button>

      {/* LINE Screen Panel Drawer */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[360px] h-[540px] bg-[#899ca8] border border-slate-700/20 rounded-[28px] overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-300">
          
          {/* Mock Smartphone Header Bar (Green LINE Brand Color) */}
          <div className="bg-[#06C755] text-white px-5 py-3.5 flex items-center justify-between shadow-md select-none">
            <div className="flex items-center gap-2.5">
              {/* LINE Rounded Vector Icon */}
              <div className="w-8 h-8 rounded-xl bg-white text-[#06C755] font-black flex items-center justify-center text-xs shadow-inner">
                LINE
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-tight">รพ.สต. บอทอัจฉริยะ (Messaging API)</h3>
                <span className="text-[10px] text-emerald-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  ระบบแจ้งเตือนแชทไลน์อัตโนมัติ
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="ตั้งค่า LINE Messaging API ของจริง"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inner Content Area */}
          <div className="flex-1 relative flex flex-col overflow-hidden">
            {showSettings ? (
              /* REAL LINE MESSAGING API CONNECT PANEL */
              <div className="absolute inset-0 bg-slate-900 text-slate-100 p-5 flex flex-col overflow-y-auto font-sans tracking-tight">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-xs text-emerald-400">อัปเกรดเป็น LINE Messaging API 📱</h4>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  เนื่องจาก LINE ได้<b>ยกเลิกบริการ LINE Notify แล้ว</b> แนะนำให้เปิดใช้งานผ่าน <b>Messaging API</b> เพื่อความเสถียรและสามารถแจ้งเตือนส่วนตัวหรือตั้งเสียงในกลุ่มได้ค่ะ
                </p>

                <div className="bg-slate-850 rounded-lg p-3 border border-slate-800 space-y-1 text-[10px] text-slate-350 leading-relaxed mb-4">
                  <p className="font-semibold text-white">ขั้นตอนเชื่อมต่อ:</p>
                  <ol className="list-decimal pl-3 space-y-0.5">
                    <li>ไปที่เว็บ <a href="https://developers.line.biz" target="_blank" className="text-emerald-400 hover:underline inline-block font-bold">developers.line.biz</a></li>
                    <li>สร้าง <b>Channel Access Token (Long-lived)</b> ในแท็บ Messaging API</li>
                    <li>คัดลอก Token และนำมาใส่ที่กล่องด้านล่างนี้ได้เลยค่ะ!</li>
                  </ol>
                </div>

                <form onSubmit={saveSettings} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      Messaging API Channel Access Token
                    </label>
                    <textarea
                      rows={2}
                      value={channelAccessToken}
                      onChange={(e) => setChannelAccessToken(e.target.value)}
                      placeholder="วาง Channel Access Token ของคุณที่นี่..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono outline-none focus:border-emerald-500 placeholder:text-slate-600 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      Admin User ID ของจริงเพื่อใช้ทดสอบ (ถ้าระบุไว้ จะส่งสำเนาหาคุณด้วย)
                    </label>
                    <input
                      type="text"
                      value={adminUid}
                      onChange={(e) => setAdminUid(e.target.value)}
                      placeholder="เช่น U1234567890abcdef1234567890abcdef"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-xs font-mono outline-none focus:border-emerald-500 placeholder:text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
                      โหมดบรอดแคสต์ (Broadcast)
                    </label>
                    <select
                      value={enableBroadcast}
                      onChange={(e) => setEnableBroadcast(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs outline-none focus:border-emerald-500 text-slate-200 font-medium"
                    >
                      <option value="false">ปิดไบรอันแคสต์ (ส่งเฉพาะคนที่ระบุ LINE UID เท่านั้น)</option>
                      <option value="true">เปิดไบรอันแคสต์ (ส่งกระจายหาทุกคนที่ติดตามบอทเมื่อไม่มี UID)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-[#06C755] hover:bg-[#05b04b] text-slate-950 font-bold py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSaving ? 'กำลังบันทึก...' : saveSuccess ? (
                      <span className="flex items-center gap-1 text-slate-950">
                        <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" /> ทำการเชื่อมต่อเรียบร้อย!
                      </span>
                    ) : 'อัปเดตและบันทึกการตั้งค่า'}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="mt-4 text-center text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
                >
                  ย้อนกลับไปดูแชทบ็อทจำลอง
                </button>
              </div>
            ) : (
              /* Simulated Chat Log */
              <div className="flex-1 flex flex-col bg-[#899ca8]">
                {/* Simulated LINE Top Notice Info */}
                <div className="bg-slate-950/10 text-slate-100 text-[10px] px-4 py-2 flex items-center gap-2 border-b border-white/5 font-medium leading-normal">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0 text-[#06C755]" />
                  <span>ระบบแชทจำลอง LINE Messaging API (ส่งข้อความ Push และคิวของคุณ)</span>
                </div>

                {/* Messages Stream list */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-100/50 p-6">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-3">
                        <BellRing className="w-6 h-6 text-white/40" />
                      </div>
                      <p className="text-xs font-bold font-sans">ยังไม่มีการแจ้งเตือนในแชท</p>
                      <p className="text-[10px] mt-1 text-slate-100/40">ลองทำการจองคิวใหม่หรือเปลี่ยนสถานะคิวของผู้ป่วยผ่านระบบเพื่อทดสอบการรับข้อความ LINE แจ้งเตือน!</p>
                    </div>
                  ) : (
                    messages.map((msg, index) => {
                      const time = new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={msg.id || index} className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {/* Bot Rounded Icon Avatar */}
                          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm overflow-hidden select-none">
                            LINE
                          </div>
                          
                          <div className="flex flex-col items-start max-w-[70%]">
                            {/* Bot Name */}
                            <span className="text-[10px] text-slate-100/80 font-bold mb-1 pl-1 font-sans">LINE รพ.สต.อัจฉริยะ</span>
                            
                            {/* Speech Bubble */}
                            <div className="bg-white text-slate-900 border border-slate-300/30 px-3.5 py-2.5 rounded-[18px] rounded-tl-none text-xs leading-relaxed whitespace-pre-wrap font-medium shadow-sm relative font-sans">
                              <span className="absolute -left-1.5 top-0 w-2.5 h-2.5 bg-white border-l-2 border-white transform rotate-45" />
                              {msg.message}
                            </div>
                            
                            {/* Time stamp */}
                            <span className="text-[9px] text-white/50 font-bold mt-1.5 pl-1.5">{time} น.</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Smartphone Bottom Deco Bar */}
          <div className="h-4 bg-[#06C755] border-t border-emerald-500/20 shrink-0 select-none flex items-center justify-center">
            <div className="w-24 h-1 bg-white/35 rounded-full" />
          </div>
        </div>
      )}
    </>
  );
}
