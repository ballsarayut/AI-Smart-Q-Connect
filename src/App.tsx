/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import liff from '@line/liff';
import { CheckCircle2 } from 'lucide-react';
import Home from './pages/Home';
import Patient from './pages/Patient';
import Admin from './pages/Admin';
import TV from './pages/TV';
import Analytics from './pages/Analytics';
import Kiosk from './pages/Kiosk';
import StaffPortal from './pages/StaffPortal';
import StaffLogin from './pages/StaffLogin';

import { initLiff } from './lib/liffHelper';

export default function App() {
  const [isLiffReady, setIsLiffReady] = useState(false);
  const [isRatingFlow, setIsRatingFlow] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentSubmitted, setCommentSubmitted] = useState(false);
  const rateProcessed = useRef(false);

  useEffect(() => {
    // Check if we are handling a quick rating from LINE
    const params = new URLSearchParams(window.location.search);
    const rate = params.get('rate');
    const qid = params.get('qid');

    if (rate && qid) {
       setIsRatingFlow(true);
    }

    // Globally process LIFF auth callbacks across all pages
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.line_liff_id && data.line_liff_id.trim() !== '') {
          initLiff(data.line_liff_id.trim())
            .then(() => {
               setIsLiffReady(true);
               if (rate && qid && !rateProcessed.current) {
                 rateProcessed.current = true;
                 fetch(`/api/queues/${qid}/rate`, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ score: parseInt(rate, 10) })
                 }).then(() => {
                   setRatingSubmitted(true);
                 }).catch(console.error);
               }
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

  const handleCommentSubmit = async () => {
    const params = new URLSearchParams(window.location.search);
    const rate = params.get('rate');
    const qid = params.get('qid');
    if (!rate || !qid || !reviewComment.trim()) return;
    
    setSubmittingComment(true);
    try {
      await fetch(`/api/queues/${qid}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: parseInt(rate, 10), comment: reviewComment })
      });
      setCommentSubmitted(true);
      if (liff.isInClient()) {
        setTimeout(() => liff.closeWindow(), 1500);
      } else {
        setTimeout(() => window.close(), 1500);
      }
    } catch(e) {
      console.error(e);
      setSubmittingComment(false);
    }
  };

  if (isRatingFlow) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-6">
        <div className="bg-white p-6 sm:p-8 border-2 border-slate-200 rounded-2xl shadow-sm text-center max-w-sm w-full">
           {ratingSubmitted ? (
             <div className="animate-in fade-in zoom-in duration-500">
               {commentSubmitted ? (
                 <>
                   <div className="inline-flex drop-shadow-sm items-center justify-center p-4 bg-emerald-50 text-emerald-500 rounded-full mb-4">
                     <CheckCircle2 className="w-16 h-16" />
                   </div>
                   <h2 className="text-xl font-black text-slate-800 mb-2">ขอบคุณสำหรับข้อคิดเห็นค่ะ!</h2>
                   <p className="text-sm font-medium text-slate-500">เราจะนำไปปรับปรุงการให้บริการให้ดียิ่งขึ้น</p>
                   <p className="text-xs text-slate-400 mt-4">(ระบบกำลังจะปิดหน้านี้)</p>
                 </>
               ) : (
                 <>
                   <div className="inline-flex drop-shadow-sm items-center justify-center p-3 bg-emerald-50 text-emerald-500 rounded-full mb-4">
                     <CheckCircle2 className="w-10 h-10" />
                   </div>
                   <h2 className="text-lg font-black text-slate-800 mb-2">บันทึกคะแนนประเมินแล้ว</h2>
                   <p className="text-[13px] font-medium text-slate-500 mb-5">หากมีข้อเสนอแนะเพิ่มเติม สามารถพิมพ์บอกเราได้ค่ะ</p>
                   
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
                         else window.close();
                       }}
                       className="flex-1 py-3 rounded-xl border-2 border-slate-100 text-slate-500 font-bold text-[11px] tracking-wider uppercase hover:bg-slate-50 hover:text-slate-700 transition-colors active:scale-95"
                     >
                       ข้าม / ปิด
                     </button>
                     <button
                       onClick={handleCommentSubmit}
                       disabled={submittingComment || !reviewComment.trim()}
                       className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-[11px] tracking-wider uppercase shadow-sm shadow-amber-500/20 transition-all active:scale-95"
                     >
                       {submittingComment ? 'กำลังส่ง...' : 'ส่งข้อเสนอแนะ'}
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
        <Routes>
          <Route path="/" element={<Home />} />
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
