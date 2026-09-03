import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Axios instance with default base URL
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_BASE_URL
    });
    instance.interceptors.request.use((config) => {
      const activeToken = localStorage.getItem('token');
      if (activeToken) config.headers.Authorization = `Bearer ${activeToken}`;
      return config;
    });
    return instance;
  }, []);

  useEffect(() => {
    const checkUserLoggedIn = async () => {
      const activeToken = localStorage.getItem('token');
      if (activeToken) {
        try {
          const res = await api.get('/me', {
            headers: { Authorization: `Bearer ${activeToken}` }
          });
          setUser(res.data.profile);
          setToken(activeToken);
          setIsAuthenticated(true);
        } catch {
          console.error("Token invalid or expired, clearing session");
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
          navigate('/');
        }
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false);
    };

    checkUserLoggedIn();
  }, [api, navigate]);

  const login = async (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    try {
      const res = await api.get('/me', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      setUser(res.data.profile);
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Login verification failed:", err);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    navigate('/');
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await api.put('/api/profile', profileData);
      const updatedUser = res.data.profile;
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.error("Failed to update profile", err);
      throw err;
    }
  };

  const setMode = async (mode) => {
    const res = await api.put('/mode', { mode });
    setUser(prev => ({ ...prev, ...res.data }));
    return res.data;
  };

  const setDeliveryAvailability = async (available) => {
    const res = await api.put('/delivery-availability', { available });
    setUser(prev => ({ ...prev, ...res.data }));
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, login, logout, updateProfile, setMode, setDeliveryAvailability, api }}>
      {children}
    </AuthContext.Provider>
  );
};
