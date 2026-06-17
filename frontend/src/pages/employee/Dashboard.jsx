import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Clock, Play, Square } from 'lucide-react';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState('未打卡');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [todaySchedule, setTodaySchedule] = useState(null);

  const fetchStatus = async () => {
    if (!user) return;
    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/attendance/status/${user.employee_id}`);
      const data = await res.json();
      if (data.success && data.record) {
        setStatus(data.record.status);
      } else {
        setStatus('未打卡');
      }

      const targetY = currentTime.getFullYear();
      const targetM = currentTime.getMonth() + 1;
      const targetD = currentTime.getDate();
      const dateStr = `${targetY}-${String(targetM).padStart(2, '0')}-${String(targetD).padStart(2, '0')}`;
      const resSch = await fetch(`https://dbms-final-schedule.onrender.com/api/schedules?employee_id=${user.employee_id}&date=${dateStr}`);
      const dataSch = await resSch.json();
      if (dataSch.success && dataSch.schedules && dataSch.schedules.length > 0) {
        const publishedSch = dataSch.schedules.find(s => s.status === '已發布');
        setTodaySchedule(publishedSch || null);
      } else {
        setTodaySchedule(null);
      }
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: user.employee_id })
      });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      } else {
        alert(data.message);
      }
    } catch(e) {
      alert('連線失敗');
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: user.employee_id })
      });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      } else {
        alert(data.message);
      }
    } catch(e) {
      alert('連線失敗');
    }
    setLoading(false);
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>歡迎回來，{user?.first_name}</h2>
        <p>今天是 {currentTime.toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid-system" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <div style={{ 
            fontSize: '3.5rem', 
            fontWeight: 700, 
            color: 'var(--color-primary-600)',
            fontVariantNumeric: 'tabular-nums',
            marginBottom: 'var(--space-2)'
          }}>
            {currentTime.toLocaleTimeString('zh-TW', { hour12: false })}
          </div>
          <div style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
            當前狀態：<span style={{ fontWeight: 600, color: status === '值班中' ? '#10b981' : (status === '下班' ? '#94a3b8' : 'var(--color-text-primary)') }}>{status}</span>
          </div>
          
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
            <button 
              onClick={handleClockIn} 
              disabled={!todaySchedule || status === '值班中' || status === '下班' || loading}
              className="btn btn-primary" 
              style={{ width: '130px', opacity: (!todaySchedule || status === '值班中' || status === '下班') ? 0.5 : 1 }}
            >
              <Play size={18} /> 上班打卡
            </button>
            <button 
              onClick={handleClockOut} 
              disabled={status !== '值班中' || loading}
              className="btn btn-secondary" 
              style={{ width: '130px', opacity: status !== '值班中' ? 0.5 : 1 }}
            >
              <Square size={18} /> 下班打卡
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="var(--color-primary-500)" /> 今日班表
          </h3>
          <div style={{ 
            padding: 'var(--space-3)', 
            backgroundColor: todaySchedule ? 'var(--color-primary-50)' : '#f1f5f9', 
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${todaySchedule ? 'var(--color-primary-100)' : '#e2e8f0'}`
          }}>
            {todaySchedule ? (
              <>
                <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--color-primary-800)' }}>正常排班</div>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-primary-700)' }}>請依據排班時間打卡</p>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '8px', fontWeight: 600, color: '#64748b' }}>今日休假</div>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>您今天沒有排班，無法打卡</p>
              </>
            )}
          </div>
          <p style={{ marginTop: 'var(--space-3)', fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>
            提醒：請確保在規定時間內完成打卡，若今日無排班則系統將拒絕打卡請求。
          </p>
        </div>
      </div>
    </div>
  );
}
