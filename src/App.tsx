/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import liff from '@line/liff';
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

  useEffect(() => {
    // Globally process LIFF auth callbacks across all pages
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.line_liff_id && data.line_liff_id.trim() !== '') {
          initLiff(data.line_liff_id.trim())
            .then(() => setIsLiffReady(true))
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
