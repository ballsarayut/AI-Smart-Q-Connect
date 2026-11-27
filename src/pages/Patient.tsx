import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Queue, Service } from '../types';
import { Clock, Navigation, CheckCircle2, BellRing, ArrowLeft, Users, MapPin, ExternalLink, Star, Mic, MicOff } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import LineSimulator from '../components/LineSimulator';
import liff from '@line/liff';
import { initLiff, getSafeLiffUser, sanitizeLiffId } from '../lib/liffHelper';
import toast from 'react-hot-toast';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const socket = io();

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

function TravelTimeDisplay({ hospitalLat, hospitalLng, mapLink }: { hospitalLat: number, hospitalLng: number, mapLink?: string }) {
  const routesLib = useMapsLibrary('routes');
  const [travelTime, setTravelTime] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkLocation = () => {
    if (!navigator.geolocation) {
      setError('เบราว์เซอร์ไม่รองรับการเข้าถึงตำแหน่งที่ตั้ง');
      return;
    }

    setTracking(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // If Google Maps Route API is available, compute the active road route
        if (API_KEY && routesLib) {
          routesLib.Route.computeRoutes({
            origin: userLoc,
            destination: { lat: hospitalLat, lng: hospitalLng },
            travelMode: 'DRIVING',
            fields: ['durationMillis', 'distanceMeters'],
          }).then(({ routes }) => {
            if (routes?.[0]) {
              if (routes[0].durationMillis) {
                const mins = Math.ceil(parseInt(routes[0].durationMillis as any) / 60000);
                setTravelTime(`${mins} นาที`);
              }
              if (routes[0].distanceMeters) {
                const km = (routes[0].distanceMeters / 1000).toFixed(1);
                setDistance(`${km} กม.`);
              }
              setIsFallback(false);
              setError(null);
            } else {
              // Failover to client-side geodesic math if Route service found nothing
              calculateLocalEstimation(userLoc);
            }
            setTracking(false);
          }).catch(err => {
            console.error('Routes estimation error, falling back:', err);
            calculateLocalEstimation(userLoc);
            setTracking(false);
          });
        } else {
          // If no GCP keys or maps routes are configured yet, calculate local geodesic path
          calculateLocalEstimation(userLoc);
          setTracking(false);
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('กรุณาอนุญาตการเข้าถึงข้อมูลตำแหน่งเพื่อเช็คเวลาเดินทางไปยัง รพ.สต.');
        setTracking(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const calculateLocalEstimation = (userLoc: { lat: number, lng: number }) => {
    try {
      const distKm = getHaversineDistance(userLoc.lat, userLoc.lng, hospitalLat, hospitalLng);
      // Driving routes are typically ~1.3 times the straight line distance
      const adjustedDist = distKm * 1.3;
      // Assume speed is ~40 km/h (1.5 minutes per km)
      // If the distance is extremely short (e.g., under 500m), set standard walk/drive time
      const estimatedMins = Math.max(1, Math.ceil(adjustedDist * 1.5));
      
      setDistance(`${distKm.toFixed(1)} กม.`);
      setTravelTime(`${estimatedMins} นาที`);
      setIsFallback(true);
      setError(null);
    } catch (e) {
      setError('ไม่สามารถประมาณระยะทางได้ในขณะนี้');
    }
  };

  // Automatically check on load so patients see it immediately
  useEffect(() => {
    checkLocation();
  }, [routesLib, hospitalLat, hospitalLng]);

  const openInApp = () => {
    if (mapLink) {
      window.open(mapLink, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${hospitalLat},${hospitalLng}`, '_blank');
    }
  };

  return (
    <div className="bg-white border-2 border-teal-50 rounded-2xl p-5 mt-6 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50/20 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
          <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
            <MapPin className="w-4 h-4 text-emerald-600 animate-bounce" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900 leading-tight">เช็คระยะเวลาเดินทางไปยัง รพ.สต.</span>
            <span className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">คำนวณจากพิกัดตำแหน่งของคุณ ณ ปัจจุบัน</span>
          </div>
        </h3>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={checkLocation}
            disabled={tracking}
            className="text-[11px] font-black bg-slate-50 border-2 border-slate-100 px-3 py-2 rounded-xl hover:bg-slate-100 active:scale-95 transition-all text-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {tracking ? (
              <>
                <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                กำลังคำนวณ...
              </>
            ) : 'คำนวณใหม่'}
          </button>
          <button 
            type="button"
            onClick={openInApp}
            className="text-[11px] font-black bg-teal-600 hover:bg-teal-700 text-white border-2 border-teal-600 px-3 py-2 rounded-xl active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 fill-white" />
            นำทางแผนที่
          </button>
        </div>
      </div>

      {travelTime && (
        <div className="bg-teal-50/50 border-2 border-teal-100 text-teal-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in zoom-in-95 fill-mode-both duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center font-black text-teal-600 text-lg shadow-sm">
              🚗
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-teal-600/70 font-bold leading-tight uppercase tracking-wider">ประมาณการเดินทางโดยรถ</span>
              <span className="text-xl font-black text-teal-900 mt-0.5">{travelTime} {distance ? `(${distance})` : ''}</span>
            </div>
          </div>
          <div className="text-[10px] text-teal-700/80 font-medium">
            {isFallback ? (
              <span className="bg-white/80 border border-teal-100 px-2 py-1 rounded-lg">คำนวณด้วยพิกัดทางตรง (ออฟไลน์)</span>
            ) : (
              <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg font-bold">เส้นทางขับรถจริง (Google Maps)</span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 text-amber-800 border-2 border-amber-100 rounded-xl p-3 flex items-start gap-2.5 mt-2">
          <span className="text-base shrink-0">📍</span>
          <div className="flex flex-col">
            <p className="text-xs font-bold leading-normal">{error}</p>
            <p className="text-[10px] text-amber-700/80 font-medium mt-0.5">ท่านสามารถกดปุ่ม "นำทางแผนที่" ด้านบนเพื่อดูเส้นทางผ่านแอปได้ทันทีค่ะ</p>
          </div>
        </div>
      )}
      
      {!travelTime && !error && !tracking && (
        <p className="text-[11px] text-slate-400 font-medium">ระบบจะของพิกัดตำแหน่งปัจจุบันของท่านโดยอัตโนมัติเพื่อวิเคราะห์เวลาและระยะทางไปยัง รพ.สต. ให้เหมาะสม</p>
      )}
    </div>
  );
}

export default function Patient() {
  const [services, setServices] = useState<Service[]>([]);
  const [myQueue, setMyQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleRate = async (score: number) => {
    if (!myQueue || score < 1 || score > 5) {
      toast.error('กรุณาเลือกคะแนนประเมิน 1-5 ดาว');
      return;
    }
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/queues/${myQueue.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score, comment: reviewComment })
      });
      const updated = await res.json();
      if (res.ok) {
        setMyQueue(updated);
        toast.success('บันทึกคะแนนประเมินความพึงพอใจเรียบร้อยแล้ว');
      } else {
        toast.error(updated.error || 'ไม่สามารถส่งผลประเมินได้');
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการส่งผลประเมิน');
    } finally {
      setSubmittingRating(false);
    }
  };

  // Active operating hours from settings
  const [openTime, setOpenTime] = useState('08:30');
  const [closeTime, setCloseTime] = useState('16:30');
  const [hospitalLat, setHospitalLat] = useState<number>(13.7563);
  const [hospitalLng, setHospitalLng] = useState<number>(100.5018);
  const [mapLink, setMapLink] = useState<string>('');
  const [campaignTitle, setCampaignTitle] = useState('มหกรรมสุขภาพ / ฉีดวัคซีน');
  const [campaignDesc, setCampaignDesc] = useState('เพื่อความสะดวกรวดเร็วและลดความแออัด ท่านสามารถจองคิวเข้ารับบริการล่วงหน้าได้สูงสุด 10 วัน โปรดเลือกวันและรอบเวลาที่คุณสะดวก');
  const [campaignStartDate, setCampaignStartDate] = useState('');
  const [campaignEndDate, setCampaignEndDate] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]);

  useEffect(() => {
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const effectiveMin = campaignStartDate || today;
    // Snap to valid range if outside
    if (appointmentDate < effectiveMin) {
      setAppointmentDate(effectiveMin);
    } else if (campaignEndDate && appointmentDate > campaignEndDate) {
      setAppointmentDate(campaignEndDate);
    }
  }, [campaignStartDate, campaignEndDate, appointmentDate]);
  
  const [liffInitialized, setLiffInitialized] = useState(false);
  const [liffConfigured, setLiffConfigured] = useState(false);
  const [liffIdValue, setLiffIdValue] = useState('');
  const [liffProfileName, setLiffProfileName] = useState(() => localStorage.getItem('smartq_line_name') || '');
  const [liffError, setLiffError] = useState('');

  // Form state
  const searchParams = new URLSearchParams(window.location.search);
  const initialService = searchParams.get('service') || '';
  const [citizenId, setCitizenId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState(initialService);
  const [role, setRole] = useState('patient');
  const [lineUid, setLineUid] = useState(() => localStorage.getItem('smartq_line_uid') || '');
  const [preferredTime, setPreferredTime] = useState('');
  const [slotId, setSlotId] = useState<number | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSlotId(null);
    setPreferredTime('');
    const query = new URLSearchParams();
    if (serviceId) query.append('service_id', serviceId);
    if (appointmentDate) query.append('date', appointmentDate);
    fetch(`/api/slots?${query.toString()}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setSlots(data))
      .catch(() => {});
  }, [serviceId, appointmentDate]);

  // Dynamically compute reservation slots between staff range
  const timeSlots = React.useMemo(() => {
    if (!openTime || !closeTime) return [];
    try {
      const [startH, startM] = openTime.split(':').map(Number);
      const [endH, endM] = closeTime.split(':').map(Number);
      
      let currentMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      
      const slots = [];
      while (currentMin <= endMin) {
        const mins = currentMin % 60;
        const hrs = Math.floor(currentMin / 60);
        const timeFormatted = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        slots.push(timeFormatted);
        currentMin += 30; // 30-minute intervals
      }
      return slots;
    } catch (err) {
      return ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
    }
  }, [openTime, closeTime]);

  // Set default slot when slots load
  useEffect(() => {
    if (timeSlots.length > 0 && !preferredTime) {
      setPreferredTime(timeSlots[0]);
    }
  }, [timeSlots]);

  useEffect(() => {
    const savedQueueId = localStorage.getItem('ai_smart_q_my_queue_id');
    if (savedQueueId) {
      fetch(`/api/queues/${encodeURIComponent(savedQueueId)}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data && data.id) {
            setMyQueue(data);
          } else {
            localStorage.removeItem('ai_smart_q_my_queue_id');
          }
        })
        .catch(() => {});
    }

    fetch('/api/services')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setServices(data))
      .catch(() => {});

    fetch('/api/settings')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        if (data.service_open_time) setOpenTime(data.service_open_time);
        if (data.service_close_time) setCloseTime(data.service_close_time);
        if (data.hospital_lat) setHospitalLat(parseFloat(data.hospital_lat));
        if (data.hospital_lng) setHospitalLng(parseFloat(data.hospital_lng));
        if (data.hospital_map_link) setMapLink(data.hospital_map_link);
        if (data.campaign_title) setCampaignTitle(data.campaign_title);
        if (data.campaign_desc !== undefined) setCampaignDesc(data.campaign_desc);
        if (data.campaign_start_date !== undefined) {
          setCampaignStartDate(data.campaign_start_date);
          const startStr = data.campaign_start_date;
          if (startStr && startStr > new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]) {
            setAppointmentDate(startStr);
          }
        }
        if (data.campaign_end_date !== undefined) setCampaignEndDate(data.campaign_end_date);
        
        const cleanLiffId = sanitizeLiffId(data.line_liff_id || '');
        if (cleanLiffId) {
          setLiffIdValue(cleanLiffId);
          setLiffConfigured(true);
          initLiff(cleanLiffId)
            .then(async () => {
              setLiffInitialized(true);
              setLiffError('');
              const user = await getSafeLiffUser();
              if (user?.userId) {
                setLineUid(user.userId);
                setLiffProfileName(user.displayName);
                localStorage.setItem('smartq_line_uid', user.userId);
                localStorage.setItem('smartq_line_name', user.displayName);
              }
            })
            .catch(err => {
              console.error("LIFF init error in Patient", err);
              setLiffInitialized(false);
              setLiffError(`เชื่อมต่อ LINE LIFF ไม่สำเร็จ (${err?.message || 'กรุณาตรวจสอบ LIFF ID และ Endpoint URL ใน LINE Developers Console'})`);
            });
        }
      });

    // Listen to queue updates to update status real-time
    const handleQueueUpdated = (updatedQueue: Queue) => {
      setMyQueue(prev => {
        if (prev) {
          // Regardless of whose queue updated, re-fetch our queue to get accurate people_in_front
          fetch(`/api/queues/number/${prev.queue_number}`)
            .then(res => {
              if (res.ok) return res.json();
              throw new Error();
            })
            .then(data => setMyQueue(data))
            .catch(() => {});
            
          // Also update immediately if it's our queue
          if (prev.id === updatedQueue.id) {
            return { ...prev, ...updatedQueue, people_in_front: prev.people_in_front }; // Keep old people_in_front until fetch finishes
          }
        }
        return prev;
      });
    };
    
    socket.on('queue_updated', handleQueueUpdated);

    socket.on('settings_updated', (data: any) => {
      if (data.campaign_title !== undefined) setCampaignTitle(data.campaign_title);
      if (data.campaign_desc !== undefined) setCampaignDesc(data.campaign_desc);
      if (data.campaign_start_date !== undefined) setCampaignStartDate(data.campaign_start_date);
      if (data.campaign_end_date !== undefined) setCampaignEndDate(data.campaign_end_date);
      if (data.hospital_lat !== undefined) setHospitalLat(parseFloat(data.hospital_lat));
      if (data.hospital_lng !== undefined) setHospitalLng(parseFloat(data.hospital_lng));
      if (data.hospital_map_link !== undefined) setMapLink(data.hospital_map_link);
      if (data.service_open_time !== undefined) setOpenTime(data.service_open_time);
      if (data.service_close_time !== undefined) setCloseTime(data.service_close_time);
    });

    socket.on('services_updated', (updated: Service[]) => {
      setServices(updated);
    });

    socket.on('slots_updated', () => {
      // Re-fetch slots when updated
      fetch(`/api/slots?date=${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setSlots(data))
      .catch(() => {});
    });

    return () => {
      socket.off('queue_updated', handleQueueUpdated);
      socket.off('settings_updated');
      socket.off('services_updated');
      socket.off('slots_updated');
    };
  }, []);

  const [isFastTrack, setIsFastTrack] = useState(false);

  // --- Voice Assistant Feature ---
  const isVoiceActiveRef = React.useRef(false);
  const [isVoiceActiveUI, setIsVoiceActiveUI] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'speaking' | 'listening'>('idle');
  const recognitionRef = React.useRef<any>(null);

  const setVoiceActive = (active: boolean) => {
    isVoiceActiveRef.current = active;
    setIsVoiceActiveUI(active);
    if (!active) setVoiceStatus('idle');
  }

  const stopVoiceAssistant = () => {
    setVoiceActive(false);
    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
  };

  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);

  const speak = (text: string, onEnd?: () => void) => {
    window.speechSynthesis.cancel();
    if (!isVoiceActiveRef.current) return;
    setVoiceStatus('speaking');
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance; // keep ref to prevent GC
    utterance.lang = 'th-TH';
    utterance.rate = 0.85; // Slightly slower for better comprehension
    utterance.volume = 1;
    
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang === 'th');
    if (thaiVoice) utterance.voice = thaiVoice;

    let hasCalledOnEnd = false;
    const callOnEnd = () => {
       if (hasCalledOnEnd) return;
       hasCalledOnEnd = true;
       if (isVoiceActiveRef.current && onEnd) onEnd();
    };

    // Fallback timer in case onend doesn't fire (browser bug)
    const fallbackTimer = setTimeout(() => {
        if (isVoiceActiveRef.current && voiceStatus === 'speaking') {
           callOnEnd();
        }
    }, text.length * 200 + 4000); // Generous fallback time

    utterance.onend = () => {
      clearTimeout(fallbackTimer);
      if (isVoiceActiveRef.current) {
        setTimeout(() => {
            callOnEnd();
        }, 1500); // Wait 1.5s after speaking before opening mic (เว้นให้ตอบ)
      }
    };
    utterance.onerror = () => {
      clearTimeout(fallbackTimer);
      if (isVoiceActiveRef.current) {
        setTimeout(() => {
            callOnEnd();
        }, 1500);
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const listenVoice = (onResult: (text: string) => void) => {
    if (!isVoiceActiveRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    setVoiceStatus('listening');
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'th-TH';
    recognition.interimResults = false;
    
    recognition.onerror = (event: any) => {
      if (isVoiceActiveRef.current) {
        if (event.error === 'no-speech') {
           speak("ไม่ได้ยินเสียงเลยค่ะ รบกวนพูดใหม่อีกครั้งนะคะ", () => listenVoice(onResult));
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
           setVoiceActive(false);
           alert("ไม่สามารถใช้งานไมโครโฟนได้ กรุณาอนุญาตการเข้าถึงไมโครโฟนบนเบราว์เซอร์");
        } else if (event.error === 'network') {
           setVoiceActive(false);
           alert("ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้ หรือเบราว์เซอร์ไม่รองรับการแปลงเสียงในขณะนี้");
        } else if (event.error === 'aborted') {
           // Do nothing, we probably cancelled it ourselves
        } else {
           speak("ระบบรับเสียงมีปัญหาค่ะ รบกวนพูดใหม่อีกครั้งนะคะ", () => listenVoice(onResult));
        }
      }
    };
    let hasResult = false;
    recognition.onresult = (event: any) => {
      hasResult = true;
      const text = event.results[0][0].transcript || '';
      onResult(text);
    };
    recognition.onend = () => {
        if (isVoiceActiveRef.current && !hasResult && voiceStatus === 'listening') {
             // It stopped listening but no result and no error was fired (sometimes happens on mobile)
             speak("ไม่ได้ยินเสียงเลยค่ะ รบกวนพูดใหม่อีกครั้งนะคะ", () => listenVoice(onResult));
        }
    };
    
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      if (isVoiceActiveRef.current) setVoiceActive(false);
    }
  };

  const startVoiceAssistant = async () => {
    if (isVoiceActiveRef.current) {
      stopVoiceAssistant();
      return;
    }

    // Unlock speech synthesis immediately on user interaction (Required for iOS/Chrome mobile)
    const unlockUtterance = new SpeechSynthesisUtterance('');
    window.speechSynthesis.speak(unlockUtterance);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
         if (liff.isInClient()) {
            if (confirm("แอป LINE ไม่รองรับการใช้ไมโครโฟน ต้องการเปิดผ่าน Chrome/Safari เพื่อใช้งานระบบเสียงหรือไม่?")) {
               liff.openWindow({ url: window.location.href, external: true });
            }
         } else {
            alert("เบราว์เซอร์ของคุณไม่รองรับการใช้งานไมโครโฟน หรือไม่ได้เปิดผ่าน HTTPS");
         }
         return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err: any) {
      if (err.name === 'NotFoundError' || (err.message && err.message.toLowerCase().includes('device not found'))) {
         alert("ไม่พบไมโครโฟนบนอุปกรณ์ของคุณ กรุณาเชื่อมต่อไมโครโฟน");
      } else {
         if (liff.isInClient()) {
            if (confirm("แอป LINE ปิดกั้นการใช้ไมโครโฟน ต้องการเปิดผ่านเบราว์เซอร์หลัก (Chrome/Safari) เพื่อสั่งงานด้วยเสียงหรือไม่?")) {
               liff.openWindow({ url: window.location.href, external: true });
            }
         } else {
            alert("กรุณาอนุญาตการใช้งานไมโครโฟนในเบราว์เซอร์");
         }
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (liff.isInClient()) {
         if (confirm("แอป LINE ไม่รองรับระบบสั่งงานด้วยเสียง ต้องการเปิดผ่านเบราว์เซอร์หลัก (Chrome/Safari) แทนหรือไม่?")) {
            liff.openWindow({ url: window.location.href, external: true });
         }
      } else {
         alert("เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง แนะนำให้ใช้ Chrome หรือ Safari");
      }
      return;
    }

    setVoiceActive(true);
    let cid = '';
    let fname = '';
    let pnum = '';
    let sid = '';
    let ptime = '';
    let pslotId: number | null = null;

    const askService = () => {
       const activeServices = services.filter(s => s.is_active !== 0 && s.id !== 'service_campaign');
       const nms = activeServices.map(s => s.service_name).join(' หรือ ');
       speak(`คุณต้องการรับบริการอะไรคะ ระบบมี ${nms}`, () => {
         listenVoice((text) => {
            const matched = activeServices.find(s => text.includes(s.service_name) || s.service_name.includes(text));
            if (matched) {
               sid = matched.id;
               setServiceId(sid);
               askTime();
            } else {
               speak("ฟังไม่ทันค่ะ รบกวนบอกประเภทบริการใหม่อีกครั้งนะคะ", () => listenVoice((t2) => {
                 const m2 = activeServices.find(s => t2.includes(s.service_name) || s.service_name.includes(t2));
                 if (m2) {
                    sid = m2.id;
                    setServiceId(sid);
                    askTime();
                 } else {
                    speak("ระบบไม่สามารถระบุบริการได้ ขอยกเลิกการทำรายการค่ะ ขออภัยด้วยนะคะ");
                    setVoiceActive(false);
                 }
               }));
            }
         });
       });
    };

    const formatToThaiSpokenTime = (timeStr: string) => {
       const [hStr, mStr] = timeStr.split(':');
       const h = parseInt(hStr, 10);
       const m = parseInt(mStr, 10);
       let spokenHour = '';
       if (h === 8) spokenHour = 'แปดโมง';
       else if (h === 9) spokenHour = 'เก้าโมง';
       else if (h === 10) spokenHour = 'สิบโมง';
       else if (h === 11) spokenHour = 'สิบเอ็ดโมง';
       else if (h === 12) spokenHour = 'เที่ยง';
       else if (h === 13) spokenHour = 'บ่ายโมง';
       else if (h === 14) spokenHour = 'บ่ายสอง';
       else if (h === 15) spokenHour = 'บ่ายสาม';
       else if (h === 16) spokenHour = 'บ่ายสี่';
       else spokenHour = `${h} นาฬิกา`;

       const spokenMin = m === 30 ? 'ครึ่ง' : m > 0 ? `${m} นาที` : '';
       return spokenHour + spokenMin;
    };

    const askTime = async () => {
       try {
          const query = new URLSearchParams();
          if (sid) query.append('service_id', sid);
          if (appointmentDate) query.append('date', appointmentDate);
          
          const res = await fetch(`/api/slots?${query.toString()}`);
          if (!res.ok) throw new Error('Failed to fetch slots');
          const fetchedSlots = await res.json();
          const availableSlots = fetchedSlots.filter((slot: any) => slot.current_bookings < slot.capacity);

          if (availableSlots.length === 0) {
             speak("ขออภัยด้วยค่ะ ไม่มีรอบบริการที่ว่างสำหรับบริการที่คุณเลือกในวันนี้เลยค่ะ ขอยกเลิกการจองคิวนะคะ");
             setVoiceActive(false);
             return;
          }

          const timeNames = availableSlots.map((s: any) => formatToThaiSpokenTime(s.start_time)).join(', ');
          const promptMsg = `คุณต้องการมารับบริการเวลากี่โมงคะ ช่วงเวลาบริการที่ยังว่างอยู่ มีรอบ ${timeNames} สะดวกรับบริการรอบไหนดีคะ`;

          speak(promptMsg, () => {
             listenVoice((text) => {
                let hour = '';
                const hourMap: Record<string, string> = {
                   'แปด': '08', 'เก้า': '09', 'สิบโมง': '10', 'สิบนาฬิกา': '10', 'สิบเอ็ด': '11', 'สิบสอง': '12', 'เที่ยง': '12',
                   'บ่ายหนึ่ง': '13', 'บ่ายโมง': '13', 'สิบสาม': '13', 
                   'บ่ายสอง': '14', 'สิบสี่': '14', 
                   'บ่ายสาม': '15', 'สิบห้า': '15', 
                   'บ่ายสี่': '16', 'สิบหก': '16',
                   '8': '08', '9': '09', '10': '10', '11': '11', '12': '12', '13': '13', '14': '14', '15': '15', '16': '16',
                   'สิบ': '10'
                };

                for (const [key, val] of Object.entries(hourMap)) {
                   if (text.includes(key)) {
                      hour = val;
                      break;
                   }
                }

                if (!hour && text.includes('เช้า')) hour = '09';
                if (!hour && text.includes('บ่าย')) hour = '13';

                let minute = '00';
                if (text.includes('ครึ่ง') || text.includes('สามสิบ') || text.includes('30')) {
                   minute = '30';
                }

                let matchedSlot = availableSlots.find((slot: any) => {
                   const [sh, sm] = slot.start_time.split(':');
                   return sh === hour && sm === minute;
                });

                if (!matchedSlot && hour) {
                   matchedSlot = availableSlots.find((slot: any) => {
                      const [sh] = slot.start_time.split(':');
                      return sh === hour;
                   });
                }

                if (!matchedSlot) {
                   if (text.includes('รอบแรก') || text.includes('แรกสุด') || text.includes('รอบที่หนึ่ง') || text.includes('รอบ 1')) {
                      matchedSlot = availableSlots[0];
                   } else if (text.includes('รอบสอง') || text.includes('รอบที่สอง') || text.includes('รอบ 2')) {
                      matchedSlot = availableSlots[1];
                   } else if (text.includes('รอบที่สาม') || text.includes('รอบ 3')) {
                      matchedSlot = availableSlots[2];
                   } else if (text.includes('รอบสุดท้าย') || text.includes('รอบหลังสุด') || text.includes('หลังสุด')) {
                      matchedSlot = availableSlots[availableSlots.length - 1];
                   }
                }

                if (matchedSlot) {
                    ptime = `${matchedSlot.start_time} - ${matchedSlot.end_time}`;
                    pslotId = matchedSlot.id;
                    setSlotId(matchedSlot.id);
                    setPreferredTime(ptime);
                    confirmValues();
                } else {
                    speak("เวลานี้ไม่มีรอบให้บริการที่เลือกหรือคิวเต็มแล้วค่ะ รบกวนบอกเวลาใหม่อีกครั้งนะคะ", () => askTime());
                }
             });
          });
       } catch (err) {
          speak("ระบบขออภัยด้วยค่ะ ไม่สามารถโหลดช่วงเวลาบริการได้ชั่วคราว ขอยกเลิกการทำรายการนะคะ");
          setVoiceActive(false);
       }
    };

    const confirmValues = () => {
       const serviceName = services.find(s => s.id === sid)?.service_name || '';
       const timeStr = ptime ? `เวลา ${ptime} น.` : '';
       speak(`คุณชื่อ ${fname} ต้องการจองคิวบริการ ${serviceName} ${timeStr} นะคะ พูดว่า ยืนยัน เพื่อทำรายการค่ะ`, () => {
         listenVoice((text) => {
           if (text.includes('ยืนยัน') || text.includes('ใช่') || text.includes('โอเค') || text.includes('ตกลง') || text.includes('ครับ') || text.includes('ค่ะ')) {
             speak("ระบบกำลังบันทึกข้อมูลและจองคิวให้ค่ะ", () => {
               submitVoiceBooking(fname, cid, pnum, sid, ptime, pslotId);
             });
           } else {
             speak("ยกเลิกการจองคิวแล้วค่ะ ขอบคุณค่ะ");
             setVoiceActive(false);
           }
         });
       });
    };

    speak("สวัสดีค่ะ ระบบจองคิวด้วยเสียง ยินดีให้บริการค่ะ กรุณาบอกชื่อจริงของคุณค่ะ", () => {
       listenVoice((text) => {
          let firstName = text.replace(/สวัสดี(ครับ|ค่ะ)?/g, '').replace(/ชื่อ/g, '').trim();
          speak("ขอบคุณค่ะ นามสกุลของคุณคืออะไรคะ", () => {
             listenVoice((text2) => {
                let lastName = text2.replace(/นามสกุล/g, '').trim();
                fname = firstName + ' ' + lastName;
                setFullName(fname);
                speak("ขอบคุณค่ะ ต่อไปรบกวนบอกเลขประจำตัวประชาชนสิบสามหลักค่ะ", () => {
                   listenVoice((text3) => {
                      let parsedCid = text3.replace(/[^0-9]/g, '');
                      // Try to get 13 digits if possible, pad if necessary for dummy booking
                      if (parsedCid.length === 0) parsedCid = '1111111111111';
                      else if (parsedCid.length < 13) parsedCid = parsedCid.padEnd(13, '0');
                      cid = parsedCid.substring(0, 13);
                      setCitizenId(cid);
                      speak("ขอบคุณค่ะ ต่อไปรบกวนบอกเบอร์โทรศัพท์ติดต่อค่ะ", () => {
                         listenVoice((text4) => {
                            let parsedPhone = text4.replace(/[^0-9]/g, '');
                            pnum = parsedPhone.substring(0, 10);
                            if (pnum.length === 0) pnum = '0800000000';
                            setPhone(pnum);
                            askService();
                         });
                      });
                   });
                });
             });
          });
       });
    });
  };

  const submitVoiceBooking = async (fname: string, cid: string, pnum: string, sid: string, ptime?: string, slotIdParam?: string | number | null) => {
    setVoiceActive(false);
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizen_id: cid,
          full_name: fname,
          phone: pnum,
          service_id: sid,
          role: 'patient',
          booking_type: 'Online',
          line_uid: lineUid,
          preferred_time: ptime || preferredTime || (timeSlots[0] || ''),
          slot_id: slotIdParam || slotId,
          is_fast_track: false,
          appointment_date: appointmentDate
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาดในการจองคิว');
        speak(`เกิดข้อผิดพลาดในการจองคิวค่ะ ${data.error || ''}`);
      } else {
        setMyQueue(data);
        localStorage.setItem('ai_smart_q_my_queue_id', data.id);
        toast.success(`จองคิวสำเร็จ! หมายเลขคิวของคุณคือ ${data.queue_number}`);
        speak(`จองคิวสำเร็จแล้วค่ะ หมายเลขคิวของคุณคือ ${data.queue_number.split('').join(' ')}`);
      }
    } catch (err) {
      setErrorMessage('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      speak("ไม่สามารถเชื่อมต่อกับระบบได้ค่ะ");
    } finally {
      setLoading(false);
    }
  };
  // --- End Voice Assistant Feature ---

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (serviceId !== 'service_campaign' && !slotId && !preferredTime) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizen_id: citizenId,
          full_name: fullName,
          phone,
          service_id: serviceId,
          role,
          booking_type: 'Online',
          line_uid: lineUid,
          preferred_time: preferredTime,
          slot_id: slotId,
          is_fast_track: isFastTrack,
          appointment_date: appointmentDate
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาดในการจองคิว');
        toast.error(data.error || 'เกิดข้อผิดพลาดในการจองคิว');
      } else {
        setMyQueue(data);
        localStorage.setItem('ai_smart_q_my_queue_id', data.id);
        toast.success(`จองคิวสำเร็จ! หมายเลขคิวของคุณคือ ${data.queue_number}`);
      }
    } catch (err) {
      setErrorMessage('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <div className="min-h-screen bg-slate-50 flex justify-center items-start md:py-8 font-sans tracking-tight px-0 md:px-4">
      <div className="w-full max-w-md md:max-w-3xl bg-white shadow-xl md:shadow-2xl min-h-screen md:min-h-[unset] md:rounded-3xl border-0 md:border-2 md:border-slate-100 relative overflow-hidden flex flex-col">
          {/* Header - Bento Theme Style */}
        <div className="bg-teal-600 text-white px-6 py-4 flex items-center justify-between shadow-sm border-b-2 border-teal-700 shrink-0 select-none">
          <div className="flex items-center space-x-3">
            <Link to="/home" className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-black text-white text-base">
              Q
            </div>
            <h1 className="font-bold text-lg">จองคิวรับบริการ</h1>
          </div>
        </div>

        <div className="flex-1 p-6 md:p-8 overflow-y-auto w-full">
          {!myQueue ? (
            <div className="space-y-6">
              <button
                type="button"
                onClick={startVoiceAssistant}
                className={`w-full p-5 rounded-2xl border-4 flex flex-col items-center justify-center gap-3 transition-all ${isVoiceActiveUI ? (voiceStatus === 'listening' ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl shadow-indigo-200 animate-pulse' : 'bg-indigo-500 border-indigo-600 text-white shadow-md') : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300'}`}
              >
                {isVoiceActiveUI ? (voiceStatus === 'listening' ? <Mic className="w-10 h-10" /> : <MicOff className="w-10 h-10 opacity-50" />) : <Mic className="w-8 h-8" />}
                <div className="text-center">
                  <p className="font-black text-lg">{isVoiceActiveUI ? (voiceStatus === 'listening' ? 'กำลังฟังเสียงของคุณ...' : 'ผู้ช่วยกำลังพูด...') : 'ผู้ช่วยจองคิวด้วยเสียง (สำหรับผู้สูงอายุ)'}</p>
                  <p className={`text-xs mt-1 font-bold ${isVoiceActiveUI ? 'text-indigo-200' : 'text-indigo-500/80'}`}>{isVoiceActiveUI ? 'แตะปุ่มนี้อีกครั้งเพื่อยกเลิก' : 'แตะที่นี่เพื่อให้ระบบพิมพ์ให้และจองคิวอัตโนมัติ'}</p>
                </div>
              </button>

              <form onSubmit={handleBook} className="space-y-6 border-t-2 border-slate-100 pt-6">
                <div className="bg-teal-50 text-teal-800 p-4 rounded-2xl border-2 border-teal-100 text-sm flex gap-3 font-medium shadow-sm">
                <Navigation className="w-5 h-5 shrink-0" />
                <p>กรุณากรอกข้อมูลเพื่อจองคิวล่วงหน้า ระบบจะคำนวณเวลาเข้าตรวจให้โดยอัตโนมัติ</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ประเภทผู้จอง</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-teal-500 bg-slate-50 transition-all font-medium text-sm"
                  >
                    <option value="patient">จองให้ตัวเอง</option>
                    <option value="osm">จองให้บุคคลอื่น (โหมด อสม.)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">เลขบัตรประชาชน 13 หลัก</label>
                  <input 
                    type="text" required 
                    value={citizenId} 
                    onChange={e => setCitizenId(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-teal-500 bg-slate-50 transition-all font-medium text-sm"
                    placeholder="110xxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อ-นามสกุล</label>
                  <input 
                    type="text" required 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-teal-500 bg-slate-50 transition-all font-medium text-sm"
                    placeholder="เช่น สมชาย ใจดี"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">เบอร์โทรศัพท์ (ถ้ามี)</label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-teal-500 bg-slate-50 transition-all font-medium text-sm"
                    placeholder="08X-XXX-XXXX"
                  />
                </div>

                {(liffConfigured || liffInitialized || liffError || liffProfileName || lineUid) && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">รับการแจ้งเตือนคิวผ่าน LINE</label>
                    {liffProfileName || lineUid ? (
                      <div className="w-full border-2 border-green-200 rounded-xl p-4 bg-green-50 flex items-center justify-between gap-3 transition-all">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                            <CheckCircle2 className="w-5 h-5" /> เชื่อมต่อ LINE สำเร็จ
                          </div>
                          <p className="text-xs text-green-700/80 font-medium ml-7">
                            การแจ้งเตือนคิวจะถูกส่งไปยัง <b>{liffProfileName || 'บัญชี LINE ที่เข้าสู่ระบบ'}</b>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            try { if (liffInitialized && liff.isLoggedIn()) liff.logout(); } catch {}
                            setLiffProfileName('');
                            setLineUid('');
                            localStorage.removeItem('smartq_line_uid');
                            localStorage.removeItem('smartq_line_name');
                          }}
                          className="text-xs font-bold text-slate-500 hover:text-rose-600 px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors shrink-0 cursor-pointer"
                        >
                          เปลี่ยนบัญชี
                        </button>
                      </div>
                    ) : (
                      <div className="w-full flex flex-col gap-2">
                        <div className="w-full border-2 border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700">
                              เข้าสู่ระบบด้วย LINE เพื่อรับการแจ้งเตือนคิว
                            </p>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              กดปุ่มด้านขวาเพื่อล็อกอิน LINE ครั้งเดียว ระบบจะส่งแจ้งเตือนคิวและให้ดาวรีวิวให้โดยอัตโนมัติ
                            </p>
                          </div>
                          {window.self !== window.top ? (
                            <a
                              href={window.location.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#06C755] hover:bg-[#05b34c] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all inline-flex items-center justify-center gap-2 shrink-0"
                            >
                              เปิดแท็บใหม่เพื่อล็อกอิน LINE
                            </a>
                          ) : liffInitialized ? (
                            <button 
                              type="button"
                              onClick={() => {
                                try {
                                  setLiffError('');
                                  sessionStorage.setItem('smartq_liff_return_path', '/patient');
                                  liff.login();
                                } catch (e: any) {
                                  setLiffError(`ล็อกอิน LINE ไม่สำเร็จ: ${e?.message || 'กรุณาตรวจสอบการตั้งค่า LINE LIFF'}`);
                                }
                              }}
                              className="bg-[#06C755] hover:bg-[#05b34c] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                            >
                              ล็อกอินผ่าน LINE
                            </button>
                          ) : liffIdValue ? (
                            <a
                              href={`https://liff.line.me/${liffIdValue}`}
                              className="bg-[#06C755] hover:bg-[#05b34c] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all inline-flex items-center justify-center gap-2 shrink-0"
                            >
                              เปิดล็อกอินผ่าน LINE
                            </a>
                          ) : null}
                        </div>
                        {liffError && (
                          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 font-medium flex flex-col gap-1">
                            <span className="font-bold">{liffError}</span>
                            {liffIdValue && (
                              <a
                                href={`https://liff.line.me/${liffIdValue}`}
                                className="text-teal-700 underline font-bold w-fit"
                              >
                                ลองเปิดผ่านลิงก์ LINE LIFF โดยตรง
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">บริการที่ต้องการ</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {services.filter(s => s.is_active !== 0).map(s => (
                    <label 
                      key={s.id} 
                      className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${serviceId === s.id ? 'border-teal-500 bg-teal-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <input 
                        type="radio" 
                        name="service" 
                        value={s.id} 
                        checked={serviceId === s.id} 
                        onChange={() => setServiceId(s.id)}
                        className="w-4 h-4 text-teal-600 focus:ring-teal-500 mr-3 animate-none"
                        required
                      />
                      <span className="text-sm font-semibold text-slate-850">{s.service_name}</span>
                    </label>
                  ))}
                </div>
                {serviceId === 'service_1' && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 animate-in slide-in-from-top-2">
                    <input 
                      type="checkbox" 
                      id="fast_track"
                      checked={isFastTrack}
                      onChange={(e) => setIsFastTrack(e.target.checked)}
                      className="mt-1 w-4 h-4 text-amber-600 rounded bg-white border-amber-300 focus:ring-amber-500"
                    />
                    <label htmlFor="fast_track" className="text-sm font-semibold text-amber-900 cursor-pointer">
                      <span className="block mb-0.5 whitespace-nowrap">⚡ รับยาต่อเนื่องแบบด่วน (Fast-Track)</span>
                      <span className="text-[11px] font-normal text-amber-700 leading-tight block">
                        ไม่ต้องรอคิวซักประวัติ ติดต่อช่องรับยาได้ทันที รับยาเสร็จภายใน 5 นาที (เฉพาะผู้ที่แพทย์สั่งยาต่อเนื่อง)
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {serviceId === 'service_campaign' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">วันที่ต้องการจอง</label>
                    <input 
                      type="date"
                      value={appointmentDate}
                      onChange={e => setAppointmentDate(e.target.value)}
                      min={campaignStartDate || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
                      max={campaignEndDate || undefined}
                      className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-teal-500 bg-white transition-all font-medium text-sm"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">เลือกช่วงเวลาที่คุณสะดวก (รอบการให้บริการ)</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {slots.map(slot => {
                    const isFull = slot.current_bookings >= slot.capacity;
                    return (
                      <button
                        type="button"
                        key={slot.id}
                        disabled={isFull}
                        onClick={() => {
                          setSlotId(slot.id);
                          setPreferredTime(`${slot.start_time} - ${slot.end_time}`);
                        }}
                        className={`p-3 text-left rounded-xl border-2 transition-all cursor-pointer relative flex flex-col ${slotId === slot.id ? 'bg-teal-600 border-teal-600 text-white shadow-md' : isFull ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                      >
                        <span className="text-sm font-black">{slot.start_time} - {slot.end_time}</span>
                        <span className={`text-[10px] font-bold mt-1 ${slotId === slot.id ? 'text-teal-100' : isFull ? 'text-rose-500' : 'text-slate-400'}`}>
                          {isFull ? 'คิวเต็มแล้ว' : `ว่าง ${slot.capacity - slot.current_bookings} ท่าน`}
                        </span>
                      </button>
                    );
                  })}
                  {slots.length === 0 && <p className="col-span-full text-center text-xs text-slate-400 py-4">ไม่มีรอบบริการที่เปิดใช้งานในขณะนี้</p>}
                </div>
                {errorMessage && (
                  <p className="text-[11px] text-rose-500 font-bold mt-2 bg-rose-50 p-2 rounded-lg border border-rose-100">⚠️ {errorMessage}</p>
                )}
                {!slotId && !errorMessage && (
                  <p className="text-[11px] text-slate-400 mt-2">กรุณาเลือกรอบที่ยังว่างอยู่เพื่อดำเนินการจองคิวค่ะ</p>
                )}
              </div>

              <div className="pt-4">
                <button 
                  disabled={loading || !serviceId || !slotId} 
                  className="w-full bg-teal-600 text-white rounded-xl py-4 font-bold hover:bg-teal-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-teal-100/50 uppercase tracking-wider text-sm"
                >
                  {loading ? 'กำลังประมวลผล...' : 'ยืนยันการจองคิว'}
                </button>
              </div>

              <TravelTimeDisplay hospitalLat={hospitalLat} hospitalLng={hospitalLng} mapLink={mapLink} />
            </form>
            </div>
          ) : (
            <div className="flex flex-col items-center mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-20 h-20 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-teal-100/50">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-1">จองคิวสำเร็จ</h2>
              <p className="text-slate-500 font-medium text-sm mb-8">นี่คือหมายเลขคิวของคุณ</p>

              <div className="bg-white border-2 border-slate-200 rounded-3xl w-full p-8 text-center shadow-md relative overflow-hidden mb-6">
                <div className={`absolute top-0 left-0 w-full h-2 ${myQueue.color_code.replace('bg-', 'bg-')}`} />
                <p className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-2">หมายเลขคิว</p>
                <div className="text-7xl font-black text-slate-900 tracking-tighter my-4 drop-shadow-sm">
                  {myQueue.queue_number}
                </div>
                <div className="inline-block px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider mt-2 border-2 border-slate-200">
                  {myQueue.service_name}
                </div>
              </div>

              {/* Status Tracking */}
              <div className="bg-slate-50 rounded-2xl border-2 border-slate-200 w-full p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">สถานะ</span>
                  {myQueue.status === 'Waiting' && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md uppercase border border-amber-200">รอรับบริการ</span>}
                  {myQueue.status === 'Calling' && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase border border-blue-200 flex items-center gap-1 animate-pulse"><BellRing className="w-3 h-3"/> กำลังเรียกคิว</span>}
                  {myQueue.status === 'In-progress' && <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-1 rounded-md uppercase border border-teal-200">กำลังตรวจ</span>}
                  {myQueue.status === 'Completed' && <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-1 rounded-md uppercase border border-slate-300">เสร็จสิ้น</span>}
                  {myQueue.status === 'Skipped' && <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md uppercase border border-rose-200">ข้ามคิว</span>}
                </div>
                <div className="h-0.5 bg-slate-200 w-full" />
                {myQueue.appointment_date && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 flex items-center gap-1 font-bold"><Clock className="w-4 h-4"/> วันที่เข้ารับบริการ</span>
                      <span className="text-sm font-black text-slate-900">{format(new Date(myQueue.appointment_date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="h-[1px] bg-slate-100 w-full" />
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 flex items-center gap-1 font-bold"><Clock className="w-4 h-4"/> เวลานัดหมายที่คุณเลือก</span>
                  <span className="text-sm font-black text-teal-600">{myQueue.preferred_time ? `${myQueue.preferred_time} น.` : 'คิวทั่วไป Walk-in'}</span>
                </div>
                {myQueue.status === 'Waiting' && myQueue.estimated_wait_time > 0 && (
                  <>
                    <div className="h-[1px] bg-slate-100 w-full" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 flex items-center gap-1 font-bold"><Users className="w-4 h-4"/> คิวรออยู่ก่อนหน้า</span>
                      <span className="text-sm font-black text-slate-900">{myQueue.people_in_front} ท่าน</span>
                    </div>
                    <div className="h-[1px] bg-slate-100 w-full" />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500 flex items-center gap-1 font-bold"><Clock className="w-4 h-4"/> เวลารอโดยประมาณ</span>
                      <span className="text-sm font-black text-orange-600">{myQueue.estimated_wait_time} นาที</span>
                    </div>
                  </>
                )}
                <div className="h-[1px] bg-slate-100 w-full" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 flex items-center gap-1 font-bold"><Clock className="w-4 h-4"/> เวลาที่กดยืนยัน</span>
                  <span className="text-sm font-black text-slate-900">{format(new Date(myQueue.created_at), 'HH:mm น.')}</span>
                </div>
                {myQueue.status === 'Calling' && (
                  <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm flex gap-3 items-start mt-4 border-2 border-blue-200 font-medium">
                    <BellRing className="w-5 h-5 shrink-0" />
                    <p>ถึงคิวของคุณแล้ว กรุณาติดต่อที่เคาน์เตอร์พยาบาลหรือหน้าห้องตรวจค่ะ</p>
                  </div>
                )}
              </div>

              <div className="w-full">
                <TravelTimeDisplay hospitalLat={hospitalLat} hospitalLng={hospitalLng} mapLink={mapLink} />
              </div>
              
              {myQueue.status === 'Completed' && (
                <div className="mt-8 pt-6 border-t-[3px] border-dashed border-slate-200 flex flex-col items-center">
                  {!myQueue.satisfaction_score ? (
                    <>
                      <p className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">🌟 ประเมินความพึงพอใจ</p>
                      <div className="flex gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            disabled={submittingRating}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRatingScore(star)}
                            className="transition-transform hover:scale-110 focus:outline-none"
                          >
                            <Star 
                              className={`w-10 h-10 ${star <= (hoverRating || ratingScore) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} transition-colors`} 
                            />
                          </button>
                        ))}
                      </div>
                      
                      {ratingScore > 0 && (
                        <div className="w-full max-w-sm flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="พิมพ์ข้อเสนอแนะเพิ่มเติมเพื่อการปรับปรุงการรักษา (ไม่บังคับ)..."
                            rows={3}
                            className="w-full px-4 py-3 bg-slate-50/50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-teal-500 transition-all placeholder:text-slate-400/80 resize-none shadow-inner"
                            maxLength={200}
                          />
                          <button
                            disabled={submittingRating}
                            onClick={() => handleRate(ratingScore)}
                            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-black py-3.5 px-6 rounded-2xl text-xs tracking-wider uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-teal-600/10"
                          >
                            {submittingRating ? 'กำลังส่งแบบประเมิน...' : 'ส่งแบบประเมิน การรักษา'}
                          </button>
                        </div>
                      )}
                      
                      {ratingScore === 0 && <p className="text-xs text-slate-400 font-medium mt-1">แตะที่ดาวเพื่อให้คะแนนการบริการของเรา</p>}
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center p-3 bg-emerald-50 text-emerald-500 rounded-full mb-2">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <p className="text-sm rounded-xl font-bold text-slate-800">ขอบคุณสำหรับการประเมินความพึงพอใจ!</p>
                      <div className="flex justify-center items-center gap-1 my-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-6 h-6 ${star <= (myQueue.satisfaction_score || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                          />
                        ))}
                        <span className="ml-1.5 text-xs font-black text-slate-700">({myQueue.satisfaction_score}/5)</span>
                      </div>
                      {myQueue.satisfaction_comment && (
                        <p className="text-xs text-slate-600 italic bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 max-w-xs mx-auto mb-2">
                          "{myQueue.satisfaction_comment}"
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">ระบบบันทึกผลเข้าสู่รายงาน รพ.สต. เรียบร้อยแล้ว</p>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      localStorage.removeItem('ai_smart_q_my_queue_id');
                      setRatingScore(0);
                      setReviewComment('');
                      setMyQueue(null);
                    }}
                    className="mt-8 text-teal-600 font-bold text-sm flex items-center gap-1 uppercase tracking-wider cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4"/> กลับหน้าแรก
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <LineSimulator />
    </div>
    </APIProvider>
  );
}
