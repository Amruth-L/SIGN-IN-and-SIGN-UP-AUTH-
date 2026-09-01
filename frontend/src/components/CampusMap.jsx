import { useState } from 'react';
import './CampusMap.css';

const COLORS = { current: '#2563eb', pickup: '#16a34a', destination: '#e23d50' };
const MAP_BUILDINGS = [
  ['Sports Room', 205, 108, 180, 68, '#c8eaa6'], ['Campus Cafeteria', 472, 105, 212, 68, '#fed09a'], ['Boys Hostel', 790, 105, 168, 68, '#b8cef8'],
  ['A-Block', 218, 285, 200, 110, '#f8b4b9'], ['B-Block', 520, 230, 230, 86, '#cdb0f0'], ['Library', 790, 246, 150, 84, '#a9ddeb'],
  ['Admin Block', 220, 448, 190, 62, '#fbd66e'], ['Bus Parking', 555, 395, 190, 92, '#aebccc'], ['C-Block', 820, 420, 100, 205, '#f7d96a'],
  ['Girls Hostel', 90, 555, 125, 120, '#f7a4aa'], ['Basketball Court', 260, 560, 112, 118, '#b4df89'], ['MBA Block', 475, 565, 112, 96, '#f2a2b5'], ['Car Parking', 610, 560, 130, 100, '#9db8ee'], ['Central Ground', 770, 580, 185, 115, '#bce489']
];
const TREES = [[52,90],[60,168],[113,82],[143,192],[390,85],[405,170],[710,92],[745,185],[930,195],[95,420],[415,414],[760,375],[960,425],[59,520],[375,535],[450,660],[952,600]];

export default function CampusMap({ current = { x: 115, y: 640 }, pickup, destination }) {
  const [zoom, setZoom] = useState(1);
  const point = value => value && { x: Number(value.x), y: Number(value.y) };
  const p = point(pickup) || { x: 574, y: 138 };
  const d = point(destination) || { x: 635, y: 270 };
  const you = point(current);
  const pin = (value, type, title, sub) => <g className="blueprint-pin"><circle cx={value.x} cy={value.y} r="19" fill={COLORS[type]} opacity=".15"/><circle cx={value.x} cy={value.y} r="10" fill={COLORS[type]} stroke="#fff" strokeWidth="4"/><circle cx={value.x} cy={value.y} r="3" fill="#fff"/><rect x={value.x + 14} y={value.y - 29} width={type === 'destination' ? 128 : 100} height="35" rx="7" fill="#0f172a"/><text x={value.x + 22} y={value.y - 15} className="pin-title">{title}</text><text x={value.x + 22} y={value.y - 5} className="pin-sub">{sub}</text></g>;
  return <div className="campus-map blueprint"><div className="blueprint-stage" style={{ transform: `scale(${zoom})` }}><svg viewBox="0 0 1020 730" role="img" aria-label="Campus blueprint with delivery route from Cafeteria Counter 04 to B-Block Room 204">
    <defs><pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M 18 0 L 0 0 0 18" fill="none" stroke="#dbe5ed" strokeWidth=".8"/></pattern><filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity=".18"/></filter></defs>
    <rect width="1020" height="730" fill="#edf5e9"/><rect width="1020" height="730" fill="url(#grid)" opacity=".45"/>
    <path className="road" d="M0 208H1020M0 405H1020M120 0V730M445 0V730M770 0V730M0 530H1020"/><path className="road-center" d="M0 208H1020M0 405H1020M120 0V730M445 0V730M770 0V730M0 530H1020"/>
    {TREES.map(([x,y], i)=><g key={i}><circle cx={x} cy={y} r="14" fill="#4f8e48"/><circle cx={x+7} cy={y-5} r="10" fill="#6dad55"/><rect x={x-2} y={y+10} width="4" height="7" fill="#765236"/></g>)}
    {MAP_BUILDINGS.map(([name,x,y,w,h,color])=><g key={name} filter="url(#shadow)"><rect x={x} y={y} width={w} height={h} rx="9" fill={color} stroke="#fff" strokeWidth="4"/><rect x={x+5} y={y+5} width={w-10} height={h-10} rx="6" fill="none" stroke="#334155" strokeOpacity=".28"/><text x={x+w/2} y={y+h/2+4} textAnchor="middle" className="building-label">{name}</text></g>)}
    <g className="landmark"><rect x="66" y="686" width="112" height="26" rx="5" fill="#344454"/><text x="122" y="704" textAnchor="middle">MAIN ENTRANCE</text></g><g className="landmark"><rect x="467" y="140" width="88" height="20" rx="4" fill="#f59e0b"/><text x="511" y="154" textAnchor="middle">Counter 04</text></g>
    <polyline points="115,640 115,530 445,530 445,405 635,405 635,316" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round"/><polyline points="115,640 115,530 445,530 445,405 635,405 635,316" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeDasharray="9 7"/>
    <path d="M635 316 L635 270" stroke="#e23d50" strokeWidth="3" strokeDasharray="5 5"/><text x="652" y="346" className="floor-note">B-Block entrance → Floor 2</text>
    {pin(you, 'current', 'You are here', 'Main entrance')} {pin(p, 'pickup', 'Pickup', 'Cafeteria · Counter 04')} {pin(d, 'destination', 'Deliver here', 'B-Block · Room 204')}
  </svg></div><div className="map-zoom-controls"><button type="button" onClick={() => setZoom(value => Math.min(1.8, Number((value + .2).toFixed(1))))} aria-label="Zoom in">+</button><button type="button" onClick={() => setZoom(value => Math.max(.7, Number((value - .2).toFixed(1))))} aria-label="Zoom out">−</button><button type="button" className="reset-zoom" onClick={() => setZoom(1)}>Reset</button></div><div className="map-legend blueprint-legend"><span><i className="blue"/> Delivery partner</span><span><i className="green"/> Pickup point</span><span><i className="red"/> Exact room</span><span><b>— —</b> Walkable route</span></div></div>;
}
