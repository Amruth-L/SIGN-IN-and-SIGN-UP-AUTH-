import { useNavigate } from 'react-router-dom';
import { Box, Truck, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './ChooseMode.css';

export default function ChooseMode() {
  const { user, setMode } = useAuth(); const navigate = useNavigate();
  const choose = async mode => { await setMode(mode); navigate(mode === 'DELIVERY' ? '/delivery' : '/marketplace'); };
  return <main className="mode-page"><section className="mode-intro"><span className="mode-kicker"><MapPin size={15}/> CampusMesh</span><h1>What would you like to do today?</h1><p>Choose how you want to use your CampusMesh account.</p></section><section className="mode-options">
    <button className="mode-card rent" onClick={() => choose('RENT')}><span className="mode-icon"><Box /></span><span><b>I want to rent</b><small>Find and reserve useful campus items, then manage your rentals.</small></span></button>
    <button className="mode-card delivery" onClick={() => choose('DELIVERY')}><span className="mode-icon"><Truck /></span><span><b>I want to deliver</b><small>Go online as a delivery partner and complete campus deliveries.</small></span></button>
  </section><p className="mode-foot">Signed in as {user?.name}. You can switch modes any time.</p></main>;
}
