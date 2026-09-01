const pool = require('../config/db');

const CAMPUS = {
  id: 'main-campus', name: 'CampusMesh Main Campus', bounds: { width: 1000, height: 700 },
  buildings: [
    { id: 'entrance', name: 'Main Entrance', type: 'landmark', x: 110, y: 620 },
    { id: 'cafeteria', name: 'Campus Cafeteria', type: 'food', x: 230, y: 190, entrance: 'Cafeteria east entrance', floors: ['Ground Floor'], rooms: ['Counter 04', 'Counter 01'] },
    { id: 'library', name: 'Central Library', type: 'library', x: 720, y: 185, entrance: 'Library south entrance', floors: ['Ground Floor', 'First Floor'], rooms: ['Rental Counter 02', 'Reading Hall'] },
    { id: 'a-block', name: 'A-Block', type: 'academic', x: 270, y: 370, entrance: 'A-Block north entrance', floors: ['Ground Floor', 'First Floor', 'Second Floor'], rooms: ['101', '202'] },
    { id: 'b-block', name: 'B-Block', type: 'academic', x: 650, y: 360, entrance: 'B-Block south entrance', floors: ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor'], rooms: ['101', '204', '305'] },
    { id: 'admin', name: 'Admin Block', type: 'admin', x: 210, y: 500, entrance: 'Admin Block entrance', floors: ['Ground Floor'], rooms: ['Office 12'] },
    { id: 'parking', name: 'Campus Parking', type: 'parking', x: 480, y: 550 },
    { id: 'hostel', name: 'Boys Hostel', type: 'hostel', x: 830, y: 480, entrance: 'Hostel west entrance', floors: ['Ground Floor', 'First Floor', 'Second Floor'], rooms: ['204', '312'] },
  ],
  paths: [[110,620,210,500],[210,500,270,370],[270,370,230,190],[270,370,480,550],[480,550,650,360],[650,360,720,185],[650,360,830,480],[230,190,650,360]],
};

async function ensureCampusSchema() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_mode VARCHAR(20) NOT NULL DEFAULT 'RENT';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_available BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS campus_locations (
      id TEXT PRIMARY KEY, building_id TEXT NOT NULL, building_name TEXT NOT NULL, entrance_name TEXT,
      floor_name TEXT, room_name TEXT, location_type TEXT NOT NULL DEFAULT 'ROOM', x NUMERIC NOT NULL, y NUMERIC NOT NULL,
      indoor_x NUMERIC, indoor_y NUMERIC, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS delivery_location_updates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), delivery_id UUID REFERENCES delivery_requests(id) ON DELETE CASCADE,
      courier_id UUID REFERENCES users(id) ON DELETE CASCADE, x NUMERIC NOT NULL, y NUMERIC NOT NULL,
      speed NUMERIC DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS pickup_location_id TEXT;
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS destination_location_id TEXT;
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS order_type VARCHAR(30) NOT NULL DEFAULT 'RENTAL';
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS item_description TEXT;
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS special_instructions TEXT;
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS travel_mode VARCHAR(20) NOT NULL DEFAULT 'WALK';
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS arrived_pickup_at TIMESTAMP;
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS arrived_destination_at TIMESTAMP;
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS delivery_otp VARCHAR(4);
    ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS qr_token VARCHAR(128);`);
  for (const building of CAMPUS.buildings) {
    if (!building.floors) continue;
    for (const floor of building.floors) for (const room of building.rooms || []) {
      await pool.query(`INSERT INTO campus_locations (id, building_id, building_name, entrance_name, floor_name, room_name, location_type, x, y, indoor_x, indoor_y)
        VALUES ($1,$2,$3,$4,$5,$6,'ROOM',$7,$8,50,50) ON CONFLICT (id) DO NOTHING`,
        [`${building.id}-${floor}-${room}`.replace(/\s+/g, '-').toLowerCase(), building.id, building.name, building.entrance, floor, room, building.x, building.y]);
    }
  }
}

function campusPayload() { return CAMPUS; }
function routeFor() {
  return { distanceMeters: 425, etaMinutes: 6, segments: CAMPUS.paths, instructions: [
    'Head to the Campus Cafeteria pickup counter.', 'Collect the order at Counter 04.',
    'Follow the central walking path to B-Block.', 'Enter B-Block through the south entrance.',
    'Take the elevator or stairs to Second Floor.', 'Room 204 is along the main corridor.'
  ]};
}
module.exports = { ensureCampusSchema, campusPayload, routeFor };
