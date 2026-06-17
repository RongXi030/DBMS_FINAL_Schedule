import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check local storage for existing session
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (account, password) => {
    try {
      const response = await fetch('https://dbms-final-schedule.onrender.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password })
      });
      const data = await response.json();
      
      if (data.success) {
        if (data.needsSetup) {
          return { success: true, needsSetup: true, needsPasswordReset: false, user: data.user };
        }
        if (data.needsPasswordReset) {
          return { success: true, needsSetup: false, needsPasswordReset: true, user: data.user };
        }
        setUser(data.user);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        return { success: true, role: data.user.position };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: '伺服器連線失敗，請稍後再試' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
