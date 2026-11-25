import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  MousePointerClick,
  UserCheck,
} from 'lucide-react';

const SPOTLIGHT_STEPS = [
  {
    step: 1,
    title: 'กดเมนู "จองคิวออนไลน์"',
    desc: 'เข้าหน้าแรก แล้วแตะปุ่มจองคิวออนไลน์',
    icon: MousePointerClick,
  },
  {
    step: 2,
    title: 'กรอกข้อมูลผู้รับบริการ',
    desc: 'ใส่เลขบัตร ปชช. ชื่อ เบอร์โทร หรือใช้ผู้ช่วยเสียง',
    icon: UserCheck,
  },
  {
    step: 3,
    title: 'เลือกบริการและช่วงเวลา',
    desc: 'เลือกบริการ พร้อมวันและรอบเวลาที่สะดวก',
    icon: CalendarClock,
  },
  {
    step: 4,
    title: 'ยืนยันและรับบัตรคิวทันที',
    desc: 'รับเลขคิว แจ้งเตือน LINE และประเมินหลังตรวจ',
    icon: BellRing,
  },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pauseUntil, setPauseUntil] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (Date.now() < pauseUntil) return;
      setActiveIndex((prev) => (prev + 1) % SPOTLIGHT_STEPS.length);
    }, 2400);

    return () => window.clearInterval(timer);
  }, [pauseUntil]);

  const handleSelectStep = (idx: number) => {
    setActiveIndex(idx);
    setPauseUntil(Date.now() + 5000);
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8FAFC] text-slate-900 font-sans flex flex-col items-center justify-center px-5 py-4">
      <main className="w-full max-w-md flex flex-col items-center">
        {/* App Logo & Name — matching Home.tsx */}
        <div className="flex flex-col items-center text-center mb-4 sm:mb-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-900 rounded-2xl flex items-center justify-center relative shadow-md mb-2.5 sm:mb-3">
            <span className="text-white font-black text-3xl sm:text-4xl tracking-tighter relative z-10">
              Q
            </span>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-teal-500 rounded-full border-[2.5px] border-[#F8FAFC]" />
          </div>

          <p className="text-xs sm:text-sm font-semibold text-teal-600 tracking-wide mb-0.5">
            Welcome To
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-tight">
            <span className="text-teal-500">AI</span> Smart{' '}
            <span className="text-teal-500">Q</span> Connect
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">
            จองคิวล่วงหน้าจากที่บ้าน ลดเวลารอคอยที่ รพ.สต.
          </p>
        </div>

        {/* Auto-Step Spotlight Guide — Compact Single-Viewport Fit */}
        <section
          aria-label="ขั้นตอนการจองคิว"
          className="w-full space-y-2 mb-5 sm:mb-6"
        >
          {SPOTLIGHT_STEPS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIndex;

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => handleSelectStep(idx)}
                className={`w-full text-left rounded-xl px-3.5 py-2.5 border transition-all duration-300 flex items-center gap-3 cursor-pointer ${
                  isActive
                    ? 'bg-white border-teal-500 shadow-sm scale-[1.01]'
                    : 'bg-white/75 border-slate-200 opacity-75 hover:opacity-100 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300 ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className={`text-[13px] sm:text-sm font-bold leading-tight truncate transition-colors ${
                        isActive ? 'text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {item.title}
                    </h2>
                    <span
                      className={`text-[11px] font-mono tabular-nums shrink-0 transition-colors ${
                        isActive ? 'text-teal-600 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      0{item.step}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] sm:text-xs leading-snug mt-0.5 truncate transition-colors ${
                      isActive ? 'text-slate-600' : 'text-slate-500'
                    }`}
                  >
                    {item.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </section>

        {/* Primary CTA Button -> Redirects to Home (/home) */}
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="min-h-[46px] px-9 py-2.5 rounded-full text-sm sm:text-base font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
        >
          <span>เข้าสู่หน้าแรก</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </main>
    </div>
  );
}
