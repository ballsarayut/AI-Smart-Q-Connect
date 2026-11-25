import express from "express";
import path from "path";
import { Server } from "socket.io";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { GoogleGenAI } from "@google/genai";

function getThailandTimeStr() {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + 7);
  return d.toISOString().replace('Z', '');
}

const app = express();
const PORT = 3000;
let detectedAppUrl = "";

// Middleware
app.use(express.json());
app.use((req, _res, next) => {
  const fwdHost = req.headers['x-forwarded-host'];
  const rawHost = Array.isArray(fwdHost) ? fwdHost[0] : (fwdHost || req.headers.host || '');
  if (rawHost && !rawHost.includes('localhost') && !rawHost.includes('127.0.0.1')) {
    const fwdProto = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(fwdProto) ? fwdProto[0] : (fwdProto || 'https');
    detectedAppUrl = `${proto}://${rawHost}`.replace(/\/$/, '');
  }
  next();
});

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
    notified_1hr INTEGER DEFAULT 0,
    satisfaction_score INTEGER
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
try { db.prepare("ALTER TABLE queues ADD COLUMN satisfaction_score INTEGER").run(); } catch (e) {}
try { db.prepare("ALTER TABLE queues ADD COLUMN satisfaction_comment TEXT").run(); } catch (e) {}
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
    sender TEXT DEFAULT 'bot',
    created_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS line_pending_reviews (
    line_uid TEXT PRIMARY KEY,
    queue_id TEXT,
    stage TEXT,
    updated_at DATETIME
  );
`);

try { db.prepare("ALTER TABLE line_logs ADD COLUMN sender TEXT DEFAULT 'bot'").run(); } catch (e) {}

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

// Seed realistic analytics and queue data for demonstration
function seedRealisticAnalyticsData(force: boolean = false) {
  const existingCount = (db.prepare('SELECT count(*) as count FROM queues').get() as { count: number }).count;
  if (!force && existingCount >= 10) {
    return existingCount;
  }

  if (force) {
    db.prepare('DELETE FROM queues').run();
  }

  const patientProfiles = [
    { name: "นายสมชาย ใจดี", cid: "1100501234561", tel: "081-234-5678", uid: "U1001" },
    { name: "นางกานดา มณีโชติ", cid: "1100501234562", tel: "089-876-5432", uid: "U1002" },
    { name: "นายบุญมี ทองแท้", cid: "1100501234563", tel: "086-555-1234", uid: "U1003" },
    { name: "นางสาวสุภาพร รัตนวิชัย", cid: "1100501234564", tel: "092-345-6789", uid: "U1004" },
    { name: "นายประเสริฐ ยิ่งยวด", cid: "1100501234565", tel: "084-111-2233", uid: "U1005" },
    { name: "นางวรรณา สดใส", cid: "1100501234566", tel: "085-999-8877", uid: "U1006" },
    { name: "นายอำนาจ ศรีสุข", cid: "1100501234567", tel: "087-444-3322", uid: "U1007" },
    { name: "นางมาลี พงษ์ไพบูลย์", cid: "1100501234568", tel: "091-888-7766", uid: "U1008" },
    { name: "นายวินัย เจริญผล", cid: "1100501234569", tel: "083-222-1100", uid: "U1009" },
    { name: "นางสาวนภาพร ดวงแก้ว", cid: "1100501234570", tel: "088-777-6655", uid: "U1010" },
    { name: "นายชัชชัย เลิศวิริยะ", cid: "1100501234571", tel: "082-333-4455", uid: "U1011" },
    { name: "นางรัตนา ประดิษฐ์สุข", cid: "1100501234572", tel: "090-666-5544", uid: "U1012" },
    { name: "นายสมบูรณ์ มีสุข", cid: "1100501234573", tel: "081-999-0011", uid: "U1013" },
    { name: "นายอนันต์ เจริญกิจ", cid: "1100501234574", tel: "089-444-1212", uid: "U1014" },
    { name: "นางจันทร์เพ็ญ บุญรักษา", cid: "1100501234575", tel: "086-777-8989", uid: "U1015" },
    { name: "นายธีรพล วรวิทย์", cid: "1100501234576", tel: "093-212-3456", uid: "U1016" },
    { name: "นางพิมพา เกียรติอนันต์", cid: "1100501234577", tel: "084-555-6789", uid: "U1017" },
    { name: "นายชัยวัฒน์ สุริยะ", cid: "1100501234578", tel: "087-123-9876", uid: "U1018" },
    { name: "นางสาวสุดาพร ศรีมงคล", cid: "1100501234579", tel: "082-987-6543", uid: "U1019" },
    { name: "นายสมจิต รุ่งอรุณ", cid: "1100501234580", tel: "085-321-7654", uid: "U1020" },
    { name: "นางสมศรี จันทร์สว่าง", cid: "1100501234581", tel: "081-345-6789", uid: "U1021" },
    { name: "นายทวีศักดิ์ ชัยภูมิ", cid: "1100501234582", tel: "089-765-4321", uid: "U1022" },
    { name: "นางพรรณี วรรณรัตน์", cid: "1100501234583", tel: "086-234-5678", uid: "U1023" },
    { name: "นายเกรียงไกร มั่นคง", cid: "1100501234584", tel: "092-876-5432", uid: "U1024" },
    { name: "นางสาวอัญชลี พรประเสริฐ", cid: "1100501234585", tel: "084-333-2211", uid: "U1025" }
  ];

  const userIds: string[] = [];
  const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, citizen_id, full_name, phone, line_uid, role) VALUES (?, ?, ?, ?, ?, ?)');
  patientProfiles.forEach(p => {
    const existing = db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(p.cid) as any;
    const uid = existing?.id || randomUUID();
    insertUser.run(uid, p.cid, p.name, p.tel, p.uid, 'patient');
    userIds.push(uid);
  });

  const reviewsPool = [
    { score: 5, comment: "ระบบจองผ่าน LINE สะดวกมากค่ะ มาถึงตรงเวลารอแค่ 10 นาทีก็ได้ตรวจแล้ว พยาบาลพูดจาไพเราะมาก" },
    { score: 5, comment: "คุณหมอให้คำแนะนำละเอียด ใจดีและรับฟังอาการอย่างดีมากครับ" },
    { score: 5, comment: "ระบบคิวเดินเร็วมาก มีการแจ้งเตือนใน LINE ก่อนถึงคิว ช่วยให้ไม่ต้องนั่งแออัดใน รพ.สต." },
    { score: 5, comment: "รับยาโรคประจำตัวรวดเร็วทันใจ เจ้าหน้าที่เภสัชอธิบายวิธีทานยาเข้าใจง่ายครับ" },
    { score: 5, comment: "แผลผ่าตัดทำแผลดี สะอาด มือเบามาก ไม่เจ็บเลยค่ะ" },
    { score: 4, comment: "บริการดี สะดวก รวดเร็วดีมาก แต่ที่จอดรถช่วงเช้าค่อนข้างแน่น" },
    { score: 5, comment: "ชอบที่มีเสียงเรียกคิวและหน้าจอทีวีชัดเจนมาก ไม่พลาดคิวแน่นอน" },
    { score: 4, comment: "ระบบนัดล่วงหน้าทำงานได้ดีมาก ไม่ต้องตื่นมารอแต่เช้ามืดเหมือนเมื่อก่อนแล้ว" },
    { score: 5, comment: "พยาบาลน่ารัก อารมณ์ดี บริการอบอุ่นเหมือนคนในครอบครัว" },
    { score: 3, comment: "ช่วง 10 โมงคนเยอะนิดหน่อย แต่โดยรวมเจ้าหน้าที่บริการสุภาพและเต็มที่ครับ" },
    { score: 5, comment: "ทันตกรรมมือเบามาก ขูดหินปูนสะอาด แนะนำดี ประทับใจมากค่ะ" },
    { score: 4, comment: "สะดวกสบายมาก จองออนไลน์ผ่านมือถือง่ายมาก ผู้สูงอายุก็ใช้ได้" },
    { score: 5, comment: "ไม่ต้องเสียเวลานั่งรอทั้งวันอีกต่อไป นวัตกรรมยอดเยี่ยมสำหรับชุมชนเลยครับ" },
    { score: 4, comment: "เจ้าหน้าที่จุดคัดกรองแนะนำดี รวดเร็ว เป็นระเบียบเรียบร้อย" },
    { score: 5, comment: "การแจ้งเตือนใกล้ถึงคิวล่วงหน้า 3 คิวดีมากๆ เดินไปซื้อน้ำรอได้สบายใจ" },
    { score: 5, comment: "คุณหมอและพยาบาลตั้งใจดูแลคนไข้ทุกคนเป็นอย่างดี ชื่นชมครับ" },
    { score: 4, comment: "ระบบคิวดิจิทัลช่วยลดความวุ่นวายได้เยอะมาก คนไข้รู้เวลาตัวเองชัดเจน" },
    { score: 4, comment: "รอไม่นาน จัดการคิวได้เป็นระเบียบเรียบร้อย ประทับใจครับ" },
    { score: 5, comment: "พยาบาลให้คำแนะนำการดูแลสุขภาพเบาหวานและความดันดีมาก" }
  ];

  const servicesConfig = [
    { id: 'service_1', prefix: 'A', weight: 35 }, // รับยา 35%
    { id: 'service_3', prefix: 'C', weight: 30 }, // พบแพทย์ 30%
    { id: 'service_2', prefix: 'B', weight: 20 }, // ทำแผล 20%
    { id: 'service_4', prefix: 'D', weight: 15 }  // ทันตกรรม 15%
  ];

  const insertQueue = db.prepare(`
    INSERT INTO queues (
      id, queue_number, patient_id, service_id, slot_id, booking_type, status,
      created_at, called_at, completed_at, preferred_time, is_fast_track, is_campaign,
      appointment_date, satisfaction_score, satisfaction_comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalSeeded = 0;
  const now = new Date();
  const thaiNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);

  // Seed across past 28 days up to today (dayOffset = 0)
  for (let dayOffset = -28; dayOffset <= 0; dayOffset++) {
    const targetDate = new Date(thaiNow.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = targetDate.toISOString().split('T')[0];
    const isToday = dayOffset === 0;

    const dayOfWeek = targetDate.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    let countForDay = isWeekend ? 3 : (isToday ? 18 : (dayOffset >= -7 ? 11 : 5));

    const counters: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const hourPool = [8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 13, 13, 14, 14, 15];

    for (let i = 0; i < countForDay; i++) {
      const uId = userIds[(totalSeeded + i) % userIds.length];
      const rand = ((i * 17 + dayOffset * 13) % 100 + 100) % 100;
      let srv = servicesConfig[0];
      if (rand < 35) srv = servicesConfig[0];
      else if (rand < 65) srv = servicesConfig[1];
      else if (rand < 85) srv = servicesConfig[2];
      else srv = servicesConfig[3];

      const isFastTrack = srv.id === 'service_1' && i % 7 === 0;
      const prefix = isFastTrack ? 'F' : srv.prefix;
      counters[prefix] = (counters[prefix] || 0) + 1;
      const qNum = `${prefix}${counters[prefix].toString().padStart(4, '0')}`;

      const isOnline = (i + Math.abs(dayOffset)) % 2 === 0; // ~50% Online
      const bookingType = isOnline ? 'Online' : 'Walk-in';

      const baseHour = hourPool[i % hourPool.length];
      const minute = ((i * 7 + 13) % 48) + 5;
      const hourStr = baseHour.toString().padStart(2, '0');
      const minStr = minute.toString().padStart(2, '0');
      
      const createdIso = `${dateStr}T${hourStr}:${minStr}:00.000`;
      
      // Realistic wait time between 11 - 18 minutes (avg 14)
      const waitMinutes = 11 + ((i * 3 + dayOffset) % 8);
      const calledDate = new Date(new Date(createdIso).getTime() + waitMinutes * 60 * 1000);
      const calledIso = calledDate.toISOString().replace('Z', '');

      // Service duration: 8 - 18 minutes
      const serviceMinutes = 8 + ((i * 2) % 10);
      const completedDate = new Date(calledDate.getTime() + serviceMinutes * 60 * 1000);
      const completedIso = completedDate.toISOString().replace('Z', '');

      let status = 'Completed';
      let calledAt: string | null = calledIso;
      let completedAt: string | null = completedIso;
      let review = reviewsPool[(totalSeeded + i) % reviewsPool.length];
      let score: number | null = review.score;
      let comment: string | null = review.comment;

      if (isToday) {
        if (i >= countForDay - 3) {
          // 3 waiting patients right now
          status = 'Waiting';
          calledAt = null;
          completedAt = null;
          score = null;
          comment = null;
        } else if (i === countForDay - 4) {
          // 1 in calling
          status = 'Calling';
          completedAt = null;
          score = null;
          comment = null;
        } else if (i === countForDay - 5) {
          // 1 in progress
          status = 'In-progress';
          completedAt = null;
          score = null;
          comment = null;
        }
      } else {
        // A couple of no-shows in history
        if (i === 1 && dayOffset % 6 === 0) {
          status = 'No-show';
          calledAt = null;
          completedAt = null;
          score = null;
          comment = null;
        }
      }

      // Slot ID mapping based on time
      let slotId = null;
      if (isOnline) {
        if (baseHour <= 10) slotId = 1;
        else if (baseHour <= 12) slotId = 2;
        else if (baseHour <= 14) slotId = 3;
        else slotId = 4;
      }

      const qId = randomUUID();
      insertQueue.run(
        qId,
        qNum,
        uId,
        srv.id,
        slotId,
        bookingType,
        status,
        createdIso,
        calledAt,
        completedAt,
        isOnline ? `${hourStr}:${minStr}` : '',
        isFastTrack ? 1 : 0,
        0,
        dateStr,
        score,
        comment
      );
      totalSeeded++;
    }
  }

  return totalSeeded;
}

// Seed realistic Health Campaign queues (มหกรรมสุขภาพ / ฉีดวัคซีน)
function seedCampaignQueues(force: boolean = false) {
  const thaiNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayStr = thaiNow.toISOString().split('T')[0];

  const existingCampaignCount = (
    db.prepare("SELECT count(*) as count FROM queues WHERE service_id = 'service_campaign' AND (date(created_at) = ? OR appointment_date = ?)").get(todayStr, todayStr) as { count: number }
  ).count;

  if (!force && existingCampaignCount >= 5) {
    return existingCampaignCount;
  }

  // Activate campaign service so it appears in Home, Patient, and Admin Campaign Mode
  db.prepare("UPDATE services SET is_active = 1 WHERE id = 'service_campaign'").run();

  if (force) {
    db.prepare("DELETE FROM queues WHERE service_id = 'service_campaign' AND (date(created_at) = ? OR appointment_date = ?)").run(todayStr, todayStr);
  }

  const campaignPatients = [
    { name: "นางสาวสุนิสา แก้วประเสริฐ", cid: "1100509900101", tel: "081-412-5501", uid: "UC2001" },
    { name: "นายวิชัย ชัยวัฒนะ", cid: "1100509900102", tel: "089-412-5502", uid: "UC2002" },
    { name: "นางสมหมาย จันทรา", cid: "1100509900103", tel: "086-412-5503", uid: "UC2003" },
    { name: "นายประวิทย์ พูลทรัพย์", cid: "1100509900104", tel: "092-412-5504", uid: "UC2004" },
    { name: "นางสาวกัญญา วงศ์สุวรรณ", cid: "1100509900105", tel: "084-412-5505", uid: "UC2005" },
    { name: "นายธนากร มีเจริญ", cid: "1100509900106", tel: "085-412-5506", uid: "UC2006" },
    { name: "นางดวงใจ สุขสวัสดิ์", cid: "1100509900107", tel: "087-412-5507", uid: "UC2007" },
    { name: "นายกิตติพงษ์ ศรีวิไล", cid: "1100509900108", tel: "091-412-5508", uid: "UC2008" },
    { name: "นางสาวพิมพ์ชนก รุ่งเรือง", cid: "1100509900109", tel: "083-412-5509", uid: "UC2009" },
    { name: "นายสุรชัย ทองดี", cid: "1100509900110", tel: "088-412-5510", uid: "UC2010" },
    { name: "นางละมัย บุญมี", cid: "1100509900111", tel: "082-412-5511", uid: "UC2011" },
    { name: "นายเอกชัย วัฒนากูล", cid: "1100509900112", tel: "090-412-5512", uid: "UC2012" },
    { name: "นางสาวอรุณี อินทร์แก้ว", cid: "1100509900113", tel: "081-412-5513", uid: "UC2013" },
    { name: "นายสมพงษ์ แสงจันทร์", cid: "1100509900114", tel: "089-412-5514", uid: "UC2014" },
    { name: "นางประไพ พิทักษ์ชน", cid: "1100509900115", tel: "086-412-5515", uid: "UC2015" },
    { name: "นายณัฐพล ขวัญเมือง", cid: "1100509900116", tel: "093-412-5516", uid: "UC2016" },
    { name: "นางสาวชุติมา นาคเสน", cid: "1100509900117", tel: "084-412-5517", uid: "UC2017" },
    { name: "นายบรรจง ยิ้มแย้ม", cid: "1100509900118", tel: "087-412-5518", uid: "UC2018" },
    { name: "นางสมปอง รักชาติ", cid: "1100509900119", tel: "082-412-5519", uid: "UC2019" },
    { name: "นายวีระศักดิ์ ใจตรง", cid: "1100509900120", tel: "085-412-5520", uid: "UC2020" },
    { name: "นางสาวจินตนา โพธิ์ทอง", cid: "1100509900121", tel: "081-412-5521", uid: "UC2021" },
    { name: "นายสมาน พันธุ์ดี", cid: "1100509900122", tel: "089-412-5522", uid: "UC2022" },
    { name: "นางทองสุข เหมือนใจ", cid: "1100509900123", tel: "086-412-5523", uid: "UC2023" },
    { name: "นายชาญณรงค์ อ่อนน้อม", cid: "1100509900124", tel: "092-412-5524", uid: "UC2024" }
  ];

  const campaignReviews = [
    { score: 5, comment: "ฉีดวัคซีนงานมหกรรมสุขภาพรวดเร็วมาก ระบบกระจายคิวดี ไม่แออัดเลยค่ะ" },
    { score: 5, comment: "จัดงานมหกรรมสุขภาพได้เป็นระเบียบดีมาก จองผ่าน LINE มาถึงได้ฉีดเลย" },
    { score: 5, comment: "เจ้าหน้าที่บริการดีมาก มีจุดคัดกรองและฉีดวัคซีนต่อเนื่อง รอไม่ถึง 10 นาที" },
    { score: 4, comment: "คนมาร่วมงานเยอะแต่ระบบคิวช่วยจัดระเบียบได้ดีมากครับ" },
    { score: 5, comment: "ประทับใจการฉีดวัคซีนไข้หวัดใหญ่ประจำปีมาก สะดวก ปลอดภัย" }
  ];

  const insertUser = db.prepare('INSERT OR REPLACE INTO users (id, citizen_id, full_name, phone, line_uid, role) VALUES (?, ?, ?, ?, ?, ?)');
  const insertQueue = db.prepare(`
    INSERT INTO queues (
      id, queue_number, patient_id, service_id, slot_id, booking_type, status,
      created_at, called_at, completed_at, preferred_time, is_fast_track, is_campaign,
      appointment_date, satisfaction_score, satisfaction_comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const slotTimes = [
    { slotId: 1, hour: 8, label: '08:30' },
    { slotId: 2, hour: 10, label: '10:30' },
    { slotId: 3, hour: 13, label: '13:00' },
    { slotId: 4, hour: 14, label: '14:30' }
  ];

  let seededCount = 0;
  const totalToCreate = campaignPatients.length; // 24 campaign queues (M0001 - M0024)

  for (let i = 0; i < totalToCreate; i++) {
    const p = campaignPatients[i];
    const existingUser = db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(p.cid) as any;
    const userId = existingUser?.id || randomUUID();
    insertUser.run(userId, p.cid, p.name, p.tel, p.uid, 'patient');

    const qNum = `M${(i + 1).toString().padStart(4, '0')}`;
    const slotInfo = slotTimes[i % slotTimes.length]; // Automatic load balancing across slots
    const isOnline = i % 3 !== 2; // ~67% Online booking for mass campaign
    const bookingType = isOnline ? 'Online' : 'Walk-in';
    const minute = ((i * 4 + 3) % 50).toString().padStart(2, '0');
    const createdIso = `${todayStr}T${slotInfo.hour.toString().padStart(2, '0')}:${minute}:00.000`;

    let status = 'Completed';
    let calledAt: string | null = null;
    let completedAt: string | null = null;
    let score: number | null = null;
    let comment: string | null = null;

    if (i < 15) {
      status = 'Completed';
      const calledDate = new Date(new Date(createdIso).getTime() + (6 + (i % 6)) * 60 * 1000);
      const completedDate = new Date(calledDate.getTime() + (4 + (i % 4)) * 60 * 1000);
      calledAt = calledDate.toISOString().replace('Z', '');
      completedAt = completedDate.toISOString().replace('Z', '');
      const rev = campaignReviews[i % campaignReviews.length];
      score = rev.score;
      comment = rev.comment;
    } else if (i === 15) {
      status = 'Calling';
      calledAt = getThailandTimeStr();
    } else if (i === 16) {
      status = 'In-progress';
      calledAt = new Date(Date.now() + 7 * 60 * 60 * 1000 - 3 * 60 * 1000).toISOString().replace('Z', '');
    } else {
      status = 'Waiting';
    }

    insertQueue.run(
      randomUUID(),
      qNum,
      userId,
      'service_campaign',
      slotInfo.slotId,
      bookingType,
      status,
      createdIso,
      calledAt,
      completedAt,
      isOnline ? slotInfo.label : '',
      i % 8 === 0 ? 1 : 0,
      1,
      todayStr,
      score,
      comment
    );
    seededCount++;
  }

  return seededCount;
}

// Run initial seed on server startup if database is empty
try {
  const seeded = seedRealisticAnalyticsData(false);
  const campaignSeeded = seedCampaignQueues(false);
  console.log(`[Database] Seeded ${seeded} realistic queues & ${campaignSeeded} health campaign queues.`);
} catch (e) {
  console.error('[Database] Seeding error:', e);
}

// In-memory cache for Thai TTS MP3 audio
const ttsCache = new Map<string, Buffer>();

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/tts", async (req, res) => {
  try {
    const rawText = String(req.query.text || '').trim();
    if (!rawText) {
      return res.status(400).json({ error: "Missing text parameter" });
    }
    const text = rawText.slice(0, 220);

    const cached = ttsCache.get(text);
    if (cached) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached);
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(text)}`;
    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to generate TTS audio" });
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    if (ttsCache.size >= 150) {
      const oldestKey = ttsCache.keys().next().value;
      if (oldestKey) ttsCache.delete(oldestKey);
    }
    ttsCache.set(text, audioBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(audioBuffer);
  } catch (err: any) {
    console.error('[TTS Error]:', err);
    return res.status(500).json({ error: err.message || "TTS Error" });
  }
});

app.get("/youtube-cover.jpg", (req, res) => {
  const filePath = path.join(process.cwd(), "public", "youtube-cover.jpg");
  if (req.query.download === "1") {
    return res.download(filePath, "ai-smart-q-connect-youtube-cover.jpg");
  }
  return res.sendFile(filePath);
});

app.post("/api/admin/seed-demo-data", (req, res) => {
  try {
    const count = seedRealisticAnalyticsData(true);
    const campaignCount = seedCampaignQueues(true);
    const io = app.get('io');
    if (io) {
      io.emit('queue_updated');
      io.emit('services_updated', db.prepare('SELECT * FROM services').all());
    }
    res.json({ success: true, count: count + campaignCount, message: `จำลองข้อมูลสถิติ ${count + campaignCount} รายการเรียบร้อยแล้ว` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to seed demo data" });
  }
});

app.post("/api/admin/seed-campaign-data", (req, res) => {
  try {
    const count = seedCampaignQueues(true);
    const updatedServices = db.prepare('SELECT * FROM services').all();
    const io = app.get('io');
    if (io) {
      io.emit('services_updated', updatedServices);
      io.emit('queue_updated');
    }
    res.json({ success: true, count, message: `จำลองคิวหมวดมหกรรมสุขภาพ ${count} คิว (M0001 - M${count.toString().padStart(4, '0')}) เรียบร้อยแล้ว` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to seed campaign data" });
  }
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
  const today = getThailandTimeStr().split('T')[0];
  const countStmt = db.prepare(`SELECT count(*) as count FROM queues WHERE service_id = ? AND date(created_at) = ?`);
  const { count } = countStmt.get(serviceId, today) as { count: number };
  
  const num = (count + 1).toString().padStart(4, '0');
  return `${prefix}${num}`;
}

function buildCompletedRatingLinePayload(queue: any) {
  const text = `✅ บริการเสร็จสิ้นเรียบร้อย (AI Smart Q Connect • รพ.สต.อัจฉริยะ)
• หมายเลขคิว: ${queue.queue_number}
• บริการ: ${queue.service_name}
👉 รพ.สต. ขอขอบพระคุณที่เข้ารับบริการ ขอให้ท่านมีสุขภาพแข็งแรง ปราศจากโรคภัยค่ะ

🌟 กดให้ดาวด้านล่าง หรือพิมพ์รีวิวตอบกลับในแชทนี้ได้เลยค่ะ (เช่น "5 ดาว บริการดีมาก") 👇`;

  const starButtons = [1, 2, 3, 4, 5].map((s) => ({
    type: 'button',
    style: 'secondary',
    height: 'sm',
    flex: 1,
    margin: s === 1 ? 'none' : 'xs',
    action: {
      type: 'postback',
      label: `${s}⭐`,
      data: `action=rate&qid=${queue.id}&score=${s}`,
      displayText: `ให้คะแนน ${s} ดาว`
    }
  }));

  const lineMessages = [
    {
      type: 'flex',
      altText: `✅ คิว ${queue.queue_number} เสร็จสิ้นแล้ว — กรุณากดให้ดาวและพิมพ์รีวิวในแชท LINE`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#0D9488',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: '✅ บริการเสร็จสิ้นเรียบร้อย',
              color: '#FFFFFF',
              weight: 'bold',
              size: 'md'
            },
            {
              type: 'text',
              text: 'AI Smart Q Connect • รพ.สต.อัจฉริยะ',
              color: '#CCFBF1',
              size: 'xs',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '16px',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'หมายเลขคิว', size: 'xs', color: '#64748B', flex: 2 },
                { type: 'text', text: String(queue.queue_number), size: 'sm', weight: 'bold', color: '#0F172A', align: 'end', flex: 3 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'บริการ', size: 'xs', color: '#64748B', flex: 2 },
                { type: 'text', text: String(queue.service_name), size: 'sm', weight: 'bold', color: '#0F172A', align: 'end', flex: 3, wrap: true }
              ]
            },
            { type: 'separator', margin: 'md' },
            {
              type: 'text',
              text: '🌟 กดให้ดาวความพึงพอใจในแชทนี้ได้เลย',
              size: 'xs',
              color: '#334155',
              wrap: true,
              margin: 'md',
              weight: 'bold'
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: starButtons
            },
            {
              type: 'text',
              text: 'หรือพิมพ์คะแนนพร้อมความคิดเห็นส่งมาในแชทนี้ได้เลย เช่น "5 ดาว พยาบาลใจดีมาก"',
              size: 'xxs',
              color: '#64748B',
              wrap: true,
              margin: 'xs'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: '12px',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#06C755',
              height: 'sm',
              action: {
                type: 'postback',
                label: '💬 เขียนความคิดเห็น / รีวิวในแชท',
                data: `action=prompt_comment&qid=${queue.id}`,
                displayText: 'เขียนความคิดเห็นเพิ่มเติม'
              }
            }
          ]
        }
      },
      quickReply: {
        items: [5, 4, 3, 2, 1].map((s) => ({
          type: 'action',
          action: {
            type: 'postback',
            label: '⭐'.repeat(s),
            data: `action=rate&qid=${queue.id}&score=${s}`,
            displayText: `ให้คะแนน ${s} ดาว`
          }
        }))
      }
    }
  ];

  return { text, lineMessages };
}

// Trigger LINE notification (simulated + real if token is provided)
async function triggerLineNotification(queue: any, action: 'Booked' | 'Calling' | 'Completed' | 'Skipped' | 'No-show' | 'Approaching' | 'Approaching_1hr') {
  if (!queue) return;
  
  // Get map link from settings
  const mapLinkRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'hospital_map_link'").get() as any;
  const mapLink = mapLinkRecord?.value || "";
  let text = "";
  const timeStr = new Date(queue.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  let lineMessages: any[] = [];
  
  if (action === 'Booked') {
    text = `📌 จองคิวสำเร็จ! (AI Smart Q Connect • รพ.สต.อัจฉริยะ)
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
       text += `\n👉 สามารถตรวจสอบสถานะคิวของคุณได้ทางสมาร์ทโฟน\n👉 กรุณามาถึงก่อนเวลาที่จะถึงคิวอย่างน้อย 30 นาที`;
    }
  } else if (action === 'Calling') {
    text = `📣 ประกาศเรียกคิวรับบริการ! (AI Smart Q Connect • รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n• ชื่อคนไข้: ${queue.full_name}\n👉 กรุณาเข้าพบเจ้าหน้าที่ ณ จุดคัดกรองหรือห้องตรวจทันทีค่ะ`;
  } else if (action === 'Completed') {
    if (queue.line_uid && String(queue.line_uid).trim() !== '') {
      try {
        db.prepare(`
          INSERT OR REPLACE INTO line_pending_reviews (line_uid, queue_id, stage, updated_at)
          VALUES (?, ?, 'awaiting_rating', ?)
        `).run(String(queue.line_uid).trim(), queue.id, getThailandTimeStr());
      } catch (e) {
        console.error('Failed to record line_pending_reviews:', e);
      }
    }

    const built = buildCompletedRatingLinePayload(queue);
    text = built.text;
    lineMessages = built.lineMessages;
  } else if (action === 'Skipped') {
    text = `⚠️ แจ้งเตือนการข้ามคิว (AI Smart Q Connect • รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n👉 เนื่องจากพยาบาลเรียกคิวแล้วไม่พบท่าน คิวจึงถูกข้ามชั่วคราว กรุณาติดต่อเคาน์เตอร์พยาบาลค่ะ`;
  } else if (action === 'No-show') {
    text = `🚨 แจ้งเตือน: คุณขาดนัด${queue.service_name} (AI Smart Q Connect • รพ.สต.)\n• หมายเลขคิว: ${queue.queue_number}\n👉 ท่านไม่ได้มาแสดงตัวตามนัดหมายในวันนี้ กรุณาติดต่อสายด่วน รพ.สต. เพื่อนัดหมายใหม่ หรือรับยาป้องกันการขาดยาค่ะ`;
  } else if (action === 'Approaching') {
    text = `⏳ ใกล้ถึงคิวของท่านแล้ว! (AI Smart Q Connect • รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n👉 อีกประมาณ ${queue.people_in_front || 0} คิว (รอประมาณ ${queue.estimated_wait_time || 0} นาที) จะถึงคิวของท่าน กรุณาเตรียมตัวบริเวณจุดรอพักค่ะ`;
  } else if (action === 'Approaching_1hr') {
    text = `⏰ แจ้งเตือนล่วงหน้า 1 ชั่วโมง (AI Smart Q Connect • รพ.สต.อัจฉริยะ)\n• หมายเลขคิว: ${queue.queue_number}\n• บริการ: ${queue.service_name}\n• เวลาที่นัดหมาย: ${queue.preferred_time}\n👉 กรุณามาถึงก่อนเวลาที่จะถึงคิวอย่างน้อย 30 นาที เพื่อเตรียมตัวคัดกรองเบื้องต้นค่ะ`;
  }


  if (lineMessages.length === 0) {
    lineMessages = [{ type: 'text', text }];
  }

  // Save notification log in SQLite for UI Real-time Simulation Feed
  const logId = randomUUID();
  const now = getThailandTimeStr();
  try {
    db.prepare(`
      INSERT INTO line_logs (id, queue_id, queue_number, message, sender, created_at)
      VALUES (?, ?, ?, ?, 'bot', ?)
    `).run(logId, queue.id, queue.queue_number, text, now);
  } catch (dbErr) {
    console.error('Error inserting line_logs:', dbErr);
  }

  const socketLog = {
    id: logId,
    queue_id: queue.id,
    queue_number: queue.queue_number,
    message: text,
    sender: 'bot',
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
    const cat = (tokenRecord?.value || process.env.LINE_CHANNEL_ACCESS_TOKEN || "").trim();

    if (cat !== "") {
      const headers = {
        'Authorization': `Bearer ${cat}`,
        'Content-Type': 'application/json'
      };

      const adminUidRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_admin_uid'").get() as any;
      const adminUid = (adminUidRecord?.value || "").trim();
      const recipientUid = (queue.line_uid || "").trim();
      const sentTargets = new Set<string>();

      const pushToUid = async (targetUid: string, label: string) => {
        if (!targetUid || targetUid.length < 10 || sentTargets.has(targetUid)) return;
        sentTargets.add(targetUid);
        console.log(`[LINE Messaging API] Sending PUSH message to ${label}: ${targetUid}`);
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: targetUid,
            messages: lineMessages
          })
        });
        const resData = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.error(`[LINE Messaging API] Push Error (${label}):`, response.status, resData);
        } else {
          console.log(`[LINE Messaging API] Push Success (${label}):`, resData);
        }
      };

      // 1. Send directly to patient if they have a valid LINE UID
      await pushToUid(recipientUid, 'patient');

      // 2. Also send a copy to Admin LINE User ID if configured (for admin visibility / testing)
      await pushToUid(adminUid, 'admin');

      // 3. Or broadcast to all friends if enabled and no direct target received the message
      const broadcastRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_enable_broadcast'").get() as any;
      const enableBroadcast = broadcastRecord?.value === 'true';
      if (enableBroadcast && sentTargets.size === 0) {
        console.log(`[LINE Messaging API] Broadcasting message to all friends`);
        const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: lineMessages
          })
        });
        const resData = await response.json().catch(() => ({}));
        console.log('[LINE Messaging API] Broadcast Response:', response.status, resData);
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
  
  if (isCampaign) {
    const campaignStartRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'campaign_start_date'").get() as any;
    const campaignEndRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'campaign_end_date'").get() as any;
    const campStart = campaignStartRecord?.value || getThailandTimeStr().split('T')[0];
    const campEnd = campaignEndRecord?.value;

    const checkDate = appointment_date || getThailandTimeStr().split('T')[0];
    if (checkDate < campStart) {
       return res.status(400).json({ error: `ไม่สามารถจองคิวนอกเวลาที่กำหนดได้ (เปิดจองตั้งแต่ ${campStart})` });
    }
    if (campEnd && checkDate > campEnd) {
       return res.status(400).json({ error: `ไม่สามารถจองคิวนอกเวลาที่กำหนดได้ (สิ้นสุดการจอง ${campEnd})` });
    }
  }
  
  // For Mass Campaign Booking, do automatic load balancing if slot isn't specifically provided
  if (isCampaign && !validSlotId) {
    const today = getThailandTimeStr().split('T')[0];
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
    const today = getThailandTimeStr().split('T')[0];
    const checkDate = appointment_date || today;
    const slotData = db.prepare('SELECT capacity FROM time_slots WHERE id = ?').get(validSlotId) as { capacity: number };
    const currentBookings = db.prepare('SELECT count(*) as count FROM queues WHERE slot_id = ? AND (date(created_at) = ? OR appointment_date = ?)').get(validSlotId, checkDate, checkDate) as { count: number };
    
    if (slotData && currentBookings.count >= slotData.capacity) {
      return res.status(400).json({ error: "รอบบริการนี้เต็มแล้ว กรุณาเลือกรอบอื่น" });
    }
  }

  // Find or create user
  const incomingLineUid = typeof line_uid === 'string' ? line_uid.trim() : '';
  let user = db.prepare('SELECT id, line_uid FROM users WHERE citizen_id = ?').get(citizen_id) as any;
  if (!user) {
    const userId = randomUUID();
    db.prepare('INSERT INTO users (id, citizen_id, full_name, phone, line_uid, role) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, citizen_id, full_name, phone, incomingLineUid, role || 'patient');
    user = { id: userId };
  } else {
    // Update name/phone and preserve existing line_uid if incoming is blank
    const preservedLineUid = incomingLineUid || user.line_uid || '';
    db.prepare('UPDATE users SET full_name = ?, phone = ?, line_uid = ? WHERE id = ?')
      .run(full_name, phone, preservedLineUid, user.id);
  }

  const queueId = randomUUID();
  const fastTrackVal = is_fast_track ? 1 : 0;
  const queueNumber = generateQueueNumber(service_id, fastTrackVal === 1);
  const now = getThailandTimeStr();
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
  const today = getThailandTimeStr().split('T')[0];
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
  const today = getThailandTimeStr().split('T')[0];
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
  const now = getThailandTimeStr();

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
    const today = updatedQueue.appointment_date || getThailandTimeStr().split('T')[0];
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

app.post("/api/queues/:id/rate", (req, res) => {
  const { id } = req.params;
  const rawScore = Number(req.body?.score);
  const comment = req.body?.comment;

  if (!Number.isInteger(rawScore) || rawScore < 1 || rawScore > 5) {
    return res.status(400).json({ error: "กรุณาระบุคะแนนประเมินตั้งแต่ 1 ถึง 5 ดาว" });
  }

  const existing = db.prepare('SELECT id, completed_at, satisfaction_comment FROM queues WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: "ไม่พบรายการคิวนี้ในระบบ" });
  }

  const cleanComment = typeof comment === 'string'
    ? (comment.trim() || null)
    : existing.satisfaction_comment;
  const completedAt = existing.completed_at || getThailandTimeStr();

  db.prepare('UPDATE queues SET satisfaction_score = ?, satisfaction_comment = ?, completed_at = ? WHERE id = ?')
    .run(rawScore, cleanComment, completedAt, id);

  const updatedQueue = getQueueDetails(id);
  const io = app.get('io');
  if (io && updatedQueue) {
    io.emit('queue_updated', updatedQueue);
  }
  res.json(updatedQueue);
});

function parseLineReviewText(rawText: string): { score: number | null; comment: string | null } {
  const trimmed = rawText.trim();
  if (!trimmed) return { score: null, comment: null };

  // Match leading star emojis (e.g. "⭐⭐⭐⭐⭐ ดีมาก")
  const starEmojiMatch = trimmed.match(/^(⭐{1,5})\s*(.*)$/s);
  if (starEmojiMatch) {
    const score = starEmojiMatch[1].length;
    const comment = starEmojiMatch[2].trim() || null;
    return { score, comment };
  }

  // Match explicit numeric rating prefix like "5 ดาว บริการดี", "5/5 บริการดี", "5 คะแนน ...", or "5 ..."
  const numMatch = trimmed.match(/^([1-5])(?:\s*\/\s*5|\s*(?:ดาว|คะแนน))?(?:[\s:,\-]+(.*))?$/s);
  if (numMatch) {
    const score = parseInt(numMatch[1], 10);
    const comment = (numMatch[2] || '').trim() || null;
    return { score, comment };
  }

  return { score: null, comment: trimmed };
}

function recordLineLog(queueId: string | null, queueNumber: string | null, message: string, sender: 'bot' | 'user') {
  const id = randomUUID();
  const now = getThailandTimeStr();
  try {
    db.prepare(`
      INSERT INTO line_logs (id, queue_id, queue_number, message, sender, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, queueId, queueNumber, message, sender, now);
  } catch (e) {
    console.error('Failed inserting line log:', e);
  }
  const io = app.get('io');
  if (io) {
    io.emit('line_notification', {
      id,
      queue_id: queueId,
      queue_number: queueNumber,
      message,
      sender,
      created_at: now
    });
  }
}

async function sendLineReply(replyToken: string, messages: any[]) {
  if (!replyToken) return;
  try {
    const tokenRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_channel_access_token'").get() as any;
    const cat = tokenRecord?.value || process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    if (!cat || cat.trim() === "") return;

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cat.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ replyToken, messages })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('[LINE Webhook Reply Error]:', errData);
    }
  } catch (err) {
    console.error('[LINE Webhook Reply Exception]:', err);
  }
}

app.post("/api/line/webhook", async (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const io = app.get('io');

  for (const event of events) {
    try {
      const userId = event?.source?.userId || "";
      const replyToken = event?.replyToken || "";

      if (event?.type === 'postback' && event?.postback?.data) {
        const params = new URLSearchParams(event.postback.data);
        const action = params.get('action');
        const qid = params.get('qid') || "";

        if (action === 'rate' && qid) {
          const score = Number(params.get('score'));
          const existing = db.prepare('SELECT id, queue_number, completed_at, satisfaction_comment FROM queues WHERE id = ?').get(qid) as any;
          if (existing && Number.isInteger(score) && score >= 1 && score <= 5) {
            const completedAt = existing.completed_at || getThailandTimeStr();
            db.prepare('UPDATE queues SET satisfaction_score = ?, completed_at = ? WHERE id = ?')
              .run(score, completedAt, qid);

            const updatedQueue = getQueueDetails(qid);
            if (io && updatedQueue) io.emit('queue_updated', updatedQueue);

            if (userId) {
              db.prepare(`
                INSERT OR REPLACE INTO line_pending_reviews (line_uid, queue_id, stage, updated_at)
                VALUES (?, ?, 'awaiting_comment', ?)
              `).run(userId, qid, getThailandTimeStr());
            }

            const replyMsg = existing.satisfaction_comment
              ? `🌟 ขอบคุณสำหรับการประเมิน ${score}/5 ดาว (คิว ${existing.queue_number}) พร้อมความคิดเห็น "${existing.satisfaction_comment}" ค่ะ สามารถพิมพ์แก้ไขความคิดเห็นเพิ่มเติมได้นะคะ`
              : `🌟 บันทึกคะแนน ${score}/5 ดาว สำหรับคิว ${existing.queue_number} เรียบร้อยแล้วค่ะ!\n💬 ท่านสามารถพิมพ์ข้อเสนอแนะหรือคำติชมตอบกลับในแชทนี้ได้เลยนะคะ`;

            recordLineLog(qid, existing.queue_number, replyMsg, 'bot');
            await sendLineReply(replyToken, [
              {
                type: 'text',
                text: replyMsg,
                quickReply: {
                  items: [
                    {
                      type: 'action',
                      action: {
                        type: 'postback',
                        label: 'ไม่ระบุคอมเมนต์',
                        data: `action=skip_comment&qid=${qid}`,
                        displayText: 'ไม่ระบุคอมเมนต์'
                      }
                    }
                  ]
                }
              }
            ]);
          }
        } else if (action === 'prompt_comment' && qid) {
          const existing = db.prepare('SELECT id, queue_number, satisfaction_score FROM queues WHERE id = ?').get(qid) as any;
          if (existing) {
            if (userId) {
              db.prepare(`
                INSERT OR REPLACE INTO line_pending_reviews (line_uid, queue_id, stage, updated_at)
                VALUES (?, ?, ?, ?)
              `).run(userId, qid, existing.satisfaction_score ? 'awaiting_comment' : 'awaiting_rating', getThailandTimeStr());
            }

            const promptMsg = existing.satisfaction_score
              ? `💬 เชิญพิมพ์ความคิดเห็นเพิ่มเติมสำหรับคิว ${existing.queue_number} (คะแนน ${existing.satisfaction_score}/5 ดาว) ในแชทนี้ได้เลยค่ะ`
              : `💬 เชิญพิมพ์ความคิดเห็นหรือข้อเสนอแนะสำหรับคิว ${existing.queue_number} ในแชทนี้ได้เลยค่ะ (หรือพิมพ์พร้อมดาว เช่น "5 ดาว บริการดีมาก")`;

            recordLineLog(qid, existing.queue_number, promptMsg, 'bot');
            await sendLineReply(replyToken, [
              {
                type: 'text',
                text: promptMsg,
                ...(existing.satisfaction_score
                  ? {}
                  : {
                      quickReply: {
                        items: [5, 4, 3, 2, 1].map((s) => ({
                          type: 'action',
                          action: {
                            type: 'postback',
                            label: '⭐'.repeat(s),
                            data: `action=rate&qid=${qid}&score=${s}`,
                            displayText: `ให้คะแนน ${s} ดาว`
                          }
                        }))
                      }
                    })
              }
            ]);
          }
        } else if (action === 'skip_comment') {
          if (userId) {
            db.prepare('DELETE FROM line_pending_reviews WHERE line_uid = ?').run(userId);
          }
          const thanksMsg = '🙏 ขอบพระคุณสำหรับคะแนนประเมินค่ะ ขอให้ท่านมีสุขภาพแข็งแรงนะคะ';
          recordLineLog(qid || null, null, thanksMsg, 'bot');
          await sendLineReply(replyToken, [{ type: 'text', text: thanksMsg }]);
        }
      } else if (event?.type === 'message' && event?.message?.type === 'text') {
        const rawText = String(event.message.text || '').trim();
        if (!rawText) continue;

        const parsed = parseLineReviewText(rawText);
        let targetQueueId: string | null = null;
        let pendingStage: string | null = null;

        if (userId) {
          const pending = db.prepare('SELECT queue_id, stage FROM line_pending_reviews WHERE line_uid = ?').get(userId) as any;
          if (pending?.queue_id) {
            targetQueueId = pending.queue_id;
            pendingStage = pending.stage;
          } else {
            const latestQueue = db.prepare(`
              SELECT q.id FROM queues q
              JOIN users u ON q.patient_id = u.id
              WHERE u.line_uid = ? AND q.status = 'Completed'
              ORDER BY COALESCE(q.completed_at, q.created_at) DESC
              LIMIT 1
            `).get(userId) as any;
            if (latestQueue?.id) {
              targetQueueId = latestQueue.id;
              pendingStage = 'fallback';
            } else if (parsed.score !== null) {
              const latestCompletedAny = db.prepare(`
                SELECT id FROM queues
                WHERE status = 'Completed'
                ORDER BY COALESCE(completed_at, created_at) DESC
                LIMIT 1
              `).get() as any;
              if (latestCompletedAny?.id) {
                targetQueueId = latestCompletedAny.id;
                pendingStage = 'explicit_star';
              }
            }
          }
        }

        if (!targetQueueId) continue;

        const existing = db.prepare('SELECT id, queue_number, completed_at, satisfaction_score, satisfaction_comment FROM queues WHERE id = ?').get(targetQueueId) as any;
        if (!existing) continue;

        if (pendingStage === 'fallback' && parsed.score === null) {
          continue;
        }

        recordLineLog(existing.id, existing.queue_number, rawText, 'user');

        const finalScore = parsed.score ?? existing.satisfaction_score;
        const finalComment = parsed.comment !== null ? parsed.comment : existing.satisfaction_comment;
        const completedAt = existing.completed_at || getThailandTimeStr();

        if (finalScore && Number.isInteger(finalScore) && finalScore >= 1 && finalScore <= 5) {
          db.prepare('UPDATE queues SET satisfaction_score = ?, satisfaction_comment = ?, completed_at = ? WHERE id = ?')
            .run(finalScore, finalComment || null, completedAt, existing.id);

          const updatedQueue = getQueueDetails(existing.id);
          if (io && updatedQueue) io.emit('queue_updated', updatedQueue);

          if (userId) {
            db.prepare('DELETE FROM line_pending_reviews WHERE line_uid = ?').run(userId);
          }

          const replyMsg = finalComment
            ? `🙏 ขอบพระคุณสำหรับรีวิวคิว ${existing.queue_number} ค่ะ!\n⭐ คะแนน: ${finalScore}/5 ดาว\n💬 ความคิดเห็น: "${finalComment}"`
            : `🙏 ขอบพระคุณสำหรับการประเมิน ${finalScore}/5 ดาว สำหรับคิว ${existing.queue_number} ค่ะ\n💬 สามารถพิมพ์ความคิดเห็นเพิ่มเติมต่อได้เลยนะคะ`;

          recordLineLog(existing.id, existing.queue_number, replyMsg, 'bot');
          await sendLineReply(replyToken, [{ type: 'text', text: replyMsg }]);
        } else if (parsed.comment) {
          db.prepare('UPDATE queues SET satisfaction_comment = ?, completed_at = ? WHERE id = ?')
            .run(parsed.comment, completedAt, existing.id);

          const updatedQueue = getQueueDetails(existing.id);
          if (io && updatedQueue) io.emit('queue_updated', updatedQueue);

          const promptStarsMsg = `💬 บันทึกความคิดเห็น "${parsed.comment}" เรียบร้อยค่ะ\n🌟 รบกวนกดเลือกดาวด้านล่าง (1-5 ดาว) เพื่อบันทึกคะแนนให้ครบถ้วนนะคะ`;
          recordLineLog(existing.id, existing.queue_number, promptStarsMsg, 'bot');
          await sendLineReply(replyToken, [
            {
              type: 'text',
              text: promptStarsMsg,
              quickReply: {
                items: [5, 4, 3, 2, 1].map((s) => ({
                  type: 'action',
                  action: {
                    type: 'postback',
                    label: `${s}⭐`,
                    data: `action=rate&qid=${existing.id}&score=${s}`,
                    displayText: `ให้คะแนน ${s} ดาว`
                  }
                }))
              }
            }
          ]);
        }
      }
    } catch (eventErr) {
      console.error('[LINE Webhook Event Error]:', eventErr);
    }
  }

  return res.status(200).json({ status: 'ok' });
});

app.post("/api/line/simulate-reply", (req, res) => {
  const rawText = String(req.body?.text || '').trim();
  let queueId = req.body?.queue_id ? String(req.body.queue_id) : '';

  if (!rawText) {
    return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความหรือรีวิว' });
  }

  if (!queueId) {
    const latestCompleted = db.prepare(`
      SELECT id FROM queues
      WHERE status = 'Completed'
      ORDER BY COALESCE(completed_at, created_at) DESC
      LIMIT 1
    `).get() as any;
    queueId = latestCompleted?.id || '';
  }

  if (!queueId) {
    return res.status(404).json({ error: 'ยังไม่มีคิวที่เสร็จสิ้นสำหรับให้คะแนนรีวิว' });
  }

  const existing = db.prepare('SELECT id, queue_number, completed_at, satisfaction_score, satisfaction_comment FROM queues WHERE id = ?').get(queueId) as any;
  if (!existing) {
    return res.status(404).json({ error: 'ไม่พบคิวที่ระบุ' });
  }

  recordLineLog(existing.id, existing.queue_number, rawText, 'user');

  const parsed = parseLineReviewText(rawText);
  const finalScore = parsed.score ?? existing.satisfaction_score;
  const finalComment = parsed.comment !== null ? parsed.comment : existing.satisfaction_comment;
  const completedAt = existing.completed_at || getThailandTimeStr();
  const io = app.get('io');

  if (finalScore && Number.isInteger(finalScore) && finalScore >= 1 && finalScore <= 5) {
    db.prepare('UPDATE queues SET satisfaction_score = ?, satisfaction_comment = ?, completed_at = ? WHERE id = ?')
      .run(finalScore, finalComment || null, completedAt, existing.id);

    const updatedQueue = getQueueDetails(existing.id);
    if (io && updatedQueue) io.emit('queue_updated', updatedQueue);

    const replyMsg = finalComment
      ? `🙏 ขอบพระคุณสำหรับรีวิวคิว ${existing.queue_number} ค่ะ!\n⭐ คะแนน: ${finalScore}/5 ดาว\n💬 ความคิดเห็น: "${finalComment}"`
      : `🙏 ขอบพระคุณสำหรับการประเมิน ${finalScore}/5 ดาว สำหรับคิว ${existing.queue_number} ค่ะ`;
    recordLineLog(existing.id, existing.queue_number, replyMsg, 'bot');

    return res.json({ success: true, queue: updatedQueue, score: finalScore, comment: finalComment });
  }

  if (parsed.comment) {
    db.prepare('UPDATE queues SET satisfaction_comment = ?, completed_at = ? WHERE id = ?')
      .run(parsed.comment, completedAt, existing.id);
    const updatedQueue = getQueueDetails(existing.id);
    if (io && updatedQueue) io.emit('queue_updated', updatedQueue);

    const replyMsg = `💬 บันทึกความคิดเห็น "${parsed.comment}" แล้วค่ะ รบกวนระบุคะแนนดาวด้วยนะคะ (เช่น "5 ดาว" หรือกดดาวด้านบน)`;
    recordLineLog(existing.id, existing.queue_number, replyMsg, 'bot');
    return res.json({ success: true, queue: updatedQueue, needsScore: true });
  }

  return res.json({ success: true });
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
    const cat = String(req.body?.cat || '').trim();
    const uid = String(req.body?.uid || '').trim();
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
        messages: [{ type: 'text', text: '🔔 ทดสอบระบบแจ้งเตือนจาก AI Smart Q Connect!\nหากคุณได้รับข้อความนี้ แสดงว่าการเชื่อมต่อ LINE Messaging API สำเร็จและพร้อมใช้งานแล้วค่ะ' }]
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

app.post("/api/settings/test-line-rating", async (req, res) => {
  try {
    const tokenRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_channel_access_token'").get() as any;
    const adminRecord = db.prepare("SELECT value FROM system_settings WHERE key = 'line_admin_uid'").get() as any;
    const cat = String(req.body?.cat || tokenRecord?.value || process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
    const uid = String(req.body?.uid || adminRecord?.value || '').trim();

    if (!cat || !uid) {
      return res.status(400).json({ error: "กรุณาระบุ Channel Access Token และ Admin User ID ก่อนส่งการ์ดให้ดาวทดสอบ" });
    }

    // Persist credentials so follow-up webhook clicks work seamlessly
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('line_channel_access_token', ?)").run(cat);
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('line_admin_uid', ?)").run(uid);

    // Ensure there is a real Completed queue associated with this test for rating & analytics
    const now = getThailandTimeStr();
    let user = db.prepare('SELECT id FROM users WHERE line_uid = ?').get(uid) as any;
    if (!user) {
      const userId = randomUUID();
      db.prepare('INSERT INTO users (id, citizen_id, full_name, phone, line_uid, role) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, '0000000000000', 'ผู้ทดสอบระบบรีวิว LINE', '0800000000', uid, 'patient');
      user = { id: userId };
    }

    const queueId = randomUUID();
    const queueNumber = generateQueueNumber('service_1', false);
    db.prepare(`
      INSERT INTO queues (id, queue_number, patient_id, service_id, booking_type, status, created_at, called_at, completed_at, appointment_date)
      VALUES (?, ?, ?, 'service_1', 'Online', 'Completed', ?, ?, ?, ?)
    `).run(queueId, queueNumber, user.id, now, now, now, now.split('T')[0]);

    const testQueue = getQueueDetails(queueId);
    const io = app.get('io');
    if (io && testQueue) io.emit('queue_updated', testQueue);

    db.prepare(`
      INSERT OR REPLACE INTO line_pending_reviews (line_uid, queue_id, stage, updated_at)
      VALUES (?, ?, 'awaiting_rating', ?)
    `).run(uid, queueId, now);

    const { text, lineMessages } = buildCompletedRatingLinePayload(testQueue);
    recordLineLog(queueId, queueNumber, text, 'bot');

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: uid,
        messages: lineMessages
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: `LINE API Error: ${data.message || 'Unknown error'}`,
        details: data.details || []
      });
    }

    return res.json({
      success: true,
      queue_number: queueNumber,
      message: `ส่งการ์ดให้ดาวและรีวิวสำหรับคิว ${queueNumber} ไปยัง LINE ของคุณแล้ว! ลองกดดาวหรือพิมพ์คอมเมนต์ในแชท LINE ได้เลย`
    });
  } catch (err: any) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
});

function normalizeLiffId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/liff\.line\.me\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  return trimmed.split(/[?#/\s]/)[0] || '';
}

app.post("/api/settings", async (req, res) => {
  const { line_channel_access_token, line_liff_id, line_admin_uid, line_enable_broadcast, service_open_time, service_close_time, hospital_lat, hospital_lng, hospital_map_link, campaign_capacity, campaign_title, campaign_desc, campaign_start_date, campaign_end_date } = req.body;
  
  const currentLat = (db.prepare("SELECT value FROM system_settings WHERE key = 'hospital_lat'").get() as any)?.value || "13.7563";
  const currentLng = (db.prepare("SELECT value FROM system_settings WHERE key = 'hospital_lng'").get() as any)?.value || "100.5018";
  let resolvedLat = hospital_lat !== undefined ? String(hospital_lat) : currentLat;
  let resolvedLng = hospital_lng !== undefined ? String(hospital_lng) : currentLng;

  if (hospital_map_link) {
    let targetUrl = hospital_map_link.trim();
    // 1. Resolve short Google Maps link to long URL
    if (targetUrl.includes("maps.app.goo.gl") || targetUrl.includes("goo.gl/maps")) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch(targetUrl, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        clearTimeout(timeoutId);
        targetUrl = response.url;
        console.log("Resolved short maps link to:", targetUrl);
      } catch (e) {
        console.error("Failed to resolve short map link:", e);
      }
    }

    // 2. Extract coordinates
    const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = targetUrl.match(coordRegex);
    if (match) {
      resolvedLat = match[1];
      resolvedLng = match[2];
    } else {
      const qRegex = /[?&](q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
      const qMatch = targetUrl.match(qRegex);
      if (qMatch) {
        resolvedLat = qMatch[2];
        resolvedLng = qMatch[3];
      } else {
        const pathRegex = /\/(-?\d+\.\d+),(-?\d+\.\d+)/;
        const pathMatch = targetUrl.match(pathRegex);
        if (pathMatch) {
          resolvedLat = pathMatch[1];
          resolvedLng = pathMatch[2];
        }
      }
    }
  }

  try {
    const upsertSetting = db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)");
    if (line_channel_access_token !== undefined) {
      upsertSetting.run('line_channel_access_token', String(line_channel_access_token).trim());
    }
    if (line_liff_id !== undefined) {
      upsertSetting.run('line_liff_id', normalizeLiffId(String(line_liff_id)));
    }
    if (line_admin_uid !== undefined) {
      upsertSetting.run('line_admin_uid', String(line_admin_uid).trim());
    }
    if (line_enable_broadcast !== undefined) {
      upsertSetting.run('line_enable_broadcast', String(line_enable_broadcast));
    }
    if (service_open_time !== undefined) {
      upsertSetting.run('service_open_time', String(service_open_time) || "08:30");
    }
    if (service_close_time !== undefined) {
      upsertSetting.run('service_close_time', String(service_close_time) || "16:30");
    }
    if (hospital_lat !== undefined || hospital_map_link !== undefined) {
      upsertSetting.run('hospital_lat', resolvedLat);
    }
    if (hospital_lng !== undefined || hospital_map_link !== undefined) {
      upsertSetting.run('hospital_lng', resolvedLng);
    }
    if (hospital_map_link !== undefined) {
      upsertSetting.run('hospital_map_link', String(hospital_map_link) || "");
    }
    if (campaign_capacity !== undefined) {
      upsertSetting.run('campaign_capacity', String(campaign_capacity));
    }
    if (campaign_title !== undefined) {
      upsertSetting.run('campaign_title', String(campaign_title));
    }
    if (campaign_desc !== undefined) {
      upsertSetting.run('campaign_desc', String(campaign_desc));
    }
    if (campaign_start_date !== undefined) {
      upsertSetting.run('campaign_start_date', String(campaign_start_date));
    }
    if (campaign_end_date !== undefined) {
      upsertSetting.run('campaign_end_date', String(campaign_end_date));
    }

    const readVal = (key: string, fallback = "") =>
      (db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key) as any)?.value ?? fallback;

    const settingsObj = {
      line_channel_access_token: readVal('line_channel_access_token'),
      line_liff_id: readVal('line_liff_id'),
      line_admin_uid: readVal('line_admin_uid'),
      line_enable_broadcast: readVal('line_enable_broadcast', 'false'),
      service_open_time: readVal('service_open_time', '08:30'),
      service_close_time: readVal('service_close_time', '16:30'),
      hospital_lat: readVal('hospital_lat', resolvedLat),
      hospital_lng: readVal('hospital_lng', resolvedLng),
      hospital_map_link: readVal('hospital_map_link'),
      campaign_capacity: readVal('campaign_capacity', '500'),
      campaign_title: readVal('campaign_title', 'มหกรรมสุขภาพ / ฉีดวัคซีน'),
      campaign_desc: readVal('campaign_desc'),
      campaign_start_date: readVal('campaign_start_date'),
      campaign_end_date: readVal('campaign_end_date')
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
  const { start, end } = req.query as { start?: string, end?: string };
  const todayStr = getThailandTimeStr().split('T')[0];
  const startDate = start || todayStr;
  const endDate = end || todayStr;
  
  const dailyStats = db.prepare(`
    SELECT 
      count(*) as total,
      sum(case when booking_type = 'Online' then 1 else 0 end) as online,
      sum(case when booking_type = 'Walk-in' then 1 else 0 end) as walkin
    FROM queues 
    WHERE date(created_at) >= ? AND date(created_at) <= ?
  `).get(startDate, endDate);

  const serviceStats = db.prepare(`
    SELECT s.service_name as name, count(*) as value
    FROM queues q
    JOIN services s ON q.service_id = s.id
    WHERE date(q.created_at) >= ? AND date(q.created_at) <= ?
    GROUP BY q.service_id
  `).all(startDate, endDate);

  // Peak times (hourly grouping)
  const peakTimes = db.prepare(`
    SELECT strftime('%H:00', created_at) as hour, count(*) as count
    FROM queues
    WHERE date(created_at) >= ? AND date(created_at) <= ?
    GROUP BY strftime('%H', created_at)
  `).all(startDate, endDate);

  // Average wait time (in minutes) for completed queues
  const waitTime = db.prepare(`
    SELECT 
      avg((julianday(called_at) - julianday(created_at)) * 24 * 60) as avg_wait_mins
    FROM queues
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND status IN ('Completed') AND called_at IS NOT NULL
  `).get(startDate, endDate) as any;

  // Average satisfaction score (1-5 to percentage)
  const satisfaction = db.prepare(`
    SELECT avg(satisfaction_score) as avg_score
    FROM queues
    WHERE date(created_at) >= ? AND date(created_at) <= ? AND satisfaction_score IS NOT NULL
  `).get(startDate, endDate) as any;
  const avgSatisfacton = satisfaction?.avg_score || 0;
  const satisfactionPercentage = avgSatisfacton > 0 ? Math.round((avgSatisfacton / 5) * 100) : 0;

  const reviews = db.prepare(`
    SELECT q.id, q.queue_number, q.satisfaction_score, q.satisfaction_comment, COALESCE(q.completed_at, q.created_at) as completed_at, u.full_name, s.service_name, s.color_code
    FROM queues q
    JOIN users u ON q.patient_id = u.id
    JOIN services s ON q.service_id = s.id
    WHERE q.satisfaction_score IS NOT NULL AND date(q.created_at) >= ? AND date(q.created_at) <= ?
    ORDER BY COALESCE(q.completed_at, q.created_at) DESC
  `).all(startDate, endDate) as any[];

  const fallbackComments: Record<number, string[]> = {
    5: [
      "บริการดีเยี่ยม รวดเร็วทันใจมากค่ะ",
      "คุณพยาบาลและคุณหมอพูดจาไพเราะ แนะนำดีมาก",
      "สะดวกสบาย ระบบจองคิวออนไลน์ใช้อย่างมีประสิทธิภาพสุดๆ",
      "คิวเดินเร็วมาก มีการจัดระบบรักษาระยะห่างที่ดี",
      "คุณหมอให้คำแนะนำละเอียด ใจดีมากๆ เลยครับ"
    ],
    4: [
      "บริการดี สะดวก รวดเร็วดีมากค่ะ",
      "ระบบจองช่วงนี้ทำงานได้เร็ว ไม่ต้องรอคิวนาน",
      "สถานที่สะอาดเรียบร้อย เจ้าหน้าที่บริการดี",
      "สะดวกประหยัดเวลาเดินทางไปเยอะเลย"
    ],
    3: [
      "คนค่อนข้างเยอะเลยรอนานนิดนึง แต่บริการดีตามมาตรฐานค่ะ",
      "ที่นั่งรอน้อยไปหน่อย แต่เจ้าหน้าที่ก็บริการสุภาพ"
    ],
    2: [
      "อยากให้เพิ่มจำนวนเจ้าหน้าที่ช่วงวันหยุด บริการล่าช้าไปนิดค่ะ"
    ],
    1: [
      "รอนานเกินไป ระบบแจ้งเตือนควรปรับปรุงให้แจ้งเตือนเร็วกว่านี้ค่ะ"
    ]
  };

  const processedReviews = reviews.map((r, idx) => {
    let comment = r.satisfaction_comment;
    if (!comment) {
      const score = r.satisfaction_score || 5;
      const list = fallbackComments[score] || ["บริการดีมากครับ"];
      const selectIdx = (r.id ? r.id.charCodeAt(r.id.length - 1) : idx) % list.length;
      comment = list[selectIdx];
    }
    return {
      ...r,
      satisfaction_comment: comment
    };
  });

  res.json({
    dailyStats,
    serviceStats,
    peakTimes,
    avgWaitTimeMins: Math.round(waitTime?.avg_wait_mins || 0),
    satisfactionPercentage,
    reviews: processedReviews
  });
});

app.get("/api/admin/no-shows", (req, res) => {
  try {
    const list = db.prepare(`
      SELECT q.*, u.full_name, u.citizen_id, u.phone, u.line_uid, s.service_name, s.color_code, s.estimated_minutes
      FROM queues q
      JOIN users u ON q.patient_id = u.id
      JOIN services s ON q.service_id = s.id
      WHERE q.status = 'No-show'
      ORDER BY q.created_at DESC
    `).all() as any[];

    const totalCount = list.length;
    const onlineCount = list.filter(q => q.booking_type === 'Online').length;
    const walkinCount = list.filter(q => q.booking_type === 'Walk-in').length;

    const byServiceMap: Record<string, { id: string; name: string; count: number; color: string }> = {};
    list.forEach(q => {
      if (!byServiceMap[q.service_id]) {
        byServiceMap[q.service_id] = {
          id: q.service_id,
          name: q.service_name,
          count: 0,
          color: q.color_code || "#3B82F6"
        };
      }
      byServiceMap[q.service_id].count++;
    });
    const byService = Object.values(byServiceMap);

    res.json({
      success: true,
      list,
      stats: {
        total: totalCount,
        online: onlineCount,
        walkin: walkinCount,
        byService
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch no-shows" });
  }
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

  if (!queue) return null;

  if (queue.status === 'Waiting') {
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
  const today = getThailandTimeStr().split('T')[0];
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
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: "spa",
    });

    // Prevent @vite/client from opening a failing WebSocket connection to :24678 when HMR is disabled
    app.get("/@vite/client", async (_req, res, next) => {
      try {
        const result = await vite.transformRequest("/@vite/client");
        if (result?.code) {
          const safeCode = result.code.replace(
            /transport\.connect\(createHMRHandler\(handleMessage\)\);?/,
            "// HMR WebSocket connection disabled"
          );
          res
            .status(200)
            .set("Content-Type", "application/javascript")
            .set("Cache-Control", "no-cache")
            .send(safeCode);
          return;
        }
      } catch {
        // Fallback to default vite middleware
      }
      next();
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
    const today = getThailandTimeStr().split('T')[0];
    
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
