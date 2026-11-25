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
    <div className="min-h-[100dvh] w-full bg-[#F8FAFC] text-slate-900 font-sans flex flex-col justify-between px-4 sm:px-8 lg:px-12 py-3 sm:py-6 lg:py-8 relative overflow-x-hidden">
      {/* Subtle architectural background depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.08),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(15,23,42,0.04),transparent_55%)]"
      />

      {/* Top Context Strip */}
      <header className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-center sm:justify-end pb-2.5 sm:pb-3.5 border-b border-slate-200/80 shrink-0">
        <p className="text-[11px] sm:text-xs font-medium text-slate-500 whitespace-nowrap truncate">
          รพ.สต.อัจฉริยะ <span aria-hidden="true">·</span> ระบบจองคิวออนไลน์
        </p>
      </header>

      {/* Main Content Stage — Fills Viewport Height & Width */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto flex flex-col justify-evenly lg:grid lg:grid-cols-12 lg:gap-12 lg:items-center py-3 sm:py-6">
        {/* Left / Top: App Identity, Welcome Copy & Primary CTA */}
        <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-900 rounded-2xl sm:rounded-3xl flex items-center justify-center relative shadow-md mb-2.5 sm:mb-5">
            <span className="text-white font-black text-3xl sm:text-5xl tracking-tighter relative z-10">
              Q
            </span>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-teal-500 rounded-full border-[2.5px] border-[#F8FAFC]" />
          </div>

          <p className="text-xs sm:text-base font-semibold text-teal-600 tracking-wide mb-1">
            Welcome To
          </p>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.1] text-balance">
            <span className="text-teal-500">AI</span> Smart{' '}
            <span className="text-teal-500">Q</span> Connect
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-slate-600 mt-1.5 sm:mt-3 font-medium leading-relaxed max-w-md">
            จองคิวล่วงหน้าจากที่บ้าน ลดเวลารอคอยที่ รพ.สต.
          </p>

          <p className="hidden sm:block text-xs text-slate-500 mt-3 leading-relaxed">
            จองคิวล่วงหน้าได้สะดวก <span aria-hidden="true">·</span> แจ้งเตือนสถานะผ่าน LINE <span aria-hidden="true">·</span> ประเมินความพึงพอใจหลังรับบริการ
          </p>

          {/* Desktop Primary CTA */}
          <div className="hidden lg:block mt-7">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="min-h-[52px] px-10 py-3.5 rounded-full text-base font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md active:scale-95 transition-all inline-flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>เข้าสู่หน้าแรก</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right / Middle: Auto-Step Spotlight Guide */}
        <section
          aria-label="ขั้นตอนการจองคิว"
          className="lg:col-span-7 w-full flex flex-col gap-2 sm:gap-3.5 my-2 lg:my-0"
        >
          <div className="flex items-center justify-between px-1 mb-0.5">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
              ขั้นตอนการรับบริการใน 4 ขั้นตอน
            </span>
            <span className="text-[11px] sm:text-xs font-mono tabular-nums text-teal-600 font-semibold">
              0{activeIndex + 1} / 0{SPOTLIGHT_STEPS.length}
            </span>
          </div>

          {SPOTLIGHT_STEPS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === activeIndex;

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => handleSelectStep(idx)}
                className={`w-full text-left rounded-2xl px-3.5 py-2.5 sm:px-5 sm:py-4 border transition-all duration-300 flex items-center gap-3.5 sm:gap-4 cursor-pointer ${
                  isActive
                    ? 'bg-white border-teal-500 shadow-sm scale-[1.01]'
                    : 'bg-white/75 border-slate-200 opacity-80 hover:opacity-100 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                    isActive
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h2
                      className={`text-[13px] sm:text-base font-bold leading-tight truncate transition-colors ${
                        isActive ? 'text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {item.title}
                    </h2>
                    <span
                      className={`text-[11px] sm:text-xs font-mono tabular-nums shrink-0 transition-colors ${
                        isActive ? 'text-teal-600 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      0{item.step}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] sm:text-sm leading-snug mt-0.5 sm:mt-1 truncate transition-colors ${
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

        {/* Mobile / Tablet Primary CTA */}
        <div className="lg:hidden w-full flex justify-center pt-1">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="w-full sm:w-auto min-h-[48px] px-10 py-3 rounded-full text-sm sm:text-base font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>เข้าสู่หน้าแรก</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* Bottom Quiet Footer Anchor */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto pt-2.5 sm:pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 shrink-0">
        <span>ระบบนัดหมายและบริหารจัดการคิวผู้ป่วยออนไลน์</span>
        <span className="hidden sm:inline">
          รองรับการตรวจสอบคิวเรียลไทม์ <span aria-hidden="true">·</span> แจ้งเตือนผ่าน LINE Official Account
        </span>
      </footer>
    </div>
  );
}
