import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Queue } from '../types';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  BellRing,
  HeartPulse,
  Syringe,
  Droplets,
  ShieldAlert,
  Pill,
  Clock,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  PhoneCall,
  CheckCircle2,
  BookOpen
} from 'lucide-react';

const socket = io();

interface HealthTip {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  badgeBg: string;
  icon: 'heart' | 'syringe' | 'droplets' | 'alert' | 'pill';
  bullets: string[];
  highlightNote: string;
}

const HEALTH_TIPS: HealthTip[] = [
  {
    id: 'ncds',
    category: 'โรคไม่ติดต่อเรื้อรัง (NCDs)',
    title: 'คุมความดัน-เบาหวาน ด้วยหลัก 3อ. 2ส.',
    subtitle: 'ดูแลสุขภาพประจำวัน ลดความเสี่ยงภาวะแทรกซ้อนทางหัวใจและไต',
    accentBg: 'from-teal-950/90 via-slate-900 to-slate-950',
    accentBorder: 'border-teal-500/40',
    accentText: 'text-teal-300',
    badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-400/30',
    icon: 'heart',
    bullets: [
      'อาหาร: ลดหวาน มัน เค็ม เน้นผัก ผลไม้รสไม่หวานจัด และดื่มน้ำสะอาดวันละ 6-8 แก้ว',
      'ออกกำลังกาย: เคลื่อนไหวร่างกายหรือเดินเร็วอย่างน้อยวันละ 30 นาที 5 วันต่อสัปดาห์',
      'อารมณ์: ผ่อนคลายความเครียด นอนหลับพักผ่อนให้เพียงพอ 7-8 ชั่วโมง',
      '2ส.: ไม่สูบบุหรี่ และไม่ดื่มเครื่องดื่มแอลกอฮอล์ รวมถึงรับประทานยาตามแพทย์สั่งอย่างสม่ำเสมอ'
    ],
    highlightNote: 'คำแนะนำ รพ.สต.: ควรมาตรวจวัดความดันและเจาะน้ำตาลปลายนิ้วตามนัดทุกครั้ง'
  },
  {
    id: 'vaccine',
    category: 'มหกรรมสุขภาพ / ฉีดวัคซีน',
    title: 'ฉีดวัคซีนไข้หวัดใหญ่ประจำปี ลดป่วยรุนแรง',
    subtitle: 'เสริมสร้างภูมิคุ้มกัน ป้องกันภาวะปอดอักเสบสำหรับประชาชนกลุ่มเสี่ยง',
    accentBg: 'from-emerald-950/90 via-slate-900 to-slate-950',
    accentBorder: 'border-emerald-500/40',
    accentText: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    icon: 'syringe',
    bullets: [
      'ผู้สูงอายุตั้งแต่ 65 ปีขึ้นไป และผู้ป่วยโรคเรื้อรัง 7 กลุ่มโรค ควรฉีดวัคซีนปีละ 1 ครั้ง',
      'หญิงตั้งครรภ์ (อายุครรภ์ 4 เดือนขึ้นไป) และเด็กเล็ก 6 เดือน - 2 ปี สามารถรับบริการฟรี',
      'หลังฉีดวัคซีน กรุณานั่งพักสังเกตอาการบริเวณจุดรอพักอย่างน้อย 30 นาที',
      'อาจมีอาการปวดบวมบริเวณที่ฉีดหรือมีไข้ต่ำๆ 1-2 วัน สามารถประคบเย็นและดื่มน้ำมากๆ'
    ],
    highlightNote: 'สิทธิพิเศษ: จองคิวฉีดวัคซีนผ่าน LINE ได้ล่วงหน้า ไม่ต้องรอแออัด'
  },
  {
    id: 'dengue',
    category: 'ป้องกันโรคติดต่อในชุมชน',
    title: 'กำจัดยุงลาย ด้วยมาตรการ "3 เก็บ ป้องกัน 3 โรค"',
    subtitle: 'ป้องกันโรคไข้เลือดออก โรคไข้ปวดข้อยุงลาย และโรคติดเชื้อไวรัสซิกา',
    accentBg: 'from-sky-950/90 via-slate-900 to-slate-950',
    accentBorder: 'border-sky-500/40',
    accentText: 'text-sky-300',
    badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
    icon: 'droplets',
    bullets: [
      'เก็บบ้านให้ปลอดโปร่ง ไม่ให้ยุงลายเกาะพักตามมุมมืดหรือกองเสื้อผ้า',
      'เก็บขยะ เศษภาชนะ กะลา ยางรถยนต์เก่า ไม่ให้มีน้ำขังเป็นแหล่งเพาะพันธุ์',
      'เก็บน้ำ ปิดฝาโอ่งหรือถังน้ำให้มิดชิด เปลี่ยนน้ำแจกันทุก 7 วัน หรือใส่ทรายอะเบท',
      'หากมีไข้สูงลอย ปวดศีรษะ ปวดกระบอกตา ห้ามซื้อยาแก้ปวดกลุ่ม NSAIDs ทานเองเด็ดขาด'
    ],
    highlightNote: 'สังเกตอาการ: หากไข้ลดลงแต่มือเท้าเย็นหรือซึมลง ให้รีบพบแพทย์ทันที'
  },
  {
    id: 'stroke',
    category: 'สัญญาณเตือนภาวะฉุกเฉิน',
    title: 'เช็กอาการโรคหลอดเลือดสมอง ด้วยหลัก F.A.S.T.',
    subtitle: 'ทุกนาทีมีค่า ยิ่งถึงโรงพยาบาลเร็ว ยิ่งลดความพิการและเสียชีวิต',
    accentBg: 'from-rose-950/90 via-slate-900 to-slate-950',
    accentBorder: 'border-rose-500/40',
    accentText: 'text-rose-300',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
    icon: 'alert',
    bullets: [
      'F (Face): ใบหน้าชา ปากเบี้ยว มุมปากตกเวลายิ้มหรือพูด',
      'A (Arm): แขนหรือขาข้างใดข้างหนึ่งอ่อนแรง ยกไม่ขึ้น หรือชาครึ่งซีก',
      'S (Speech): พูดไม่ชัด ลิ้นแข็ง นึกคำพูดไม่ออก หรือฟังไม่เข้าใจทันทีทันใด',
      'T (Time): รีบนำส่งโรงพยาบาลหรือโทรสายด่วน 1669 ทันที ภายใน 4 ชั่วโมง 30 นาที'
    ],
    highlightNote: 'สายด่วนฉุกเฉิน: พบอาการแม้เพียงข้อเดียว รีบแจ้งเจ้าหน้าที่หรือโทร 1669 ทันที'
  },
  {
    id: 'medicine',
    category: 'การใช้ยาอย่างปลอดภัย',
    title: 'ใช้ยาอย่างสมเหตุผล เพื่อความปลอดภัยของทุกคน',
    subtitle: 'แนวทางปฏิบัติง่ายๆ ก่อนและหลังรับยาที่ รพ.สต.',
    accentBg: 'from-amber-950/80 via-slate-900 to-slate-950',
    accentBorder: 'border-amber-500/40',
    accentText: 'text-amber-300',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    icon: 'pill',
    bullets: [
      'แจ้งประวัติการแพ้ยา โรคประจำตัว และยาหรือสมุนไพรที่ทานอยู่ให้เจ้าหน้าที่ทราบทุกครั้ง',
      'ยาปฏิชีวนะ (ยาฆ่าเชื้อ) ต้องรับประทานให้ครบตามกำหนด แม้จะรู้สึกหายดีแล้วก็ตาม',
      'ไม่นำยาของผู้อื่นมารับประทาน และไม่แบ่งยาของตนเองให้ผู้อื่นทาน',
      'เก็บยาให้พ้นแสงแดดและความชื้น ตรวจสอบวันหมดอายุก่อนรับประทานเสมอ'
    ],
    highlightNote: 'บริการปรึกษา: หากมีข้อสงสัยเรื่องวิธีใช้ยา สอบถามเภสัชกรหรือพยาบาลได้ทันที'
  }
];

export default function TV() {
  const [activeQueue, setActiveQueue] = useState<Queue | null>(null);
  const [upcomingQueues, setUpcomingQueues] = useState<Queue[]>([]);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [lastAnnouncedText, setLastAnnouncedText] = useState<string>('');
  const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState<boolean>(false);
  const [nowTime, setNowTime] = useState<Date>(new Date());

  const lastSpokenKey = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMutedRef = useRef<boolean>(false);

  useEffect(() => {
    const clockTimer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (isCarouselPaused) return;
    const slideTimer = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % HEALTH_TIPS.length);
    }, 10000);
    return () => clearInterval(slideTimer);
  }, [isCarouselPaused]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const getAudioContext = () => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  };

  // Play pleasant 2-tone hospital Ding-Dong chime via Web Audio API
  const playChime = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const playTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.001, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.25, now + startOffset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration);
      };

      playTone(880, 0, 0.35);      // Ding (A5)
      playTone(659.25, 0.22, 0.55); // Dong (E5)
    } catch {
      // Ignore Web Audio errors
    }
  }, []);

  const formatThaiQueueText = (qNumber: string, serviceName?: string) => {
    const digitMap: Record<string, string> = {
      '0': 'ศูนย์', '1': 'หนึ่ง', '2': 'สอง', '3': 'สาม', '4': 'สี่',
      '5': 'ห้า', '6': 'หก', '7': 'เจ็ด', '8': 'แปด', '9': 'เก้า',
      'A': 'เอ', 'B': 'บี', 'C': 'ซี', 'D': 'ดี', 'E': 'อี', 'F': 'เอฟ', 'M': 'เอ็ม'
    };

    const toThaiReadable = (str: string) =>
      str.toUpperCase().split('').map(c => digitMap[c] || c).join(' ');

    const readableQ = toThaiReadable(qNumber);
    if (serviceName && serviceName.includes('มหกรรม')) {
      return `ขอเชิญหมายเลขคิว ${readableQ} ที่จุดบริการ มหกรรมสุขภาพ ช่องบริการ หนึ่ง ค่ะ`;
    }
    return `ขอเชิญหมายเลขคิว ${readableQ} เชิญที่ห้องตรวจ หนึ่ง ค่ะ`;
  };

  const speakWithBrowserFallback = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 0.9;
      utterance.volume = 1;

      const voices = window.speechSynthesis.getVoices();
      const thVoice = voices.find(v => v.lang.toLowerCase().includes('th'));
      if (thVoice) {
        utterance.voice = thVoice;
      }

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  }, []);

  const announceText = useCallback(async (text: string) => {
    if (isMutedRef.current) return;

    // Stop any previous audio or chime
    if (chimeTimerRef.current) {
      clearTimeout(chimeTimerRef.current);
      chimeTimerRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    setLastAnnouncedText(text);
    setIsSpeaking(true);
    playChime();

    // Delay voice slightly so the hospital Ding-Dong chime finishes cleanly
    chimeTimerRef.current = setTimeout(async () => {
      try {
        const audio = new Audio(`/api/tts?text=${encodeURIComponent(text)}`);
        audio.volume = 1;
        currentAudioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          if (currentAudioRef.current === audio) {
            currentAudioRef.current = null;
          }
        };

        audio.onerror = () => {
          speakWithBrowserFallback(text);
        };

        await audio.play();
        setAudioEnabled(true);
        setAutoplayBlocked(false);
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          setAutoplayBlocked(true);
          setIsSpeaking(false);
        } else {
          speakWithBrowserFallback(text);
        }
      }
    }, 550);
  }, [playChime, speakWithBrowserFallback]);

  const speakQueue = useCallback((queue: Queue) => {
    const text = formatThaiQueueText(queue.queue_number, queue.service_name);
    announceText(text);
  }, [announceText]);

  const handleEnableAndTestSound = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    setIsMuted(false);
    isMutedRef.current = false;
    setAudioEnabled(true);
    setAutoplayBlocked(false);

    if (activeQueue) {
      speakQueue(activeQueue);
    } else {
      announceText('ทดสอบระบบเสียงเรียกคิวภาษาไทย พร้อมให้บริการแล้วค่ะ');
    }
  };

  useEffect(() => {
    const fetchQueues = async (triggerSpeakIfNew: boolean = true) => {
      try {
        const res = await fetch('/api/queues');
        const data: Queue[] = await res.json();

        const calling = data
          .filter(q => q.status === 'Calling' || q.status === 'In-progress')
          .sort((a, b) => (b.called_at || '').localeCompare(a.called_at || ''));

        const latestCalling = calling.length > 0 ? calling[0] : null;
        setActiveQueue(latestCalling);

        const waiting = data.filter(q => q.status === 'Waiting');
        setUpcomingQueues(waiting.slice(0, 3));

        if (triggerSpeakIfNew && latestCalling && latestCalling.status === 'Calling') {
          const spokenKey = `${latestCalling.id}_${latestCalling.called_at || ''}`;
          if (spokenKey !== lastSpokenKey.current) {
            lastSpokenKey.current = spokenKey;
            speakQueue(latestCalling);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchQueues(true);

    const handleQueueUpdated = (updatedQueue?: Queue) => {
      if (updatedQueue && updatedQueue.status === 'Calling') {
        const spokenKey = `${updatedQueue.id}_${updatedQueue.called_at || ''}`;
        if (spokenKey !== lastSpokenKey.current) {
          lastSpokenKey.current = spokenKey;
          setActiveQueue(updatedQueue);
          speakQueue(updatedQueue);
        }
      }
      fetchQueues(false);
    };

    socket.on('queue_updated', handleQueueUpdated);

    return () => {
      socket.off('queue_updated', handleQueueUpdated);
      if (chimeTimerRef.current) clearTimeout(chimeTimerRef.current);
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speakQueue]);

  return (
    <div className="h-screen w-full bg-slate-900 text-white flex overflow-hidden font-sans">
      
      {/* Left Panel: Queues */}
      <div className="w-1/2 flex flex-col p-5 lg:p-8 bg-slate-900 border-r border-slate-800 relative select-none">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-3 z-10 mb-2">
          <Link to="/staff" className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEnableAndTestSound}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                autoplayBlocked || !audioEnabled
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 animate-pulse'
                  : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40'
              }`}
            >
              <BellRing className="w-4 h-4" />
              <span>
                {autoplayBlocked || !audioEnabled
                  ? 'คลิกเพื่อเปิดเสียงเรียกคิว (ภาษาไทย)'
                  : isSpeaking
                    ? 'กำลังประกาศเสียงเรียกคิว...'
                    : 'ทดสอบเสียงเรียกคิว'}
              </span>
            </button>

            <button
              onClick={() => setIsMuted(prev => !prev)}
              title={isMuted ? 'เปิดเสียง' : 'ปิดเสียงชั่วคราว'}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                isMuted ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Active Queue */}
        <div className="flex-1 flex flex-col justify-center min-h-0 py-3">
          <div className="text-center mb-2">
            <h2 className="text-2xl lg:text-3xl text-teal-400 font-bold tracking-wider uppercase">คิวเรียกปัจจุบัน</h2>
            <p className="text-sm text-slate-400 font-medium">รอหน้าห้องตรวจ</p>
          </div>
          <div className={`bg-slate-800 rounded-3xl border-4 p-4 lg:p-8 text-center shadow-2xl relative my-auto max-w-lg mx-auto w-full transition-all duration-300 ${isSpeaking ? 'border-amber-400 shadow-amber-500/20' : 'border-teal-500 shadow-teal-500/20'}`}>
            {activeQueue ? (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                  {activeQueue.service_name && (
                    <div className="inline-block px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-bold mb-2">
                      {activeQueue.service_name}
                    </div>
                  )}
                  <div className="text-6xl md:text-7xl lg:text-[6.5rem] xl:text-[8rem] leading-none font-black tracking-tighter text-white mb-2 lg:mb-4 drop-shadow-lg">
                    {activeQueue.queue_number}
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-1">
                    <span className="text-lg lg:text-xl font-bold text-slate-300">
                      {activeQueue.service_name?.includes('มหกรรม') ? 'จุดบริการช่อง' : 'ห้องตรวจ'}
                    </span>
                    <div className="w-11 h-11 lg:w-14 lg:h-14 bg-teal-500 rounded-2xl flex items-center justify-center text-2xl lg:text-3xl font-black text-white shadow-lg">
                      1
                    </div>
                  </div>
                </div>
            ) : (
                <div className="text-5xl font-medium text-slate-600 py-10">--</div>
            )}
          </div>
          {lastAnnouncedText && (
            <div className="mt-3 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5 px-4 truncate">
              <Volume2 className={`w-3.5 h-3.5 shrink-0 ${isSpeaking ? 'text-amber-400 animate-pulse' : 'text-teal-400'}`} />
              <span className="truncate">{lastAnnouncedText}</span>
            </div>
          )}
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
                <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{q.service_name}</div>
              </div>
            )) : (
              <div className="col-span-3 text-center text-slate-500 py-3 font-bold text-xs">ไม่มีคิวถัดไป</div>
            )}
          </div>
        </div>

      </div>

      {/* Right Panel: Health Media & Education Board */}
      {(() => {
        const activeTip = HEALTH_TIPS[currentTipIndex];
        const renderTipIcon = (iconName: HealthTip['icon']) => {
          const cls = `w-8 h-8 ${activeTip.accentText}`;
          switch (iconName) {
            case 'heart': return <HeartPulse className={cls} />;
            case 'syringe': return <Syringe className={cls} />;
            case 'droplets': return <Droplets className={cls} />;
            case 'alert': return <ShieldAlert className={cls} />;
            case 'pill': return <Pill className={cls} />;
          }
        };

        return (
          <div className={`w-1/2 bg-gradient-to-br ${activeTip.accentBg} flex flex-col p-6 lg:p-8 relative overflow-hidden transition-all duration-700`}>
            {/* Top Bar: Health Channel Title + Live Clock */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg lg:text-xl font-black tracking-tight text-white">ช่องความรู้เพื่อสุขภาพ รพ.สต.</h2>
                  <p className="text-xs text-slate-400 font-medium">สื่อประชาสัมพันธ์และคำแนะนำดูแลสุขภาพระหว่างรอรับบริการ</p>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-white/10 px-4 py-2 rounded-2xl text-right shrink-0">
                <div className="flex items-center justify-end gap-1.5 text-teal-300 font-black text-lg lg:text-xl leading-none">
                  <Clock className="w-4 h-4" />
                  <span>
                    {nowTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  {nowTime.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            {/* Active Health Tip Card */}
            <div className={`flex-1 my-5 bg-slate-900/65 backdrop-blur-md rounded-3xl border-2 ${activeTip.accentBorder} p-6 lg:p-8 flex flex-col justify-between shadow-2xl overflow-hidden`}>
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black border ${activeTip.badgeBg}`}>
                    {activeTip.category}
                  </span>
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                    {renderTipIcon(activeTip.icon)}
                  </div>
                </div>

                <h3 className="text-2xl lg:text-3xl font-black text-white leading-snug tracking-tight mb-2">
                  {activeTip.title}
                </h3>
                <p className={`text-sm lg:text-base font-semibold mb-6 ${activeTip.accentText}`}>
                  {activeTip.subtitle}
                </p>

                <div className="space-y-3">
                  {activeTip.bullets.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-800/60 border border-white/5 rounded-2xl px-4 py-3">
                      <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${activeTip.accentText}`} />
                      <p className="text-sm lg:text-[15px] text-slate-100 font-medium leading-relaxed">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`mt-5 rounded-2xl px-4 py-3 border ${activeTip.badgeBg} text-xs lg:text-sm font-bold`}>
                {activeTip.highlightNote}
              </div>
            </div>

            {/* Slide Controls & Emergency Footer */}
            <div className="flex flex-col gap-3 mt-auto">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {HEALTH_TIPS.map((tip, idx) => (
                    <button
                      key={tip.id}
                      onClick={() => setCurrentTipIndex(idx)}
                      title={tip.title}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === currentTipIndex ? 'w-8 bg-teal-400' : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                      }`}
                    />
                  ))}
                  <span className="text-xs font-bold text-slate-400 ml-2">
                    {currentTipIndex + 1} / {HEALTH_TIPS.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentTipIndex(prev => (prev - 1 + HEALTH_TIPS.length) % HEALTH_TIPS.length)}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="เรื่องก่อนหน้า"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsCarouselPaused(prev => !prev)}
                    className="px-3 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={isCarouselPaused ? 'เล่นอัตโนมัติต่อ' : 'หยุดชั่วคราว'}
                  >
                    {isCarouselPaused ? <Play className="w-3.5 h-3.5 text-teal-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isCarouselPaused ? 'เล่นต่อ' : 'พักหน้าจอ'}</span>
                  </button>
                  <button
                    onClick={() => setCurrentTipIndex(prev => (prev + 1) % HEALTH_TIPS.length)}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="เรื่องถัดไป"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-rose-950/50 border border-rose-500/30 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-xs text-rose-200 font-semibold truncate">
                  หากมีอาการหน้ามืด เวียนศีรษะ หรือเจ็บแน่นหน้าอก กรุณาแจ้งเจ้าหน้าที่จุดคัดกรองทันที
                </span>
                <div className="flex items-center gap-1.5 bg-rose-500 text-white px-3 py-1 rounded-xl text-xs font-black shrink-0">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>ฉุกเฉิน 1669</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
