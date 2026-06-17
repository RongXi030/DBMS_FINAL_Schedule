import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Users, FileText, AlertTriangle, X, Save, Phone, Check, Info, Mail } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingLeaves: 0,
    abnormalAttendances: 0
  });
  const [pendingLeaves, setPendingLeaves] = useState([]);

  const [abnormalList, setAbnormalList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAbnormal, setSelectedAbnormal] = useState(null);
  const [approvedHours, setApprovedHours] = useState('');
  const [selectedLeave, setSelectedLeave] = useState(null);

  const [todayData, setTodayData] = useState([]);

  const fetchData = async () => {
    try {
      const statsRes = await fetch('https://dbms-final-schedule.onrender.com/api/reports/stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      const leavesRes = await fetch('https://dbms-final-schedule.onrender.com/api/leaves');
      const leavesData = await leavesRes.json();
      if (leavesData.success) {
        setPendingLeaves(leavesData.leaves.filter(l => l.status === '審核中'));
      }

      const todayRes = await fetch('https://dbms-final-schedule.onrender.com/api/dashboard/today');
      const todayJson = await todayRes.json();
      if (todayJson.success) {
        setTodayData(todayJson.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAbnormalList = () => {
    fetch('https://dbms-final-schedule.onrender.com/api/reports/abnormal-attendances')
      .then(res => res.json())
      .then(data => {
        if (data.success) setAbnormalList(data.data);
      })
      .catch(e => console.error(e));
  };

  useEffect(() => {
    fetchData();
    fetchAbnormalList();
    // Refresh today data every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/leaves/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leave_id: id })
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolve = () => {
    if (!selectedAbnormal) return;
    fetch(`https://dbms-final-schedule.onrender.com/api/reports/abnormal-attendances/${selectedAbnormal.attendance_id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_approved_hours: approvedHours })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('異常已排除並核准工時');
          setIsModalOpen(false);
          setSelectedAbnormal(null);
          setApprovedHours('');
          fetchAbnormalList();
          fetchData();
        } else {
          alert(data.message);
        }
      });
  };

  const handleSendReminder = async () => {
    if (!window.confirm('確定要手動發送「明日上班提醒」給明天有排班的員工嗎？')) return;
    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/schedules/remind-tomorrow', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || `成功發送 ${data.count} 封提醒信件。`);
      } else {
        alert('發送失敗：' + data.message);
      }
    } catch (e) {
      console.error(e);
      alert('發送時發生錯誤');
    }
  };

  const getDerivedStatus = (sch) => {
    if (!sch.is_on_duty) return { label: '休假', className: 'bg-blue-100 text-blue-800', icon: '🔵' };
    if (sch.attendance_status === '請假') return { label: '休假', className: 'bg-blue-100 text-blue-800', icon: '🔵' };
    if (sch.clock_in_time) return { label: '已打卡', className: 'bg-green-100 text-green-800', icon: '🟢' };

    if (sch.start_time) {
      const now = new Date();
      const [hours, minutes] = sch.start_time.split(':');
      const startTime = new Date();
      startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      // Let's add a 15 min grace period for late
      startTime.setMinutes(startTime.getMinutes() + 15);
      if (now > startTime) {
        return { label: '遲到', className: 'bg-red-100 text-red-800', icon: '🔴' };
      }
    }
    return { label: '尚未到班', className: 'bg-gray-100 text-gray-800', icon: '⚪' };
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  const todayScheduled = todayData.filter(sch => sch.is_on_duty && sch.attendance_status !== '請假');
  const expectedCount = todayScheduled.length;
  const clockedInCount = todayScheduled.filter(sch => sch.clock_in_time).length;
  const lateOrNotArrived = todayScheduled.filter(sch => !sch.clock_in_time);
  const lateOrNotArrivedCount = lateOrNotArrived.length;

  const todayAbnormalCount = todayScheduled.filter(sch => getDerivedStatus(sch).label === '遲到').length;

  const progressPercent = expectedCount === 0 ? 0 : Math.round((clockedInCount / expectedCount) * 100);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>管理者儀表板</h2>
          <p>系統數據總覽與待辦事項處理。</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn" style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleSendReminder}>
            <Mail size={18} /> 發送明日提醒
          </button>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            處理異常出勤 ({abnormalList.length})
          </button>
        </div>
      </div>

      <div className="grid-system" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: 'var(--radius-md)', color: '#3b82f6' }}>
            <Users size={32} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>總員工人數 (在職)</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{stats.totalEmployees}</div>
          </div>
        </div>

        <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '16px', backgroundColor: '#fff7ed', borderRadius: 'var(--radius-md)', color: '#f59e0b' }}>
            <FileText size={32} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>待審核假單</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{pendingLeaves.length}</div>
          </div>
        </div>

        <div className="card glass-panel" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ padding: '16px', backgroundColor: todayAbnormalCount > 0 ? '#fef2f2' : '#f1f5f9', borderRadius: 'var(--radius-md)', color: todayAbnormalCount > 0 ? '#ef4444' : '#94a3b8' }}>
            <AlertTriangle size={32} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>本日異常出勤</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: todayAbnormalCount > 0 ? '#ef4444' : '#94a3b8' }}>{todayAbnormalCount}</div>
          </div>
        </div>
      </div>

      <div className="card glass-panel" style={{ marginBottom: 'var(--space-6)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4) var(--space-6)', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-3)' }}>今日營運狀況</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', fontSize: '1.1rem', fontWeight: 500, marginBottom: 'var(--space-3)' }}>
            <span>今日應到：{expectedCount} 人</span>
            <span style={{ color: '#10b981' }}>目前已打卡：{clockedInCount} 人</span>
            {lateOrNotArrivedCount > 0 && <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>{lateOrNotArrivedCount} 人尚未到班/遲到</span>}
          </div>
          <div style={{ width: '100%', maxWidth: '600px', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.5s ease-in-out' }}></div>
          </div>
        </div>

        <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
          {todayData.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-4) 0' }}>今日無排班紀錄</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                  <th style={{ padding: '12px 8px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>姓名</th>
                  <th style={{ padding: '12px 8px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>出勤狀態</th>
                  <th style={{ padding: '12px 8px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>上班時間</th>
                  <th style={{ padding: '12px 8px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>下班時間</th>
                  <th style={{ padding: '12px 8px', fontWeight: 500, borderBottom: '1px solid var(--color-border)' }}>聯絡電話</th>
                </tr>
              </thead>
              <tbody>
                {todayData.map(sch => {
                  const statusInfo = getDerivedStatus(sch);
                  return (
                    <tr key={sch.schedule_id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s', ':hover': { backgroundColor: '#f8fafc' } }}>
                      <td style={{ padding: '16px 8px', fontWeight: 500 }}>{sch.last_name}{sch.first_name}</td>
                      <td style={{ padding: '16px 8px' }}>
                        <span style={{ padding: '4px 10px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 500 }} className={statusInfo.className}>
                          {statusInfo.icon} {statusInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '16px 8px', color: 'var(--color-text-secondary)' }}>{formatTime(sch.clock_in_time)}</td>
                      <td style={{ padding: '16px 8px', color: 'var(--color-text-secondary)' }}>{formatTime(sch.clock_out_time)}</td>
                      <td style={{ padding: '16px 8px' }}>
                        {sch.phone_number ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }} className="hover-text-blue">
                            <Phone size={14} /> {sch.phone_number}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>無資料</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card glass-panel" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 style={{ marginBottom: 'var(--space-3)' }}>待審核請假清單</h3>
        {pendingLeaves.length === 0 ? (
          <p style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-4) 0' }}>目前沒有待處理的假單</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>申請時間</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>員工姓名</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>假別</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>請假時間</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>詳細資訊</th>
                  <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {pendingLeaves.map(leave => (
                  <tr key={leave.leave_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '16px 8px' }}>{new Date(leave.application_time).toLocaleDateString()}</td>
                    <td style={{ padding: '16px 8px' }}>{leave.last_name}{leave.first_name}</td>
                    <td style={{ padding: '16px 8px' }}><span style={{ padding: '4px 8px', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', color: '#3b82f6', borderRadius: '4px', fontSize: '0.85rem', display: 'inline-block' }}>{leave.leave_type}</span></td>
                    <td style={{ padding: '16px 8px' }}>
                      <div style={{ fontSize: '0.9rem' }}>{new Date(leave.start_time).toLocaleString('zh-TW', { hour12: false }).slice(0, -3)} ~</div>
                      <div style={{ fontSize: '0.9rem' }}>{new Date(leave.end_time).toLocaleString('zh-TW', { hour12: false }).slice(0, -3)}</div>
                    </td>
                    <td style={{ padding: '16px 8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button onClick={() => setSelectedLeave(leave)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }} title="詳細資訊">
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info size={16} />
                          </div>
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '16px 8px' }}>
                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleAction(leave.leave_id, 'approve'); }} style={{ padding: '6px', fontSize: '0.85rem', borderRadius: '50%', border: 'none', backgroundColor: '#d1fae5', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="核准">
                          <Check size={18} strokeWidth={3} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleAction(leave.leave_id, 'reject'); }} style={{ padding: '6px', fontSize: '0.85rem', borderRadius: '50%', border: 'none', backgroundColor: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="駁回">
                          <X size={18} strokeWidth={3} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="card fade-in" style={{
            backgroundColor: 'var(--color-surface)',
            width: '100%', maxWidth: '800px', margin: '0 20px', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <button
              onClick={() => setIsModalOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-4)' }}>異常出勤排除處理</h3>

            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
                以下為超時下班被系統標記為異常的紀錄。請核實真實加班情況並給予實際工時。
              </p>

              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <div style={{ flex: '1', borderRight: '1px solid var(--color-border)', paddingRight: 'var(--space-4)' }}>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {abnormalList.map(item => (
                      <li
                        key={item.attendance_id}
                        onClick={() => setSelectedAbnormal(item)}
                        style={{
                          padding: 'var(--space-3)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          background: selectedAbnormal?.attendance_id === item.attendance_id ? 'var(--color-primary-50)' : 'transparent',
                          borderColor: selectedAbnormal?.attendance_id === item.attendance_id ? 'var(--color-primary)' : 'var(--color-border)'
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.employee_name}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                          日期：{new Date(item.schedule_date).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                    {abnormalList.length === 0 && (
                      <li style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 'var(--space-4)' }}>目前無未處理的異常紀錄</li>
                    )}
                  </ul>
                </div>

                <div style={{ flex: '1' }}>
                  {selectedAbnormal ? (
                    <div>
                      <h3 style={{ marginBottom: '16px' }}>排除異常: {selectedAbnormal.employee_name}</h3>

                      <div style={{ marginBottom: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>班表預定：</span>
                          {selectedAbnormal.schedule_start.slice(0, 5)} ~ {selectedAbnormal.schedule_end.slice(0, 5)}
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>實際打卡：</span>
                          {selectedAbnormal.clock_in_time ? new Date(selectedAbnormal.clock_in_time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '--:--'} ~
                          {selectedAbnormal.clock_out_time ? new Date(selectedAbnormal.clock_out_time).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </div>
                      </div>

                      <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                          核准實際工時 (小時)：
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          className="form-input"
                          value={approvedHours}
                          onChange={(e) => setApprovedHours(e.target.value)}
                          placeholder="例如: 8.5"
                        />
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                          輸入主管確認後該員工當日真實的工作總時數。系統將以此數值計算薪資與加班費。
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={() => setSelectedAbnormal(null)}>取消</button>
                        <button className="btn btn-primary" onClick={handleResolve} disabled={!approvedHours}>
                          <Save size={18} /> 確認排除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
                      請從左側選擇一筆異常紀錄進行處理
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedLeave && typeof document !== 'undefined' && createPortal(
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
              onClick={() => setSelectedLeave(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
            >
              <X size={24} />
            </button>
            <h3 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-4)' }}>請假詳情</h3>
            
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}><strong>申請人：</strong>{selectedLeave.last_name}{selectedLeave.first_name}</div>
              <div style={{ marginBottom: '16px' }}><strong>假別：</strong><span style={{ padding: '4px 8px', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', borderRadius: '4px', fontSize: '0.85rem', marginLeft: '8px' }}>{selectedLeave.leave_type}</span></div>
              <div style={{ marginBottom: '16px' }}><strong>請假時間：</strong></div>
              <div style={{ marginBottom: '16px', paddingLeft: '16px', color: 'var(--color-text-secondary)' }}>
                {new Date(selectedLeave.start_time).toLocaleString('zh-TW', {hour12: false}).slice(0, -3)}<br />
                ~ {new Date(selectedLeave.end_time).toLocaleString('zh-TW', {hour12: false}).slice(0, -3)}
              </div>
              <div style={{ marginBottom: '16px' }}><strong>請假事由：</strong></div>
              <div style={{ padding: '12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', minHeight: '80px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {selectedLeave.reason || '無填寫事由'}
              </div>
            </div>
            {/* 這裡已經移除了核准與駁回的按鈕，因為他們在表格操作欄位中了 */}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
