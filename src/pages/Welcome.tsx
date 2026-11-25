import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

const SHORT_STEPS = [
  {
    step: 1,
    title: '1. กดที่เมนู "จองคิวออนไลน์"',
    desc: 'เข้าสู่หน้าแรก แล้วเลือกเมนู "จองคิวออนไลน์" เพื่อเริ่มจองคิว',
  },
  {
    step: 2,
    title: '2. กรอกข้อมูลผู้รับบริการ',
    desc: 'ระบุเลขบัตรประชาชน ชื่อ-นามสกุล เบอร์โทร (หรือใช้ผู้ช่วยเสียง)',
  },
  {
    step: 3,
    title: '3. เลือกบริการและช่วงเวลา',
    desc: 'เลือกบริการที่ต้องการ พร้อมเลือกวันและรอบเวลาที่สะดวก',
  },
  {
    step: 4,
    title: '4. ยืนยันและรับบัตรคิวทันที',
    desc: 'รับหมายเลขคิว แจ้งเตือนผ่าน LINE และประเมินผลหลังรับบริการ',
  },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const current = SHORT_STEPS[activeStep];
  const isAllDone = completedSteps.includes(4) || activeStep === SHORT_STEPS.length - 1;

  const handleStepAction = () => {
    const stepNum = current.step;
    if (!completedSteps.includes(stepNum)) {
      setCompletedSteps((prev) => [...prev, stepNum]);
    }
    if (activeStep < SHORT_STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col items-center justify-center px-6 py-10">
      <main className="w-full max-w-sm flex flex-col items-center text-center">
        {/* App Logo & Name — matching Home.tsx */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center relative shadow-md mb-5">
            <span className="text-white font-black text-5xl tracking-tighter relative z-10">
              Q
            </span>
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-teal-500 rounded-full border-[3px] border-[#F8FAFC]" />
          </div>

          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight">
            <span className="text-teal-500">AI</span> Smart{' '}
            <span className="text-teal-500">Q</span> Connect
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-2 font-medium">
            จองคิวล่วงหน้าจากที่บ้าน ลดเวลารอคอยที่ รพ.สต.
          </p>
        </div>

        {/* Concise Interactive Step-by-Step Guide */}
        <section
          aria-label="ขั้นตอนการจองคิว"
          className="w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-8"
        >
          {/* Step Selector Dots / Numbers */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {SHORT_STEPS.map((item, idx) => {
              const isActive = idx === activeStep;
              const isDone = completedSteps.includes(item.step);
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  aria-label={`ดูขั้นตอนที่ ${item.step}`}
                  className={`min-h-[36px] min-w-[36px] rounded-full text-xs font-bold tabular-nums transition-all flex items-center justify-center cursor-pointer ${
                    isActive
                      ? 'bg-teal-600 text-white px-3.5'
                      : isDone
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {isDone && !isActive ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    item.step
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Step Short Copy */}
          <div className="min-h-[76px] flex flex-col justify-center mb-5">
            <h2 className="text-base font-bold text-slate-900 mb-1.5">
              {current.title}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {current.desc}
            </p>
          </div>

          {/* Interactive Try-Next Controls */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
              className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              ก่อนหน้า
            </button>

            {activeStep < SHORT_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleStepAction}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-900 hover:bg-teal-600 text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
              >
                ลองกดขั้นถัดไป
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-xs font-semibold text-teal-600 inline-flex items-center gap-1 px-2">
                <CheckCircle2 className="w-4 h-4" />
                ครบ 4 ขั้นตอนแล้ว
              </span>
            )}
          </div>
        </section>

        {/* Primary CTA Button -> Redirects to Home (/home) */}
        <button
          type="button"
          onClick={() => navigate('/home')}
          className={`min-h-[52px] px-12 py-3.5 rounded-full text-base font-bold text-white shadow-md active:scale-95 transition-all inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            isAllDone
              ? 'bg-teal-600 hover:bg-teal-700'
              : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          <span>จองคิว</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </main>
    </div>
  );
}
