/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Patient from './pages/Patient';
import Admin from './pages/Admin';
import TV from './pages/TV';
import Analytics from './pages/Analytics';
import Kiosk from './pages/Kiosk';
import StaffPortal from './pages/StaffPortal';
import StaffLogin from './pages/StaffLogin';

export default function App() {
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
