import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import AddListing from './pages/AddListing';
import EditListing from './pages/EditListing';
import RentItem from './pages/RentItem';
import Chat from './pages/Chat';

function App() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" replace /> : <Login />} 
        />
        <Route 
          path="/signup" 
          element={user ? <Navigate to="/" replace /> : <Signup />} 
        />
        <Route 
          path="/verify-email" 
          element={user ? <Navigate to="/" replace /> : <VerifyEmail />} 
        />
        <Route 
          path="/forgot-password" 
          element={user ? <Navigate to="/" replace /> : <ForgotPassword />} 
        />
        <Route 
          path="/profile" 
          element={
            <PrivateRoute>
              <Profile defaultTab="listings" />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/saved-items" 
          element={
            <PrivateRoute>
              <Profile defaultTab="saved" />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/add-listing" 
          element={
            <PrivateRoute>
              <AddListing />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/edit-listing/:id" 
          element={
            <PrivateRoute>
              <EditListing />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/rent-item/:id" 
          element={
            <PrivateRoute>
              <RentItem />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/chat" 
          element={
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          } 
        />
      </Routes>
    </>
  );
}

export default App;
