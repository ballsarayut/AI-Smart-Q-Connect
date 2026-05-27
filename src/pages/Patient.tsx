import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Queue, Service } from '../types';
import { Clock, Navigation, CheckCircle2, BellRing, ArrowLeft, Users, MapPin, ExternalLink, Star } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import LineSimulator from '../components/LineSimulator';
import liff from '@line/liff';
import { initLiff } from '../lib/liffHelper';

const API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const socket = io();

function TravelTimeDisplay({ hospitalLat, hospitalLng, mapLink }: { hospitalLat: number, hospitalLng: number, mapLink?: string }) {
  const routesLib = useMapsLibrary('routes');
  const [travelTime, setTravelTime] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkLocation = () => {
    if (!API_KEY) {
      if (mapLink) {
        window.open(mapLink, '_blank');
      } else {
        setError('ไม่พบการตั้งค่า API Key หรือ ลิงก์แผนที่');
      }
      return;
    }

    if (!navigator.geolocation) {
      setError('เบราว์เซอร์ไม่รองรับการเช็คตำแหน่ง');
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
        
        if (routesLib) {
          routesLib.Route.computeRoutes({
            origin: userLoc,
            destination: { lat: hospitalLat, lng: hospitalLng },
            travelMode: 'DRIVING',
            fields: ['durationMillis'],
          }).then(({ routes }) => {
            if (routes?.[0]?.durationMillis) {
              const mins = Math.ceil(parseInt(routes[0].durationMillis as any) / 60000);
              setTravelTime(`${mins} นาที`);
            }
            setTracking(false);
          }).catch(err => {
            console.error(err);
            setError('ไม่สามารถคำนวณระยะทางได้ (เช็คในแอป Google Maps แทน)');
            setTracking(false);
          });
        }
      },
      (err) => {
        console.error(err);
        setError('กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง');
        setTracking(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const openInApp = () => {
    if (mapLink) {
      window.open(mapLink, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${hospitalLat},${hospitalLng}`, '_blank');
    }
  };

  return (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-rose-500" />
          เช็คระยะเวลาเดินทาง
        </h3>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={checkLocation}
            disabled={tracking}
            className="text-[10px] font-bold bg-white border border-slate-300 px-2 py-1.5 rounded-lg hover:bg-slate-50 active:scale-95 transition-all text-slate-700 shadow-sm flex items-center gap-1"
          >
            {tracking ? 'กำลังคำนวณ...' : 'เช็คกี่นาที'}
          </button>
          <button 
            type="button"
            onClick={openInApp}
            className="text-[10px] font-bold bg-teal-50 border border-teal-200 px-2 py-1.5 rounded-lg hover:bg-teal-100 active:scale-95 transition-all text-teal-700 shadow-sm flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            เปิดแผนที่
          </button>
        </div>
      </div>

      {travelTime && (
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl p-3 flex items-center justify-between animate-in zoom-in-95 fill-mode-both">
          <span className="text-[10px] font-bold uppercase tracking-wider">ประมาณการเวลาเดินทาง:</span>
          <span className="text-base font-black">{travelTime}</span>
        </div>
      )}

      {error && (
        <p className="text-[9px] text-rose-500 font-bold mt-1">⚠️ {error}</p>
      )}
      
      {!travelTime && !error && !tracking && (
        <p className="text-[10px] text-slate-400">ระบบจะช่วยคำนวณเวลาที่ใช้เดินทางมายัง รพ.สต. เพื่อให้ท่านกะเวลาออกจากบ้านได้ถูกต้อง</p>
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
  const [submittingRating, setSubmittingRating] = useState(false);

  const handleRate = async (score: number) => {
    if (!myQueue) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/queues/${myQueue.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score })
      });
      if (res.ok) {
        const updated = await res.json();
        setMyQueue(updated);
      }
    } catch(err) {}
    setSubmittingRating(false);
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
  const [liffProfileName, setLiffProfileName] = useState('');
  const [liffError, setLiffError] = useState('');

  // Form state
  const searchParams = new URLSearchParams(window.location.search);
  const initialService = searchParams.get('service') || '';
  const [citizenId, setCitizenId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceId, setServiceId] = useState(initialService);
  const [role, setRole] = useState('patient');
  const [lineUid, setLineUid] = useState('');
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
      .then(res => res.json())
      .then(data => setSlots(data));
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
    fetch('/api/services')
      .then(res => res.json())
      .then(data => setServices(data));

    fetch('/api/settings')
      .then(res => res.json())
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
        
        if (data.line_liff_id && data.line_liff_id.trim() !== '') {
          initLiff(data.line_liff_id.trim())
            .then(() => {
              setLiffInitialized(true);
              if (liff.isLoggedIn()) {
                liff.getProfile().then(profile => {
                  setLineUid(profile.userId);
                  setLiffProfileName(profile.displayName);
                }).catch(err => console.error("LIFF get profile error", err));
              }
            })
            .catch(err => {
              console.error("LIFF init error in Patient", err);
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
    });

    socket.on('services_updated', (updated: Service[]) => {
      setServices(updated);
    });

    socket.on('slots_updated', () => {
      // Re-fetch slots when updated
      fetch(`/api/slots?date=${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}`)
      .then(res => res.json())
      .then(data => setSlots(data));
    });

    return () => {
      socket.off('queue_updated', handleQueueUpdated);
      socket.off('settings_updated');
      socket.off('services_updated');
      socket.off('slots_updated');
    };
  }, []);

  const [isFastTrack, setIsFastTrack] = useState(false);

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
      } else {
        setMyQueue(data);
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
            <Link to="/" className="w-8 h-8 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors">
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
            <form onSubmit={handleBook} className="space-y-6">
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

                {liffInitialized && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">รับการแจ้งเตือนคิวผ่าน LINE</label>
                    {liffProfileName ? (
                      <div className="w-full border-2 border-green-200 rounded-xl p-4 bg-green-50 flex flex-col gap-1 transition-all">
                        <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5" /> เชื่อมต่อ LINE สำเร็จ
                        </div>
                        <p className="text-xs text-green-700/80 font-medium ml-7">
                          การแจ้งเตือนคิวจะถูกส่งไปยัง <b>{liffProfileName}</b>
                        </p>
                      </div>
                    ) : (
                            <div className="w-full flex flex-col gap-2">
                              <div className="w-full border-2 border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-4 transition-all">
                                <div>
                                  <p className="text-xs text-slate-500 font-medium">เข้าสู่ระบบด้วยบัญชี LINE ของคุณเพื่อรับการแจ้งเตือน</p>
                                  <div className="mt-2 flex items-center gap-2">
                                    <input 
                                      type="text" 
                                      placeholder="หรือกรอก User ID ด้วยตนเอง (ขึ้นต้นด้วย U...)" 
                                      className="border-2 border-slate-200 rounded-lg p-2 text-xs w-full max-w-[200px] outline-none focus:border-teal-500"
                                      onChange={(e) => {
                                        setLineUid(e.target.value);
                                        if (e.target.value.startsWith('U')) {
                                          setLiffProfileName('คุณ (กรอกเอง)');
                                        } else if (!e.target.value) {
                                          setLiffProfileName('');
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    try {
                                      if (window.self !== window.top) {
                                        setLiffError("สถานะ: จำลองใน AI Studio - โปรดกรอก User ID ในช่องซ้ายมือแทน หรือเปิดแท็บใหม่");
                                      } else {
                                        liff.login();
                                      }
                                    } catch (e) {
                                      liff.login();
                                    }
                                  }}
                                  className="bg-[#06C755] hover:bg-[#05b34c] text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm whitespace-nowrap active:scale-95 transition-all flex items-center gap-2"
                                >
                                  ล็อกอิน LINE
                                </button>
                              </div>
                              {liffError && <p className="text-xs text-amber-600 font-semibold mt-1 px-1">{liffError}</p>}
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
              
              {myQueue.status === 'Completed' && (
                <div className="mt-8 pt-6 border-t-[3px] border-dashed border-slate-200 flex flex-col items-center">
                  {!myQueue.satisfaction_score ? (
                    <>
                      <p className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">🌟 ประเมินความพึงพอใจ</p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            disabled={submittingRating}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => handleRate(star)}
                            className="transition-transform hover:scale-110 focus:outline-none"
                          >
                            <Star 
                              className={`w-10 h-10 ${star <= (hoverRating || ratingScore) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} transition-colors`} 
                            />
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-3">แตะที่ดาวเพื่อให้คะแนนการบริการของเรา</p>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center p-3 bg-amber-50 text-amber-500 rounded-full mb-2">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <p className="text-sm rounded-xl font-bold text-slate-800">ขอบคุณสำหรับคำโหวตของคุณ!</p>
                      <p className="text-xs text-slate-500 mt-1">เราจะนำไปปรับปรุงการให้บริการในครั้งต่อไป</p>
                    </div>
                  )}
                  
                  <button onClick={() => setMyQueue(null)} className="mt-8 text-teal-600 font-bold text-sm flex items-center gap-1 uppercase tracking-wider">
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
