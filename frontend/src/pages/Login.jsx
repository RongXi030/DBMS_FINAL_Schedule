import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Save } from 'lucide-react';

export default function Login() {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const [setupData, setSetupData] = useState({
    account: '',
    old_password: '',
    new_password: '',
    confirm_password: '',
    email: '',
    phone_number: ''
  });

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (setupData.new_password !== setupData.confirm_password) {
      return setError('兩次輸入的新密碼不一致');
    }
    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/setup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupData)
      });
      const data = await res.json();
      if (data.success) {
        alert('設定成功！請使用新密碼重新登入');
        setNeedsSetup(false);
        setNeedsPasswordReset(false);
        setPassword('');
      } else {
        setError(data.message);
      }
    } catch {
      setError('伺服器錯誤');
    }
  };
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    const result = await login(account, password);
    if (result.success) {
      if (result.needsSetup) {
        setNeedsSetup(true);
        setSetupData({ ...setupData, account: account, old_password: password });
      } else if (result.needsPasswordReset) {
        setNeedsPasswordReset(true);
        setSetupData({ ...setupData, account: account, old_password: password, is_reset_only: true });
      } else if (result.role === '管理者') {
        navigate('/admin/dashboard');
      } else {
        navigate('/employee/dashboard');
      }
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh' }}>
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ color: 'var(--color-primary-600)', marginBottom: 'var(--space-1)' }}>喬魯諾‧喬班啦！</h2>
          <p>系統登入</p>
        </div>

        {needsPasswordReset ? (
          <form onSubmit={handleSetupSubmit} className="grid-system" style={{ gap: 'var(--space-2)' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px', color: '#eab308', fontWeight: 500 }}>
              您必須先修改密碼才能繼續
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>原密碼</label>
              <input 
                type="password" 
                className="input-field" 
                value={setupData.old_password}
                onChange={(e) => setSetupData({...setupData, old_password: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>新密碼</label>
              <input 
                type="password" 
                className="input-field" 
                value={setupData.new_password}
                onChange={(e) => setSetupData({...setupData, new_password: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>確認新密碼</label>
              <input 
                type="password" 
                className="input-field" 
                value={setupData.confirm_password}
                onChange={(e) => setSetupData({...setupData, confirm_password: e.target.value})}
                required
              />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
              <Save size={18} /> 儲存新密碼
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => {setNeedsPasswordReset(false); setError('');}} style={{ width: '100%', marginTop: '8px' }}>
              取消並返回登入
            </button>
          </form>
        ) : needsSetup ? (
          <form onSubmit={handleSetupSubmit} className="grid-system" style={{ gap: 'var(--space-2)' }}>
            <div style={{ textAlign: 'center', marginBottom: '8px', color: '#ef4444', fontWeight: 500 }}>
              您必須先完成初始設定才能繼續
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>原密碼</label>
              <input 
                type="password" 
                className="input-field" 
                value={setupData.old_password}
                onChange={(e) => setSetupData({...setupData, old_password: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>新密碼</label>
              <input 
                type="password" 
                className="input-field" 
                value={setupData.new_password}
                onChange={(e) => setSetupData({...setupData, new_password: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>確認新密碼</label>
              <input 
                type="password" 
                className="input-field" 
                value={setupData.confirm_password}
                onChange={(e) => setSetupData({...setupData, confirm_password: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>電子郵件</label>
              <input 
                type="email" 
                className="input-field" 
                value={setupData.email}
                onChange={(e) => setSetupData({...setupData, email: e.target.value})}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>電話號碼</label>
              <input 
                type="text" 
                className="input-field" 
                value={setupData.phone_number}
                onChange={(e) => setSetupData({...setupData, phone_number: e.target.value})}
                required
              />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
              <Save size={18} /> 儲存設定
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => {setNeedsSetup(false); setError('');}} style={{ width: '100%', marginTop: '8px' }}>
              取消並返回登入
            </button>
          </form>
        ) : (
        <form onSubmit={handleLogin} className="grid-system" style={{ gap: 'var(--space-2)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>帳號</label>
            <input 
              type="text" 
              className="input-field" 
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="請輸入帳號 (admin / user)"
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500 }}>密碼</label>
            <input 
              type="password" 
              className="input-field" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼 (password)"
              required
            />
          </div>
          
          {error && <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</p>}
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--space-2)' }}>
            <LogIn size={18} /> 登入系統
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
