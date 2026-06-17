import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Calendar as CalendarIcon, CheckCircle2, Plus, X } from 'lucide-react';

export default function LeaveForm() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: '特休',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [remainingDays, setRemainingDays] = useState(0);

  if (user?.position === '管理者' && !user?.rule_id) {
    return (
      <div className="fade-in card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-6)', marginTop: '20px' }}>
        <h2 style={{ marginBottom: '16px', color: '#64748b' }}>不參與排班，無法開啟</h2>
        <p style={{ color: '#94a3b8' }}>您的管理者帳號並未綁定「員工規則」，因此不列入排班與請假系統中。</p>
      </div>
    );
  }

  const fetchLeaves = async () => {
    if (!user) return;
    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/leaves?employee_id=${user.employee_id}`);
      const data = await res.json();
      if (data.success) {
        setLeaves(data.leaves);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const fetchQuota = async () => {
    if (!user) return;
    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/employees`);
      const data = await res.json();
      if (data.success) {
        const me = data.employees.find(e => e.employee_id === user.employee_id);
        if (me) {
          setRemainingDays(me.remaining_special_leave_days);
        }
      }
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) {
      setRemainingDays(user.remaining_special_leave_days || 0);
      fetchLeaves();
      fetchQuota();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const sDate = new Date(formData.startDate);
    const eDate = new Date(formData.endDate);
    const requestedDays = Math.ceil((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;

    const isEmergency = ['病假', '事假'].includes(formData.type);
    const isStatutory = ['喪假', '婚假'].includes(formData.type);
    
    if (formData.type === '特休' && requestedDays > remainingDays) {
      alert(`特休額度不足！您申請了 ${requestedDays} 天，但目前只剩下 ${remainingDays} 天。`);
      return;
    }

    if (remainingDays <= 0 && !isStatutory && formData.type !== '特休') {
      if (isEmergency) {
        if (!window.confirm(`警告：您目前剩餘特休天數為 0。若此筆 ${formData.type} 申請通過，將視為扣薪無薪假，並可能影響考績結算，是否確認送出？`)) {
          return;
        }
      } else {
        alert('您的特休等額度為0，無法申請特休。');
        return;
      }
    }

    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/leaves/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: user.employee_id,
          leave_type: formData.type,
          start_time: formData.startDate,
          end_time: formData.endDate,
          reason: formData.reason
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('假單已成功送出！');
        setFormData({ type: '特休', startDate: '', endDate: '', reason: '' });
        setShowModal(false);
        fetchLeaves();
        fetchQuota();
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        alert(data.message);
      }
    } catch(e) {
      alert('連線失敗');
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case '審核中': return { bg: '#fef3c7', text: '#d97706' };
      case '已核准': return { bg: '#d1fae5', text: '#047857' };
      case '已駁回': return { bg: '#fee2e2', text: '#b91c1c' };
      default: return { bg: '#f1f5f9', text: '#64748b' };
    }
  };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>請假申請與紀錄</h2>
          <p>查詢您的請假紀錄與可用特休額度。</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> 填寫請假單
        </button>
      </div>

      {successMsg && (
        <div className="fade-in" style={{ 
          padding: '12px 16px', backgroundColor: '#ecfdf5', border: '1px solid #10b981', 
          color: '#047857', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-4)',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      <div className="grid-system" style={{ gridTemplateColumns: '1fr 300px', alignItems: 'start' }}>
        <div className="card glass-panel" style={{ overflowX: 'auto' }}>
          <h3 style={{ marginBottom: 'var(--space-3)' }}>過往請假紀錄</h3>
          {leaves.length === 0 ? (
            <div className="flex-center" style={{ minHeight: '200px', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <CalendarIcon size={48} color="var(--color-text-tertiary)" />
              <p style={{ color: 'var(--color-text-secondary)' }}>尚無請假紀錄</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>申請提出日</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>請假類別</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>開始時間</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>結束時間</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>假單狀態</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map(l => {
                  const statusColors = getStatusColor(l.status);
                  return (
                    <tr key={l.leave_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 8px' }}>{new Date(l.application_time).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>{l.leave_type}</td>
                      <td style={{ padding: '12px 8px' }}>{new Date(l.start_time).toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })}</td>
                      <td style={{ padding: '12px 8px' }}>{new Date(l.end_time).toLocaleString('zh-TW', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' })}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          backgroundColor: statusColors.bg, 
                          color: statusColors.text, 
                          borderRadius: '99px', 
                          fontSize: '0.85rem', 
                          fontWeight: 'bold' 
                        }}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="card" style={{ backgroundColor: 'var(--color-primary-50)', borderColor: 'var(--color-primary-100)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} color="var(--color-primary-600)"/> 您的特休額度
            </h3>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--color-primary-600)', lineHeight: 1 }}>
              {remainingDays} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-text-secondary)' }}>天</span>
            </div>
            <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem' }}>
              請注意，若特休餘額為 0，一般排休將無法申請。緊急病/事假將視為無薪假處理。
            </p>
          </div>
        </div>
      </div>

      {showModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card fade-in" style={{
            backgroundColor: 'var(--color-surface)',
            width: '100%', maxWidth: '500px', margin: '0 20px', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-4)' }}>填寫請假單</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>請假類別</label>
                <select 
                  className="input-field" 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="特休">特休</option>
                  <option value="病假">病假</option>
                  <option value="事假">事假</option>
                  <option value="喪假">喪假</option>
                  <option value="婚假">婚假</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>開始時間</label>
                  <input 
                    type="datetime-local" 
                    className="input-field" 
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>結束時間</label>
                  <input 
                    type="datetime-local" 
                    className="input-field" 
                    value={formData.endDate}
                    onChange={e => setFormData({...formData, endDate: e.target.value})}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>請假事由</label>
                <textarea 
                  className="input-field" 
                  rows="4"
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  required
                  style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary">確認送出</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
