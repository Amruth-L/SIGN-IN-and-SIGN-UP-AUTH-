import { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // Axios instance with default base URL
  const api = axios.create({
    baseURL: 'http://localhost:3003'
  });

  // Interceptor to inject token
  api.interceptors.request.use((config) => {
    const activeToken = localStorage.getItem('token');
    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
    }
    return config;
  });

  useEffect(() => {
    const checkUserLoggedIn = async () => {
      const activeToken = localStorage.getItem('token');
      if (activeToken) {
        try {
          const res = await api.get('/me', {
            headers: { Authorization: `Bearer ${activeToken}` }
          });
          setUser(res.data);
          setToken(activeToken);
          setIsAuthenticated(true);
        } catch (error) {
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
  }, []);

  const login = async (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    try {
      const res = await api.get('/me', {
        headers: { Authorization: `Bearer ${newToken}` }
      });
      setUser(res.data);
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

  const updateProfile = async (name) => {
    try {
      const res = await api.put('/profile', { name });
      setUser(res.data);
      return res.data;
    } catch (err) {
      console.error("Failed to update profile", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, isAuthenticated, login, logout, updateProfile, api }}>
      {children}
    </AuthContext.Provider>
  );
};
