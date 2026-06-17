import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Calendar as CalendarIcon } from 'lucide-react';

export default function EmployeeSchedule() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);

  const today = new Date();
  const [targetYear, setTargetYear] = useState(today.getFullYear());
  const [targetMonth, setTargetMonth] = useState(today.getMonth() + 1);

  useEffect(() => {
    if (user) {
      fetch(`https://dbms-final-schedule.onrender.com/api/schedules?employee_id=${user.employee_id}&year=${targetYear}&month=${targetMonth}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setSchedules(data.schedules.filter(s => s.status === '已發布'));
          }
        })
        .catch(e => console.error(e));
    }
  }, [user, targetYear, targetMonth]);

  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const firstDayOfWeek = new Date(targetYear, targetMonth - 1, 1).getDay();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'transparent', padding: 'var(--space-2)' }} />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const sch = schedules.find(s => s.schedule_date.startsWith(dateStr));
    const is_on_duty = !!sch;
    
    calendarCells.push(
      <div key={d} style={{ 
        position: 'relative',
        border: '1px solid var(--color-border)', 
        borderRadius: 'var(--radius-md)', 
        padding: 'var(--space-2)', 
        backgroundColor: is_on_duty ? '#f8fafc' : '#ffffff',
        aspectRatio: '1 / 1',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <strong style={{ fontSize: '1.1rem', color: is_on_duty ? 'var(--color-primary-700)' : 'var(--color-text-tertiary)' }}>{d}</strong>
        </div>
        <div style={{ 
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          backgroundColor: is_on_duty ? '#d1fae5' : '#f1f5f9',
          color: is_on_duty ? '#047857' : '#94a3b8',
          border: `1px solid ${is_on_duty ? '#34d399' : '#cbd5e1'}`
        }}>
          {is_on_duty ? '值' : '休'}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>班表與出勤紀錄</h2>
          <p>查詢您未來的排班與過往出勤資訊。</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="number" 
            className="input-field" 
            style={{ width: '100px' }}
            value={targetYear} 
            onChange={e => setTargetYear(parseInt(e.target.value) || new Date().getFullYear())} 
          />
          <select className="input-field" value={targetMonth} onChange={e => setTargetMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
          </select>
        </div>
      </div>

      <div className="card glass-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h3 style={{ marginBottom: 'var(--space-3)', textAlign: 'center' }}>{targetYear}年{targetMonth}月 班表</h3>
        {schedules.length === 0 ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <CalendarIcon size={64} color="var(--color-text-tertiary)" />
            <h3 style={{ color: 'var(--color-text-secondary)' }}>目前尚未發布排班紀錄</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '800px' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)', 
                gap: 'var(--space-2)', 
                marginBottom: 'var(--space-2)',
                textAlign: 'center',
                fontWeight: 'bold',
                color: 'var(--color-text-secondary)'
              }}>
                {weekDays.map(wd => <div key={wd}>{wd}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)' }}>
                {calendarCells}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
