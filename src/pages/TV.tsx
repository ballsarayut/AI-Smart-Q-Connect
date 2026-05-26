import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Queue } from '../types';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const socket = io();

export default function TV() {
  const [activeQueue, setActiveQueue] = useState<Queue | null>(null);
  const [upcomingQueues, setUpcomingQueues] = useState<Queue[]>([]);
  const lastSpokenQueue = useRef<string | null>(null);

  useEffect(() => {
    const fetchQueues = async () => {
      const res = await fetch('/api/queues');
      const data: Queue[] = await res.json();
      
      const calling = data.filter(q => q.status === 'Calling' || q.status === 'In-progress');
      // Show the most recently called one (usually we just want up to 1 active on TV for simplicity, or latest)
      const latestCalling = calling.length > 0 ? calling[calling.length - 1] : null;
      setActiveQueue(latestCalling);

      const waiting = data.filter(q => q.status === 'Waiting');
      setUpcomingQueues(waiting.slice(0, 3)); // next 3

      if (latestCalling && latestCalling.id !== lastSpokenQueue.current) {
        speakQueue(latestCalling.queue_number, 1); // Mock room 1
        lastSpokenQueue.current = latestCalling.id;
      }
    };

    fetchQueues();

    socket.on('queue_updated', () => {
      fetchQueues();
    });

    return () => {
      socket.off('queue_updated');
    };
  }, []);

  const speakQueue = (qNumber: string, room: number) => {
    if (!('speechSynthesis' in window)) return;
    
    // Map standard digits and characters to Thai words
    const digitMap: {[key: string]: string} = {
      '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
      '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า',
      'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี'
    };

    const toThaiReadable = (str: string) => {
      return str.toUpperCase().split('').map(c => digitMap[c] || c).join(' ');
    };

    const readableQ = toThaiReadable(qNumber);
    const readableRoom = toThaiReadable(room.toString());

    // Construct the full Thai text (No digits passed to avoid browser defaulting to English)
    const text = `คิว ${readableQ} เชิญที่ห้องตรวจ ${readableRoom} ค่ะ`;
    
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 0.9;

      const voices = window.speechSynthesis.getVoices();
      // Look for Thai voices specifically
      const thVoice = voices.find(v => v.lang.includes('th') || v.lang.includes('TH'));
      
      if (thVoice) {
        utterance.voice = thVoice;
      }
      
      window.speechSynthesis.cancel(); 
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = speak;
    } else {
      speak();
    }
  };

  return (
    <div className="h-screen w-full bg-slate-900 text-white flex overflow-hidden font-sans">
      
      {/* Left Panel: Queues */}
      <div className="w-1/2 flex flex-col p-5 lg:p-8 bg-slate-900 border-r border-slate-800 relative select-none">
        <Link to="/staff" className="absolute top-5 left-5 w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        {/* Active Queue */}
        <div className="flex-1 flex flex-col justify-center min-h-0 py-4">
          <div className="text-center mb-2">
            <h2 className="text-2xl lg:text-3xl text-teal-400 font-bold tracking-wider uppercase">คิวเรียกปัจจุบัน</h2>
            <p className="text-sm text-slate-400 font-medium">รอหน้าห้องตรวจ</p>
          </div>
          <div className="bg-slate-800 rounded-3xl border-4 border-teal-500 p-4 lg:p-8 text-center shadow-2xl shadow-teal-500/20 relative my-auto max-w-lg mx-auto w-full">
            {activeQueue ? (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="text-6xl md:text-7xl lg:text-[6.5rem] xl:text-[8rem] leading-none font-black tracking-tighter text-white mb-2 lg:mb-4 drop-shadow-lg">
                    {activeQueue.queue_number}
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-1">
                    <span className="text-lg lg:text-xl font-bold text-slate-300">ห้องตรวจ</span>
                    <div className="w-11 h-11 lg:w-14 lg:h-14 bg-teal-500 rounded-2xl flex items-center justify-center text-2xl lg:text-3xl font-black text-white shadow-lg">
                      1
                    </div>
                  </div>
                </div>
            ) : (
                <div className="text-5xl font-medium text-slate-600 py-10">--</div>
            )}
          </div>
        </div>

        {/* Next Queues */}
        <div className="bg-slate-800/80 rounded-3xl border-2 border-slate-700 p-4 lg:p-5 mt-auto">
          <h3 className="text-lg lg:text-xl text-teal-300 font-bold mb-3 flex items-center gap-2 uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
            คิวถัดไป (โปรดเตรียมตัว)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {upcomingQueues.length > 0 ? upcomingQueues.map((q, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-3 text-center border-2 border-slate-600 shadow-inner">
                <div className="text-2xl lg:text-3xl font-black text-white tracking-tight">{q.queue_number}</div>
              </div>
            )) : (
              <div className="col-span-3 text-center text-slate-500 py-3 font-bold text-xs">ไม่มีคิวถัดไป</div>
            )}
          </div>
        </div>

        {/* Request Audio Context Button (Browsers block autoplay) */}
        <button 
          onClick={() => {
            const u = new SpeechSynthesisUtterance('');
            speechSynthesis.speak(u);
          }} 
          className="mt-4 opacity-35 hover:opacity-100 text-[10px] text-slate-500 flex justify-center uppercase tracking-widest transition-opacity cursor-pointer"
        >
          คลิกเพื่อเปิดเสียงแจ้งเตือน (กรณีเสียงไม่ดัง)
        </button>

      </div>

      {/* Right Panel: Health Media */}
      <div className="w-1/2 bg-black relative">
        {/* Placeholder for YouTube / Health Media */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
             <div className="w-32 h-32 rounded-full border-4 border-slate-800 border-t-teal-500 animate-spin mb-8" />
             <p className="text-2xl font-bold uppercase tracking-widest text-slate-500">ช่องความรู้เพื่อสุขภาพ</p>
             <p className="mt-2 text-slate-600 font-medium">วิดีโอให้ความรู้ด้านสุขภาพระหว่างรอรับบริการ</p>
        </div>
      </div>

    </div>
  );
}
