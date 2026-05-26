import express from "express";
import path from "path";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Initialize SQLite database (in-memory for prototype, normally a file like app.db)
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    citizen_id TEXT,
    full_name TEXT,
    phone TEXT,
    line_uid TEXT,
    role TEXT
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    service_name TEXT,
    estimated_minutes INTEGER,
    color_code TEXT,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS queues (
    id TEXT PRIMARY KEY,
    queue_number TEXT,
    patient_id TEXT,
    service_id TEXT,
    slot_id INTEGER,
    booking_type TEXT,
    status TEXT,
    created_at DATETIME,
    called_at DATETIME,
    completed_at DATETIME,
    preferred_time TEXT,
    is_fast_track INTEGER DEFAULT 0,
    is_campaign INTEGER DEFAULT 0,
    appointment_date TEXT,
    notified_approaching INTEGER DEFAULT 0,
    notified_1hr INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    capacity INTEGER DEFAULT 10,
    active INTEGER DEFAULT 1,
    service_id TEXT,
    days_of_week TEXT DEFAULT '1,2,3,4,5'
  );
`);

try { db.prepare("ALTER TABLE queues ADD COLUMN appointment_date TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE time_slots ADD COLUMN service_id TEXT").run(); } catch (e) {}
try { db.prepare("ALTER TABLE time_slots ADD COLUMN days_of_week TEXT DEFAULT '1,2,3,4,5'").run(); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS line_logs (
    id TEXT PRIMARY KEY,
    queue_id TEXT,
    queue_number TEXT,
    message TEXT,
    created_at DATETIME
  );
`);

// Seed some initial data
const insertService = db.prepare('INSERT INTO services (id, service_name, estimated_minutes, color_code, is_active) VALUES (?, ?, ?, ?, ?)');
insertService.run('service_1', 'รับยาโรคประจำตัว', 5, 'bg-blue-500', 1);
insertService.run('service_2', 'ทำแผล', 10, 'bg-rose-500', 1);
insertService.run('service_3', 'พบแพทย์/พยาบาล', 15, 'bg-green-500', 1);
insertService.run('service_4', 'ทันตกรรม', 30, 'bg-purple-500', 1);
insertService.run('service_campaign', 'มหกรรมสุขภาพ / ฉีดวัคซีน', 5, 'bg-teal-500', 0); // Initially disabled in normal mode

// Seed default system settings
db.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('service_open_time', '08:30')").run();
db.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('service_close_time', '16:30')").run();
db.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('hospital_lat', '13.7563')").run();
db.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('hospital_lng', '100.5018')").run();
db.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('hospital_map_link', '')").run();

// Seed default time slots if empty
const slotCount = db.prepare('SELECT count(*) as count FROM time_slots').get() as { count: number };
if (slotCount.count === 0) {
  const insertSlot = db.prepare('INSERT INTO time_slots (start_time, end_time, capacity) VALUES (?, ?, ?)');
  insertSlot.run('08:30', '10:30', 15);
  insertSlot.run('10:30', '12:00', 15);
  insertSlot.run('13:00', '14:30', 15);
  insertSlot.run('14:30', '16:30', 15);
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/services", (req, res) => {
  const services = db.prepare('SELECT * FROM services').all();
  res.json(services);
});

app.post("/api/admin/services/:id/toggle", (req, res) => {
  const id = req.params.id;
  db.prepare('UPDATE services SET is_active = 1 - is_active WHERE id = ?').run(id);
  const updated = db.prepare('SELECT * FROM services').all();
  app.get('io').emit('services_updated', updated);
  res.json({ success: true });
});

app.get("/api/slots", (req, res) => {
  const dateParam = req.query.date as string;
  let todayDate = new Date();
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    todayDate = new Date(dateParam);
  }
  const today = todayDate.toISOString().split('T')[0];
  const dayOfWeek = todayDate.getDay().toString();
  const serviceId = req.query.service_id as string;
  let slots;
  
  if (serviceId) {
    slots = db.prepare(`
      SELECT ts.*, 
      (SELECT count(*) FROM queues q WHERE q.slot_id = ts.id AND (date(q.created_at) = ? OR q.appointment_date = ?)) as current_bookings
      FROM time_slots ts
      WHERE ts.active = 1 AND (ts.service_id = ? OR ts.service_id IS NULL OR ts.service_id = '') AND (ts.days_of_week LIKE ? OR ts.days_of_week IS NULL OR ts.days_of_week = '')
    `).all(today, today, serviceId, `%${dayOfWeek}%`);
  } else {
    slots = db.prepare(`
      SELECT ts.*, 
      (SELECT count(*) FROM queues q WHERE q.slot_id = ts.id AND (date(q.created_at) = ? OR q.appointment_date = ?)) as current_bookings
      FROM time_slots ts
      WHERE ts.active = 1 AND (ts.service_id IS NULL OR ts.service_id = '') AND (ts.days_of_week LIKE ? OR ts.days_of_week IS NULL OR ts.days_of_week = '')
    `).all(today, today, `%${dayOfWeek}%`);
  }
  
  res.json(slots);
});

app.get("/api/admin/slots", (req, res) => {
  const slots = db.prepare('SELECT ts.*, s.service_name FROM time_slots ts LEFT JOIN services s ON ts.service_id = s.id').all();
  res.json(slots);
});

app.post("/api/admin/slots", (req, res) => {
  const { start_time, end_time, capacity, service_id, days_of_week } = req.body;
  const result = db.prepare('INSERT INTO time_slots (start_time, end_time, capacity, service_id, days_of_week) VALUES (?, ?, ?, ?, ?)').run(start_time, end_time, capacity, service_id || null, days_of_week || '0,1,2,3,4,5,6');
  app.get('io').emit('slots_updated');
  res.json({ id: result.lastInsertRowid, start_time, end_time, capacity, active: 1, service_id: service_id || null, days_of_week: days_of_week || '0,1,2,3,4,5,6' });
});

app.delete("/api/admin/slots/:id", (req, res) => {
  db.prepare('DELETE FROM time_slots WHERE id = ?').run(req.params.id);
  app.get('io').emit('slots_updated');
  res.json({ success: true });
});

app.patch("/api/admin/slots/:id", (req, res) => {
  const { start_time, end_time, capacity, active, service_id, days_of_week } = req.body;
  db.prepare('UPDATE time_slots SET start_time = ?, end_time = ?, capacity = ?, active = ?, service_id = ?, days_of_week = ? WHERE id = ?')
    .run(start_time, end_time, capacity, active === undefined ? 1 : active, service_id || null, days_of_week, req.params.id);
  app.get('io').emit('slots_updated');
  res.json({ success: true });
});

// Admin Services CRUD
app.post("/api/admin/services", (req, res) => {
  const { service_name, estimated_minutes, color_code } = req.body;
  const id = `service_${Date.now()}`;
  db.prepare('INSERT INTO services (id, service_name, estimated_minutes, color_code) VALUES (?, ?, ?, ?)')
    .run(id, service_name, estimated_minutes || 15, color_code || 'bg-teal-500');
  res.json({ id, service_name, estimated_minutes, color_code });
});

app.patch("/api/admin/services/:id", (req, res) => {
  const { service_name, estimated_minutes, color_code } = req.body;
  db.prepare('UPDATE services SET service_name = ?, estimated_minutes = ?, color_code = ? WHERE id = ?')
    .run(service_name, estimated_minutes, color_code, req.params.id);
  res.json({ success: true });
});

app.delete("/api/admin/services/:id", (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Generate Queue Number (e.g. A001)
function generateQueueNumber(serviceId: string, isFastTrack: boolean = false) {
  // Simple logic: prefix based on service, number based on today's count
  const prefixMap: Record<string, string> = {
    'service_1': isFastTrack ? 'F' : 'A',
    'service_2': 'B',
    'service_3': 'C',
    'service_4': 'D',
    'service_campaign': 'M'
  };
  
  // For dynamic services, use the first character of the ID or 'S'
  let prefix = prefixMap[serviceId];
  if (!prefix) {
    // Try to get a prefix from the service name if possible, or use a generic one
    const service = db.prepare('SELECT service_name FROM services WHERE id = ?').get(serviceId) as { service_name: string };
    prefix = service?.service_name ? service.service_name.charAt(0).toUpperCase() : 'Q';
  }
  
  // Count today's queues for this service
  const today = new Date().toISOString().split('T')[0];
  const countStmt = db.prepare(`SELECT count(*) as count FROM queues WHERE service_id = ? AND date(created_at) = ?`);
  const { count } = countStmt.get(serviceId, today) as { count: number };
  
  const num = (count + 1).toString().padStart(4, '0');
  return `${prefix}${num}`;
}

// Trigger LINE notification (simulated + real if token is provided)
async function triggerLineNotification(queue: any, action: 'Booked' | 'Calling' | 'Completed' | 'Skipped' | 'No-show' | 'Approaching' | 'Approaching_1hr') {
  if (!queue) return;
  
  // Get map link from settings
  const mapLinkRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'hospital_map_link'").get() as any;
  const mapLink = mapLinkRecord?.value || "";

  let text = "";
  const timeStr = new Date(queue.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  
  if (action === 'Booked') {
    text = `📌 จองคิวสำเร็จ! (รพ.สต.อัจฉริยะ)
• หมายเลขคิว: ${queue.queue_number}
• ผู้ป่วย: ${queue.full_name}
• บริการ: ${queue.service_name} ${queue.is_fast_track ? '(รับยาต่อเนื่อง Fast-Track)' : ''}
• รอบที่จอง: ${queue.preferred_time || '-'}
• เวลาจอง: ${timeStr} น.`;
    
    if (mapLink) {
      text += `\n📍 แผนที่เดินทาง: ${mapLink}`;
    }
    
    if (queue.is_fast_track) {
       text += `\n🏃‍♂️ เนื่องจากเป็นคิว Fast-Track ท่านสามารถติดต่อช่องรับยาได้ทันทีโดยไม่ต้องรอซักประวัติ`;
    } else {
       text += `\n👉 สามารถตรวจสอบสถานะคิวของคุณได้ทางสมาร์ทโฟน`;
    }
  } else if (action === 'Calling') {
    text = `📣 ประกาศเรียกคิวเลขนมัสการ! (รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n• ชื่อคนไข้: ${queue.full_name}\n👉 กรุณาเข้าพบเจ้าหน้าที่ ณ จุดคัดกรองหรือห้องตรวจทันทีค่ะ`;
  } else if (action === 'Completed') {
    text = `✅ บริการเสร็จสิ้นเรียบร้อย (รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n👉 รพ.สต. ขอขอบพระคุณที่เข้ารับบริการ ขอให้ท่านมีสุขภาพแข็งแรง ปราศจากโรคภัยค่ะ`;
  } else if (action === 'Skipped') {
    text = `⚠️ แจ้งเตือนการข้ามคิว (รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n👉 เนื่องจากพยาบาลเรียกคิวแล้วไม่พบท่าน คิวจึงถูกข้ามชั่วคราว กรุณาติดต่อเคาน์เตอร์พยาบาลค่ะ`;
  } else if (action === 'No-show') {
    text = `🚨 แจ้งเตือน: คุณขาดนัด${queue.service_name} (ที่รพ.สต.)\n• หมายเลขคิว: ${queue.queue_number}\n👉 ท่านไม่ได้มาแสดงตัวตามนัดหมายในวันนี้ กรุณาติดต่อสายด่วน รพ.สต. เพื่อนัดหมายใหม่ หรือรับยาป้องกันการขาดยาค่ะ`;
  } else if (action === 'Approaching') {
    text = `⏳ ใกล้ถึงคิวของท่านแล้ว! (รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n👉 อีกประมาณ 3 คิว จะถึงคิวของท่าน กรุณาเตรียมตัวบริเวณจุดรอพักค่ะ`;
  } else if (action === 'Approaching_1hr') {
    text = `⏰ แจ้งเตือนล่วงหน้า 1 ชั่วโมง (รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n• เวลาที่นัดหมาย: ${queue.preferred_time}\n👉 กรุณามาถึงก่อนเวลา เพื่อเตรียมตัวคัดกรองเบื้องต้นค่ะ`;
  }

  // Save notification log in SQLite for UI Real-time Simulation Feed
  const logId = randomUUID();
  const now = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO line_logs (id, queue_id, queue_number, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(logId, queue.id, queue.queue_number, text, now);
  } catch (dbErr) {
    console.error('Error inserting line_logs:', dbErr);
  }

  const socketLog = {
    id: logId,
    queue_id: queue.id,
    queue_number: queue.queue_number,
    message: text,
    created_at: now
  };

  // Broadcast LINE feed log for the in-app phone simulator
  const io = app.get('io');
  if (io) {
    io.emit('line_notification', socketLog);
  }

  // Send via LINE Messaging API if a Channel Access Token is provided
  try {
    const tokenRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_channel_access_token'").get() as any;
    const cat = tokenRecord?.value || process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    
    if (cat && cat.trim() !== "") {
      const headers = {
        'Authorization': `Bearer ${cat}`,
        'Content-Type': 'application/json'
      };

      // 1. Send push notification directly to this patient if they have line_uid
      const recipientUid = queue.line_uid || "";
      if (recipientUid && recipientUid.trim() !== "") {
        console.log(`[LINE Messaging API] Sending PUSH message to patient ID: ${recipientUid}`);
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: recipientUid,
            messages: [{ type: 'text', text }]
          })
        });
        const resData = await response.json();
        console.log('[LINE Messaging API] Push Response:', resData);
      }

      // 2. Or broadcast to all friends if enabled and the user did not receive a direct push
      const broadcastRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_enable_broadcast'").get() as any;
      const enableBroadcast = broadcastRecord?.value === 'true';
      if (enableBroadcast && (!recipientUid || recipientUid.trim() === "")) {
        console.log(`[LINE Messaging API] No patient LINE UID, broadcasting message to all friends`);
        const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: [{ type: 'text', text }]
          })
        });
        const resData = await response.json();
        console.log('[LINE Messaging API] Broadcast Response:', resData);
      }
    }
  } catch (err) {
    console.error('[LINE Messaging API] Failed to send real notification:', err);
  }
}

app.post("/api/queues", (req, res) => {
  const { full_name, citizen_id, phone, service_id, booking_type, role, line_uid, preferred_time, slot_id, is_fast_track, appointment_date } = req.body;
  
  let validSlotId = slot_id;
  const isCampaign = service_id === 'service_campaign' ? 1 : 0;
  
  // For Mass Campaign Booking, do automatic load balancing if slot isn't specifically provided
  if (isCampaign && !validSlotId) {
    const today = new Date().toISOString().split('T')[0];
    const checkDate = appointment_date || today;
    const availableSlots = db.prepare(`
       SELECT ts.id, ts.capacity,
       (SELECT count(*) FROM queues q WHERE q.slot_id = ts.id AND (date(q.created_at) = ? OR q.appointment_date = ?)) as current_bookings
       FROM time_slots ts WHERE ts.active = 1 AND (ts.service_id = 'service_campaign' OR ts.service_id IS NULL)
    `).all(checkDate, checkDate) as any[];
    
    // Sort by current_bookings ascending to load balance
    const bestSlot = availableSlots
        .filter(s => s.current_bookings < s.capacity)
        .sort((a, b) => a.current_bookings - b.current_bookings)[0];
        
    if (bestSlot) {
        validSlotId = bestSlot.id;
    } else {
        return res.status(400).json({ error: "มหกรรมสุขภาพ: รอบบริการเต็มหมดแล้ว" });
    }
  }

  // Capacity check
  if (validSlotId) {
    const today = new Date().toISOString().split('T')[0];
    const checkDate = appointment_date || today;
    const slotData = db.prepare('SELECT capacity FROM time_slots WHERE id = ?').get(validSlotId) as { capacity: number };
    const currentBookings = db.prepare('SELECT count(*) as count FROM queues WHERE slot_id = ? AND (date(created_at) = ? OR appointment_date = ?)').get(validSlotId, checkDate, checkDate) as { count: number };
    
    if (slotData && currentBookings.count >= slotData.capacity) {
      return res.status(400).json({ error: "รอบบริการนี้เต็มแล้ว กรุณาเลือกรอบอื่น" });
    }
  }

  // Find or create user
  let user = db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(citizen_id) as any;
  if (!user) {
    const userId = randomUUID();
    db.prepare('INSERT INTO users (id, citizen_id, full_name, phone, line_uid, role) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, citizen_id, full_name, phone, line_uid || '', role || 'patient');
    user = { id: userId };
  } else {
    // Update name/phone/line_uid
    db.prepare('UPDATE users SET full_name = ?, phone = ?, line_uid = ? WHERE id = ?')
      .run(full_name, phone, line_uid || '', user.id);
  }

  const queueId = randomUUID();
  const fastTrackVal = is_fast_track ? 1 : 0;
  const queueNumber = generateQueueNumber(service_id, fastTrackVal === 1);
  const now = new Date().toISOString();
  const apptDate = appointment_date || now.split('T')[0];

  db.prepare(`
    INSERT INTO queues (id, queue_number, patient_id, service_id, slot_id, booking_type, status, created_at, preferred_time, is_fast_track, is_campaign, appointment_date)
    VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?, ?, ?, ?, ?)
  `).run(queueId, queueNumber, user.id, service_id, validSlotId || null, booking_type || 'Walk-in', now, preferred_time || '', fastTrackVal, isCampaign, apptDate);

  const newQueue = getQueueDetails(queueId);
  
  // Emit socket event for TV and App updates
  app.get('io').emit('queue_updated', newQueue);

  // Trigger LINE Notify (simulated + real if configured)
  triggerLineNotification(newQueue, 'Booked');

  res.json(newQueue);
});

app.get("/api/queues", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  // Smart Flow Logic:
  // 1. Online patients get a 'sorting_time' based on their slot's start time.
  // 2. Walk-in patients get a 'sorting_time' based on their creation time.
  // 3. We then order by this virtual sorting time to interleave them fairly.
  const queues = db.prepare(`
    SELECT q.*, u.full_name, u.citizen_id, u.phone, s.service_name, s.color_code, s.estimated_minutes,
           CASE 
             WHEN q.booking_type = 'Online' THEN ts.start_time
             ELSE strftime('%H:%M', q.created_at, 'localtime')
           END as sorting_time,
           (SELECT count(*) FROM queues q2 WHERE q2.service_id = q.service_id AND q2.status = 'Waiting' AND q2.created_at < q.created_at) as people_in_front
    FROM queues q
    JOIN users u ON q.patient_id = u.id
    JOIN services s ON q.service_id = s.id
    LEFT JOIN time_slots ts ON q.slot_id = ts.id
    WHERE (date(q.created_at) = ? OR q.appointment_date = ?) 
      AND q.status IN ('Waiting', 'Calling', 'In-progress', 'Completed', 'Skipped', 'Cancelled')
    ORDER BY 
      CASE WHEN q.status = 'Calling' THEN 0 WHEN q.status = 'In-progress' THEN 1 ELSE 2 END ASC,
      sorting_time ASC, 
      q.created_at ASC
  `).all(today, today);

  // Add calculated field
  const results = queues.map((q: any) => ({
    ...q,
    estimated_wait_time: (q.people_in_front || 0) * (q.estimated_minutes || 15)
  }));
  
  res.json(results);
});

app.get("/api/queues/number/:queueNumber", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const queueRow = db.prepare(`SELECT id FROM queues WHERE queue_number = ? AND (date(created_at) = ? OR appointment_date = ?) ORDER BY created_at DESC LIMIT 1`).get(req.params.queueNumber.toUpperCase(), today, today) as { id: string } | undefined;
  
  if (!queueRow) return res.status(404).json({ error: "ไม่พบคิวนี้ในระบบสำหรับวันนี้" });
  
  const queue = getQueueDetails(queueRow.id);
  res.json(queue);
});

app.get("/api/queues/:id", (req, res) => {
  const queue = getQueueDetails(req.params.id);
  if (!queue) return res.status(404).json({ error: "Queue not found" });
  res.json(queue);
});

app.patch("/api/queues/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const now = new Date().toISOString();

  let updateQuery = 'UPDATE queues SET status = ? WHERE id = ?';
  const params: any[] = [status, id];

  if (status === 'Calling') {
    updateQuery = 'UPDATE queues SET status = ?, called_at = ? WHERE id = ?';
    params.splice(1, 0, now);
  } else if (status === 'Completed' || status === 'Skipped') {
    updateQuery = 'UPDATE queues SET status = ?, completed_at = ? WHERE id = ?';
    params.splice(1, 0, now);
  }

  db.prepare(updateQuery).run(...params);

  const updatedQueue = getQueueDetails(id);
  app.get('io').emit('queue_updated', updatedQueue);

  // Trigger LINE Notify (simulated + real if configured)
  if (status === 'Calling' || status === 'Completed' || status === 'Skipped') {
    triggerLineNotification(updatedQueue, status);
    
    // Notify the queue that is 3 spots away
    const today = updatedQueue.appointment_date || new Date().toISOString().split('T')[0];
    const upcomingQueues = db.prepare(`
      SELECT id FROM queues 
      WHERE service_id = ? AND status = 'Waiting' AND (date(created_at) = ? OR appointment_date = ?)
      ORDER BY is_fast_track DESC, created_at ASC
    `).all(updatedQueue.service_id, today, today) as any[];
    
    if (upcomingQueues.length > 2) {
       const q3Row = upcomingQueues[2];
       const q3Details = getQueueDetails(q3Row.id);
       if (q3Details && q3Details.notified_approaching === 0) {
          db.prepare('UPDATE queues SET notified_approaching = 1 WHERE id = ?').run(q3Row.id);
          triggerLineNotification(getQueueDetails(q3Row.id), 'Approaching');
       }
    }
  }

  res.json(updatedQueue);
});

app.get("/api/settings", (req, res) => {
  try {
    const tokenRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_channel_access_token'").get() as any;
    const liffRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_liff_id'").get() as any;
    const adminUidRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_admin_uid'").get() as any;
    const broadcastRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_enable_broadcast'").get() as any;
    const openRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'service_open_time'").get() as any;
    const closeRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'service_close_time'").get() as any;
    const latRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'hospital_lat'").get() as any;
    const lngRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'hospital_lng'").get() as any;
    const mapLinkRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'hospital_map_link'").get() as any;
    const campaignCapacityRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'campaign_capacity'").get() as any;
    const campaignTitleRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'campaign_title'").get() as any;
    const campaignDescRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'campaign_desc'").get() as any;
    const campaignStartRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'campaign_start_date'").get() as any;
    const campaignEndRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'campaign_end_date'").get() as any;
    res.json({
      line_channel_access_token: tokenRecord?.value || "",
      line_liff_id: liffRecord?.value || "",
      line_admin_uid: adminUidRecord?.value || "",
      line_enable_broadcast: broadcastRecord?.value || "false",
      service_open_time: openRecord?.value || "08:30",
      service_close_time: closeRecord?.value || "16:30",
      hospital_lat: latRecord?.value || "13.7563",
      hospital_lng: lngRecord?.value || "100.5018",
      hospital_map_link: mapLinkRecord?.value || "",
      campaign_capacity: campaignCapacityRecord?.value || "500",
      campaign_title: campaignTitleRecord?.value || "มหกรรมสุขภาพ / ฉีดวัคซีน",
      campaign_desc: campaignDescRecord?.value || "เพื่อความสะดวกรวดเร็วและลดความแออัด ท่านสามารถจองคิวเข้ารับบริการล่วงหน้าได้สูงสุด 10 วัน โปรดเลือกวันและรอบเวลาที่คุณสะดวก",
      campaign_start_date: campaignStartRecord?.value || "",
      campaign_end_date: campaignEndRecord?.value || ""
    });
  } catch (err) {
    res.json({
      line_channel_access_token: "",
      line_liff_id: "",
      line_admin_uid: "",
      line_enable_broadcast: "false",
      service_open_time: "08:30",
      service_close_time: "16:30",
      hospital_lat: "13.7563",
      hospital_lng: "100.5018",
      hospital_map_link: "",
      campaign_capacity: "500",
      campaign_title: "มหกรรมสุขภาพ / ฉีดวัคซีน",
      campaign_desc: "เพื่อความสะดวกรวดเร็วและลดความแออัด ท่านสามารถจองคิวเข้ารับบริการล่วงหน้าได้สูงสุด 10 วัน โปรดเลือกวันและรอบเวลาที่คุณสะดวก",
      campaign_start_date: "",
      campaign_end_date: ""
    });
  }
});

// Add route for testing LINE messaging API connection
app.post("/api/settings/test-line", async (req, res) => {
  try {
    const { cat, uid } = req.body;
    if (!cat || !uid) {
      return res.status(400).json({ error: "กรุณาระบุ Channel Access Token และ User ID" });
    }
    
    // Test the token and push message
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: uid,
        messages: [{ type: 'text', text: '🔔 ทดสอบระบบแจ้งเตือนจาก Q-Flow!\nหากคุณได้รับข้อความนี้ แสดงว่าการเชื่อมต่อ LINE Messaging API สำเร็จและพร้อมใช้งานแล้วค่ะ' }]
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `LINE API Error: ${data.message || 'Unknown error'}`, 
        details: data.details || [] 
      });
    }
    
    return res.json({ success: true, message: "ระบบได้ส่งข้อความทดสอบไปยัง LINE ของคุณแล้ว" });
  } catch (err: any) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

app.post("/api/settings", (req, res) => {
  const { line_channel_access_token, line_liff_id, line_admin_uid, line_enable_broadcast, service_open_time, service_close_time, hospital_lat, hospital_lng, hospital_map_link, campaign_capacity, campaign_title, campaign_desc, campaign_start_date, campaign_end_date } = req.body;
  try {
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('line_channel_access_token', ?)").run(line_channel_access_token || "");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('line_liff_id', ?)").run(line_liff_id || "");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('line_admin_uid', ?)").run(line_admin_uid || "");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('line_enable_broadcast', ?)").run(line_enable_broadcast || "false");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('service_open_time', ?)").run(service_open_time || "08:30");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('service_close_time', ?)").run(service_close_time || "16:30");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('hospital_lat', ?)").run(hospital_lat || "13.7563");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('hospital_lng', ?)").run(hospital_lng || "100.5018");
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('hospital_map_link', ?)").run(hospital_map_link || "");
    if (campaign_capacity) {
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('campaign_capacity', ?)").run(campaign_capacity);
    }
    if (campaign_title) {
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('campaign_title', ?)").run(campaign_title);
    }
    if (campaign_desc) {
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('campaign_desc', ?)").run(campaign_desc);
    }
    if (campaign_start_date !== undefined) {
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('campaign_start_date', ?)").run(campaign_start_date);
    }
    if (campaign_end_date !== undefined) {
      db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('campaign_end_date', ?)").run(campaign_end_date);
    }
    const settingsObj = {
      line_channel_access_token,
      line_liff_id,
      line_admin_uid,
      line_enable_broadcast,
      service_open_time,
      service_close_time,
      hospital_lat,
      hospital_lng,
      hospital_map_link,
      campaign_capacity,
      campaign_title,
      campaign_desc,
      campaign_start_date,
      campaign_end_date
    };
    app.get('io').emit('settings_updated', settingsObj);
    res.json({
      success: true,
      ...settingsObj
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

app.get("/api/line-logs", (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM line_logs ORDER BY created_at DESC LIMIT 30").all();
    res.json(logs);
  } catch (err) {
    res.json([]);
  }
});

app.get("/api/analytics", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const dailyStats = db.prepare(`
    SELECT 
      count(*) as total,
      sum(case when booking_type = 'Online' then 1 else 0 end) as online,
      sum(case when booking_type = 'Walk-in' then 1 else 0 end) as walkin
    FROM queues 
    WHERE date(created_at) = ?
  `).get(today);

  const serviceStats = db.prepare(`
    SELECT s.service_name as name, count(*) as value
    FROM queues q
    JOIN services s ON q.service_id = s.id
    WHERE date(q.created_at) = ?
    GROUP BY q.service_id
  `).all(today);

  // Peak times (hourly grouping)
  const peakTimes = db.prepare(`
    SELECT strftime('%H:00', created_at) as hour, count(*) as count
    FROM queues
    GROUP BY strftime('%H', created_at)
  `).all();

  // Average wait time (in minutes) for completed queues today
  const waitTime = db.prepare(`
    SELECT 
      avg((julianday(called_at) - julianday(created_at)) * 24 * 60) as avg_wait_mins
    FROM queues
    WHERE date(created_at) = ? AND status IN ('Completed') AND called_at IS NOT NULL
  `).get(today) as any;

  res.json({
    dailyStats,
    serviceStats,
    peakTimes,
    avgWaitTimeMins: Math.round(waitTime?.avg_wait_mins || 0)
  });
});

let geminiAiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!geminiAiClient) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    geminiAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiAiClient;
}

app.post("/api/analytics/ai-insights", async (req, res) => {
  try {
    const ai = getAiClient();
    
    // Aggregate past configurations and stats for the prompt
    // Just select all system settings
    const settings = db.prepare("SELECT key, value FROM system_settings").all();
    
    // Historical stats across all time, not just today
    const totalStats = db.prepare(`
      SELECT 
        count(*) as total_queues,
        sum(case when status = 'Completed' then 1 else 0 end) as completed,
        sum(case when status = 'No-show' then 1 else 0 end) as no_shows,
        avg((julianday(called_at) - julianday(created_at)) * 24 * 60) as avg_wait_time
      FROM queues
      WHERE called_at IS NOT NULL
    `).get() as any;

    const dataPayload = {
      settings,
      stats: totalStats,
      dailyContext: req.body // Let the frontend pass current daily stats if it wants
    };

    const prompt = `
คุณคือผู้เชี่ยวชาญด้านระบบบริหารจัดการคิวและบริการในโรงพยาบาลส่งเสริมสุขภาพตำบล (รพ.สต.) 
จงวิเคราะห์ข้อมูลต่อไปนี้ และให้คำแนะนำที่สามารถนำไปปฏิบัติได้จริงเพื่อปรับปรุงการบริการ ลดเวลารอคอย และเพิ่มความพึงพอใจ
กรุณาตอบเป็นข้อๆ อย่างกระชับ เป็นภาษาไทย

ข้อมูลสรุปสถิติที่ผ่านมาและการตั้งค่า:
${JSON.stringify(dataPayload, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert hospital administrator and data analyst helping to improve patient experience.",
      }
    });

    res.json({ insights: response.text });
  } catch (error: any) {
    console.error("AI Insight Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI insights" });
  }
});

function getQueueDetails(id: string) {
  const queue = db.prepare(`
    SELECT q.*, u.full_name, u.citizen_id, u.phone, u.line_uid, s.service_name, s.color_code, s.estimated_minutes
    FROM queues q
    JOIN users u ON q.patient_id = u.id
    JOIN services s ON q.service_id = s.id
    WHERE q.id = ?
  `).get(id) as any;

  if (queue && queue.status === 'Waiting') {
    // Calculate people in front (bump down waiting if fast track)
    const inFront = db.prepare(`
      SELECT count(*) as count 
      FROM queues 
      WHERE service_id = ? AND status = 'Waiting' AND created_at < ? AND is_fast_track = ?
    `).get(queue.service_id, queue.created_at, queue.is_fast_track) as { count: number };
    
    queue.people_in_front = inFront.count;
    queue.estimated_wait_time = queue.is_fast_track ? 5 : inFront.count * (queue.estimated_minutes || 15);
  } else {
    queue.people_in_front = 0;
    queue.estimated_wait_time = 0;
  }

  return queue;
}

// Add Cron Job Simulation Route
app.post("/api/admin/cron/defaulter-tracking", (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  // Find all waiting queues that are for medicinal refill or have not completed by end of day
  const defaulters = db.prepare(`
    SELECT q.id FROM queues q 
    WHERE q.status IN ('Waiting', 'Calling', 'Skipped') AND date(q.created_at) = ?
  `).all(today) as any[];

  let notifiedCount = 0;
  for (const row of defaulters) {
    db.prepare("UPDATE queues SET status = 'No-show' WHERE id = ?").run(row.id);
    const updatedQueue = getQueueDetails(row.id);
    app.get('io').emit('queue_updated', updatedQueue);
    
    // Only send if it's service 1 or campaign, as an example for medication refill
    if (updatedQueue.service_id === 'service_1' || updatedQueue.service_id === 'service_campaign') {
      triggerLineNotification(updatedQueue, 'No-show');
      notifiedCount++;
    }
  }

  res.json({ success: true, defaulters_marked: defaulters.length, notifications_sent: notifiedCount });
});

// Start Server Wrapper
async function startServer() {
  // Vite integration setup
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Attach socket.io
  const io = new Server(server, { cors: { origin: '*' } });
  app.set('io', io);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Background Process for Notifications (1 hour before queue)
  setInterval(() => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check queues that have preferred_time (HH:mm - HH:mm) or (HH:mm)
    const upcomingQueues = db.prepare(`
      SELECT id, preferred_time FROM queues 
      WHERE status = 'Waiting' AND (date(created_at) = ? OR appointment_date = ?) AND notified_1hr = 0
    `).all(today, today) as any[];

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    for (const q of upcomingQueues) {
      if (!q.preferred_time || q.preferred_time.trim() === '') continue;

      // Extract the first HH:mm
      const match = q.preferred_time.match(/(\d{2}):(\d{2})/);
      if (match) {
        const hh = parseInt(match[1]);
        const mm = parseInt(match[2]);
        const preferredMins = hh * 60 + mm;

        // If the preferred time is within the next 60 minutes
        if (preferredMins > currentMins && (preferredMins - currentMins) <= 60) {
           db.prepare('UPDATE queues SET notified_1hr = 1 WHERE id = ?').run(q.id);
           triggerLineNotification(getQueueDetails(q.id), 'Approaching_1hr');
        }
      }
    }
  }, 60000); // Check every minute
}

startServer();
