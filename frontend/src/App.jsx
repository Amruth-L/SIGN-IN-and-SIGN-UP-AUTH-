import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import Login from './pages/Login.tsx';
import Signup from './pages/Signup.tsx';
import VerifyEmail from './pages/VerifyEmail.tsx';
import ForgotPassword from './pages/ForgotPassword.tsx';
import Profile from './pages/Profile';
import AddListing from './pages/AddListing';
import EditListing from './pages/EditListing';
import RentItem from './pages/RentItem';
import Chat from './pages/Chat';
import RentSummary from './pages/RentSummary';
import RentDetails from './pages/RentDetails';
import OwnerDashboard from './pages/OwnerDashboard';
import RentalReturn from './pages/RentalReturn';
import RentalPayment from './pages/RentalPayment';
import DepositPayment from './pages/DepositPayment';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailed from './pages/PaymentFailed';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import DeliveryDashboard from './pages/DeliveryDashboard';
import ChooseMode from './pages/ChooseMode';
import DeliveryTracking from './pages/DeliveryTracking';

function App() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/choose-mode" replace /> : <Home />} />
        <Route 
          path="/login" 
          element={user ? <Navigate to="/choose-mode" replace /> : <Login />} 
        />
        <Route path="/choose-mode" element={<PrivateRoute><ChooseMode /></PrivateRoute>} />
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
          path="/marketplace"
          element={
            <PrivateRoute>
              <Marketplace />
            </PrivateRoute>
          }
        />
        <Route path="/delivery/:id/track" element={<PrivateRoute><DeliveryTracking /></PrivateRoute>} />
        <Route
          path="/my-rentals"
          element={
            <PrivateRoute>
              <Profile defaultTab="rentals" />
            </PrivateRoute>
          }
        />
        <Route
          path="/my-listings"
          element={
            <PrivateRoute>
              <Profile defaultTab="listings" />
            </PrivateRoute>
          }
        />
        <Route 
          path="/cart" 
          element={
            <PrivateRoute>
              <Cart />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/checkout" 
          element={
            <PrivateRoute>
              <Checkout />
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
          path="/create-listing"
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
          path="/item/:id"
          element={
            <PrivateRoute>
              <RentItem />
            </PrivateRoute>
          }
        />
        <Route
          path="/rent/:id"
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
        <Route
          path="/rent-summary/:id"
          element={
            <PrivateRoute>
              <RentSummary />
            </PrivateRoute>
          }
        />
        <Route
          path="/rent-details/:rentalId"
          element={
            <PrivateRoute>
              <RentDetails />
            </PrivateRoute>
          }
        />
        <Route
          path="/owner-dashboard"
          element={
            <PrivateRoute>
              <OwnerDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/rental-return/:rentalId"
          element={
            <PrivateRoute>
              <RentalReturn />
            </PrivateRoute>
          }
        />
        <Route
          path="/rental-payment/:id"
          element={
            <PrivateRoute>
              <RentalPayment />
            </PrivateRoute>
          }
        />
        <Route
          path="/deposit-payment/:id"
          element={
            <PrivateRoute>
              <DepositPayment />
            </PrivateRoute>
          }
        />
        <Route
          path="/payment-success"
          element={
            <PrivateRoute>
              <PaymentSuccess />
            </PrivateRoute>
          }
        />
        <Route
          path="/payment-failed"
          element={
            <PrivateRoute>
              <PaymentFailed />
            </PrivateRoute>
          }
        />
        <Route
          path="/delivery"
          element={
            <PrivateRoute>
              <DeliveryDashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
