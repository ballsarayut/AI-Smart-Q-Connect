import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Queue } from '../types';
import { Link } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX, BellRing } from 'lucide-react';

const socket = io();

export default function TV() {
  const [activeQueue, setActiveQueue] = useState<Queue | null>(null);
  const [upcomingQueues, setUpcomingQueues] = useState<Queue[]>([]);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [lastAnnouncedText, setLastAnnouncedText] = useState<string>('');

  const lastSpokenKey = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const chimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMutedRef = useRef<boolean>(false);

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
