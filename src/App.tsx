/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { CheckCircle2, Star, AlertCircle, ArrowLeft } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Welcome from './pages/Welcome';
import Patient from './pages/Patient';
import Admin from './pages/Admin';
import TV from './pages/TV';
import Analytics from './pages/Analytics';
import Kiosk from './pages/Kiosk';
import StaffPortal from './pages/StaffPortal';
import StaffLogin from './pages/StaffLogin';

import { initLiff, getSafeLiffUser, sanitizeLiffId } from './lib/liffHelper';

export default function App() {
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isRatingFlow, setIsRatingFlow] = useState(false);
  const [ratingQid, setRatingQid] = useState<string | null>(null);
  const [ratingQueueInfo, setRatingQueueInfo] = useState<any>(null);
  const [selectedScore, setSelectedScore] = useState<number>(0);
  const [hoverScore, setHoverScore] = useState<number>(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSubmitted, setCommentSubmitted] = useState(false);
  const rateProcessed = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let rate = params.get('rate');
    let qid = params.get('qid');

    if ((!rate || !qid) && params.get('liff.state')) {
      const stateStr = params.get('liff.state') || '';
      const cleanState = stateStr.startsWith('?') ? stateStr.slice(1) : stateStr;
      const stateParams = new URLSearchParams(cleanState.includes('?') ? cleanState.split('?')[1] : cleanState);
      rate = rate || stateParams.get('rate');
      qid = qid || stateParams.get('qid');
    }

    if (rate !== null && qid) {
      setIsRatingFlow(true);
      setRatingQid(qid);
      const parsedRate = parseInt(rate, 10);

      // Load queue info independently of LIFF
      fetch(`/api/queues/${encodeURIComponent(qid)}`)
        .then(res => {
          if (!res.ok) throw new Error('ไม่พบข้อมูลคิวนี้ในระบบ (อาจเป็นคิวจากรอบการรันก่อนหน้า)');
          return res.json();
        })
        .then(qData => {
          setRatingQueueInfo(qData);
          if (qData.satisfaction_score && !(parsedRate >= 1 && parsedRate <= 5)) {
            setSelectedScore(qData.satisfaction_score);
          }
          if (qData.satisfaction_comment) {
            setReviewComment(qData.satisfaction_comment);
          }
        })
        .catch(err => {
          setRatingError(err.message || 'ไม่สามารถโหลดข้อมูลคิวได้');
        });

      // Immediately save score if ?rate=1..5&qid=...
      if (parsedRate >= 1 && parsedRate <= 5 && !rateProcessed.current) {
        rateProcessed.current = true;
        setSelectedScore(parsedRate);
        fetch(`/api/queues/${encodeURIComponent(qid)}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: parsedRate })
        })
          .then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'บันทึกคะแนนไม่สำเร็จ');
            setRatingQueueInfo(data);
            setRatingSubmitted(true);
          })
          .catch(err => {
            setRatingError(err.message || 'ไม่สามารถบันทึกคะแนนประเมินได้');
            setRatingSubmitted(true);
          });
      } else {
        setRatingSubmitted(true);
      }
    }

    // Globally process LIFF auth callbacks across all pages
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const cleanLiffId = sanitizeLiffId(data.line_liff_id || '');
        if (cleanLiffId) {
          initLiff(cleanLiffId)
            .then(async () => {
              const user = await getSafeLiffUser();
              if (user?.userId) {
                localStorage.setItem('smartq_line_uid', user.userId);
                localStorage.setItem('smartq_line_name', user.displayName);
                const returnPath = sessionStorage.getItem('smartq_liff_return_path');
                if (returnPath && !(rate !== null && qid)) {
                  sessionStorage.removeItem('smartq_liff_return_path');
                  if (window.location.pathname !== returnPath) {
                    window.location.replace(returnPath);
                    return;
                  }
                }
              }
              setIsLiffReady(true);
            })
            .catch(e => {
              console.error('Global LIFF init error', e);
              setIsLiffReady(true);
            });
        } else {
          setIsLiffReady(true);
        }
      })
      .catch(e => {
        console.error(e);
        setIsLiffReady(true);
      });
  }, []);

  const handleRatingSubmit = async () => {
    const qid = ratingQid || new URLSearchParams(window.location.search).get('qid');
    if (!qid || selectedScore < 1 || selectedScore > 5) {
      toast.error('กรุณาเลือกคะแนนความพึงพอใจ 1-5 ดาว');
      return;
    }

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/queues/${encodeURIComponent(qid)}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: selectedScore, comment: reviewComment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถส่งผลประเมินได้');

      setRatingQueueInfo(data);
      setCommentSubmitted(true);
      toast.success('บันทึกผลการประเมินเรียบร้อยแล้ว');
      if (liff.isInClient()) {
        setTimeout(() => liff.closeWindow(), 1800);
      }
    } catch (e: any) {
      toast.error(e.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmittingComment(false);
    }
  };

  if (isRatingFlow) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-6">
        <Toaster position="top-center" />
        <div className="bg-white p-6 sm:p-8 border-2 border-slate-200 rounded-3xl shadow-xl text-center max-w-sm w-full">
          {ratingError ? (
            <div className="py-4">
              <div className="inline-flex items-center justify-center p-4 bg-rose-50 text-rose-500 rounded-full mb-4">
                <AlertCircle className="w-12 h-12" />
              </div>
              <h2 className="text-lg font-black text-slate-800 mb-2">ไม่สามารถประเมินคิวนี้ได้</h2>
              <p className="text-xs font-medium text-slate-500 mb-6">{ratingError}</p>
              <button
                onClick={() => { window.location.href = '/home'; }}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-teal-600 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> กลับหน้าหลัก AI Smart Q Connect
              </button>
            </div>
          ) : ratingSubmitted ? (
            <div className="animate-in fade-in zoom-in duration-300">
              {commentSubmitted ? (
                <>
                  <div className="inline-flex drop-shadow-sm items-center justify-center p-4 bg-emerald-50 text-emerald-500 rounded-full mb-4">
                    <CheckCircle2 className="w-14 h-14" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 mb-2">ขอบคุณสำหรับข้อคิดเห็นค่ะ!</h2>
                  <div className="flex justify-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-6 h-6 ${s <= selectedScore ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                    ))}
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-6">
                    ระบบบันทึกผลการประเมินสู่รายงานความพึงพอใจของ รพ.สต. เรียบร้อยแล้ว
                  </p>
                  <button
                    onClick={() => {
                      if (liff.isInClient()) liff.closeWindow();
                      else window.location.href = '/home';
                    }}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    กลับหน้าแรก
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex drop-shadow-sm items-center justify-center p-3 bg-emerald-50 text-emerald-500 rounded-full mb-3">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  {ratingQueueInfo && (
                    <div className="mb-3 px-3 py-1.5 bg-teal-50 border border-teal-100 rounded-full inline-block text-xs font-black text-teal-700">
                      คิว {ratingQueueInfo.queue_number} • {ratingQueueInfo.service_name}
                    </div>
                  )}
                  <h2 className="text-lg font-black text-slate-800 mb-1">
                    {selectedScore > 0 ? 'บันทึกคะแนนประเมินแล้ว' : 'ประเมินความพึงพอใจบริการ'}
                  </h2>
                  <p className="text-[12px] font-medium text-slate-500 mb-4">
                    แตะเลือกดาวและพิมพ์ข้อเสนอแนะเพิ่มเติมได้เลยค่ะ
                  </p>

                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onMouseEnter={() => setHoverScore(star)}
                        onMouseLeave={() => setHoverScore(0)}
                        onClick={() => setSelectedScore(star)}
                        className="transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                      >
                        <Star
                          className={`w-9 h-9 ${star <= (hoverScore || selectedScore) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'} transition-colors`}
                        />
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="พิมพ์ข้อคิดเห็นหรือข้อเสนอแนะ (ไม่บังคับ)..."
                    rows={3}
                    className="w-full text-left px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-amber-500 transition-all resize-none mb-4 shadow-inner"
                    maxLength={200}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (liff.isInClient()) liff.closeWindow();
                        else window.location.href = '/home';
                      }}
                      className="flex-1 py-3 rounded-xl border-2 border-slate-100 text-slate-500 font-bold text-[11px] tracking-wider uppercase hover:bg-slate-50 hover:text-slate-700 transition-colors active:scale-95"
                    >
                      กลับหน้าแรก
                    </button>
                    <button
                      onClick={handleRatingSubmit}
                      disabled={submittingComment || selectedScore < 1}
                      className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-[11px] tracking-wider uppercase shadow-sm shadow-amber-500/20 transition-all active:scale-95"
                    >
                      {submittingComment ? 'กำลังส่ง...' : 'ส่งผลประเมิน'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-amber-100 rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 font-bold text-sm tracking-widest uppercase mb-1">กำลังบันทึกคะแนน</p>
              <p className="text-xs text-slate-400">โปรดรอสักครู่...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Only block render completely if LINE OAuth code is present (to prevent redirect loop)
  // Otherwise, render immediately for normal users, but keep Liff initialized in bg
  if (!isLiffReady && window.location.search.includes('code=')) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-teal-100 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-bold text-sm tracking-widest uppercase">กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Toaster position="top-center" />
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/home" element={<Home />} />
          <Route path="/staff-login" element={<StaffLogin />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/staff" element={<StaffPortal />} />
          <Route path="/patient" element={<Patient />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/tv" element={<TV />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </div>
    </Router>
  );
}
