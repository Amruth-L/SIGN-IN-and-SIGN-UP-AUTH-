const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcrypt');
const pool = require('../config/database');
const { routeFor } = require('../modules/campus/campus.service');

const students = [
  'Aarav Lender',
  'Bhavna Student',
  'Charan Courier',
  'Diya Courier',
  'Eshan Courier',
  'Farah Student',
  'Gautam Student',
  'Hema Student',
  'Ishaan Student',
  'Jaya Student',
  'Karthik Student',
  'Lavanya Student',
];
const items = [
  ['Casio FX-991ES Plus', 'Electronics', 25, 300, 'library-ground-floor-rental-counter-02'],
  ['Engineering Mathematics Textbook', 'Books', 18, 150, 'library-ground-floor-rental-counter-02'],
  ['Digital Multimeter Lab Kit', 'Lab Equipment', 35, 400, 'a-block-ground-floor-101'],
  ['Laptop Stand', 'Electronics', 20, 250, 'b-block-ground-floor-101'],
  ['Badminton Racquet Pair', 'Sports', 30, 300, 'hostel-ground-floor-204'],
];

async function seed() {
  const password = await bcrypt.hash('CampusMesh@123', 10);
  const ids = [];
  for (let index = 0; index < students.length; index += 1) {
    const suffix = String.fromCharCode(97 + index);
    const email = `student${suffix}@dbit.co.in`;
    const { rows } = await pool.query(
      `INSERT INTO users(name,username,email,password,email_verified,courier_reliability_score)
      VALUES($1,$2,$3,$4,TRUE,$5) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,email_verified=TRUE RETURNING id`,
      [students[index], `student_${suffix}`, email, password, 98 - index],
    );
    ids.push(rows[0].id);
  }
  await pool.query(
    `INSERT INTO users(name,username,email,password,email_verified,account_type) VALUES('Campus Xerox Desk','campus_xerox','xerox@dbit.co.in',$1,TRUE,'XEROX_DESK') ON CONFLICT(email) DO UPDATE SET account_type='XEROX_DESK',email_verified=TRUE`,
    [password],
  );
  for (const [title, category, rent, deposit, pickup] of items)
    await pool.query(
      `INSERT INTO listings(title,description,price,category,image_url,owner_id,condition,rent_price,deposit,location,delivery_available,delivery_charge,pickup_location_id)
    SELECT $1::varchar,'Presentation-ready CampusMesh rental.',$2::numeric*12,$3::varchar,'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800',$4::uuid,'Good',$2::numeric,$5::numeric,'Central Library',TRUE,20,$6::text
    WHERE NOT EXISTS(SELECT 1 FROM listings WHERE title=$1::varchar AND owner_id=$4::uuid)`,
      [title, rent, category, ids[0], deposit, pickup],
    );
  const { rows: locations } = await pool.query(
    "SELECT * FROM campus_locations WHERE id IN ('library-ground-floor-rental-counter-02','hostel-ground-floor-204','a-block-ground-floor-101')",
  );
  const byId = Object.fromEntries(locations.map((location) => [location.id, location]));
  for (const [courier, origin, destination, detour] of [
    [ids[2], 'library-ground-floor-rental-counter-02', 'hostel-ground-floor-204', 300],
    [ids[3], 'a-block-ground-floor-101', 'library-ground-floor-rental-counter-02', 180],
    [ids[4], 'library-ground-floor-rental-counter-02', 'a-block-ground-floor-101', 400],
  ]) {
    const route = routeFor(byId[origin], byId[destination]);
    await pool.query(
      'UPDATE courier_route_availability SET is_active=FALSE WHERE courier_id=$1 AND is_active',
      [courier],
    );
    await pool.query(
      `INSERT INTO courier_route_availability(courier_id,origin_location_id,destination_location_id,route_node_ids,available_until,max_detour_meters) VALUES($1,$2,$3,$4,NOW()+INTERVAL '8 hours',$5)`,
      [courier, origin, destination, route.nodes, detour],
    );
    await pool.query('UPDATE users SET delivery_available=TRUE WHERE id=$1', [courier]);
  }
  console.log('[seed] Demo users, listings, campus routes, and Xerox desk created. Password: CampusMesh@123');
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
