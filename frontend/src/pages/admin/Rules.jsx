import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Shield, CalendarOff, Plus, Edit2, X, Trash2 } from 'lucide-react';

export default function Rules() {
  const [activeTab, setActiveTab] = useState('employee');
  const [employeeRules, setEmployeeRules] = useState([]);
  const [operationRules, setOperationRules] = useState([]);
  const [noLeavePeriods, setNoLeavePeriods] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [formData, setFormData] = useState({});

  const fetchData = async () => {
    try {
      const [empRes, opRes, noLeaveRes] = await Promise.all([
        fetch('https://dbms-final-schedule.onrender.com/api/employee-rules'),
        fetch('https://dbms-final-schedule.onrender.com/api/operation-rules'),
        fetch('https://dbms-final-schedule.onrender.com/api/no-leave-periods')
      ]);
      const empData = await empRes.json();
      const opData = await opRes.json();
      const noLeaveData = await noLeaveRes.json();
      if (empData.success) setEmployeeRules(empData.data);
      if (opData.success) setOperationRules(opData.data);
      if (noLeaveData.success) setNoLeavePeriods(noLeaveData.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []);

  const openModal = (mode, item = null) => {
    setModalMode(mode);
    if (mode === 'add') {
      if (activeTab === 'employee') {
        setFormData({ rule_name: '', max_weekly_hours: 40, max_consecutive_days: 5, max_monthly_holiday_shifts: 4, monthly_leave_days: 8 });
      } else if (activeTab === 'operation') {
        setFormData({ rule_name: '', rule_description: '', min_staff_per_shift: 1, fixed_work_days: '一,二,三,四,五', start_time: '09:00', end_time: '18:00' });
      } else if (activeTab === 'noleave') {
        setFormData({ start_date: '', end_date: '', reason: '' });
      }
    } else {
      setFormData({ ...item });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除這筆規則嗎？')) return;
    let endpoint = '';
    if (activeTab === 'employee') endpoint = `/employee-rules/${id}`;
    if (activeTab === 'operation') endpoint = `/operation-rules/${id}`;
    if (activeTab === 'noleave') endpoint = `/no-leave-periods/${id}`;

    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api${endpoint}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('刪除失敗');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (activeTab === 'operation') {
      if (formData.start_time && formData.end_time && formData.end_time < formData.start_time) {
        alert('下班時間不能早於上班時間！');
        return;
      }
    } else if (activeTab === 'noleave') {
      if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
        alert('結束日期不能早於開始日期！');
        return;
      }
    }

    let endpoint = '';
    let id = '';
    if (activeTab === 'employee') {
      endpoint = '/employee-rules';
      id = formData.rule_id;
    } else if (activeTab === 'operation') {
      endpoint = '/operation-rules';
      id = formData.op_rule_id;
    } else if (activeTab === 'noleave') {
      endpoint = '/no-leave-periods';
      id = formData.period_id;
    }

    const url = modalMode === 'add' ? `https://dbms-final-schedule.onrender.com/api${endpoint}` : `https://dbms-final-schedule.onrender.com/api${endpoint}/${id}`;
    const method = modalMode === 'add' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch {
      alert('儲存失敗');
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>排班規則設定</h2>
          <p>管理各項核心排班參數與禁休期間。</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal('add')}>
          <Plus size={18} /> 新增{activeTab === 'employee' ? '員工規則' : activeTab === 'operation' ? '營運規則' : '禁休期間'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
        <button 
          className={`btn ${activeTab === 'employee' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottomColor: activeTab === 'employee' ? 'var(--color-primary-500)' : 'var(--color-border)' }}
          onClick={() => setActiveTab('employee')}
        >
          <Shield size={18} /> 員工排班規則
        </button>
        <button 
          className={`btn ${activeTab === 'operation' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottomColor: activeTab === 'operation' ? 'var(--color-primary-500)' : 'var(--color-border)' }}
          onClick={() => setActiveTab('operation')}
        >
          <Settings size={18} /> 營運規則
        </button>
        <button 
          className={`btn ${activeTab === 'noleave' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottomColor: activeTab === 'noleave' ? 'var(--color-primary-500)' : 'var(--color-border)' }}
          onClick={() => setActiveTab('noleave')}
        >
          <CalendarOff size={18} /> 禁止排休期間
        </button>
      </div>

      <div className="card glass-panel">
        <table className="data-table">
          <thead>
            {activeTab === 'employee' && (
              <tr>
                <th>規則名稱</th>
                <th>每週最大工時</th>
                <th>最多連續上班(天)</th>
                <th>每月最多假日班數</th>
                <th>每月排休(天)</th>
                <th>操作</th>
              </tr>
            )}
            {activeTab === 'operation' && (
              <tr>
                <th>規則名稱</th>
                <th>單班最少人數</th>
                <th>固定上班日</th>
                <th>上班時間</th>
                <th>下班時間</th>
                <th>操作</th>
              </tr>
            )}
            {activeTab === 'noleave' && (
              <tr>
                <th>禁休事由</th>
                <th>開始日期</th>
                <th>結束日期</th>
                <th>操作</th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'employee' && employeeRules.map(rule => (
              <tr key={rule.rule_id}>
                <td style={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>{rule.rule_name}</td>
                <td>{rule.max_weekly_hours}</td>
                <td>{rule.max_consecutive_days}</td>
                <td>{rule.max_monthly_holiday_shifts}</td>
                <td>{rule.monthly_leave_days}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => openModal('edit', rule)}><Edit2 size={16} /></button>
                    <button className="btn btn-secondary" style={{ padding: '6px', color: '#ef4444' }} onClick={() => handleDelete(rule.rule_id)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {activeTab === 'operation' && operationRules.map(rule => (
              <tr key={rule.op_rule_id}>
                <td style={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>{rule.rule_name}</td>
                <td>{rule.min_staff_per_shift}</td>
                <td>{rule.fixed_work_days}</td>
                <td>{rule.start_time}</td>
                <td>{rule.end_time}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => openModal('edit', rule)}><Edit2 size={16} /></button>
                    <button className="btn btn-secondary" style={{ padding: '6px', color: '#ef4444' }} onClick={() => handleDelete(rule.op_rule_id)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {activeTab === 'noleave' && noLeavePeriods.map(rule => (
              <tr key={rule.period_id}>
                <td style={{ fontWeight: 600, color: 'var(--color-primary-700)' }}>{rule.reason}</td>
                <td>{rule.start_date}</td>
                <td>{rule.end_date}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={() => openModal('edit', rule)}><Edit2 size={16} /></button>
                    <button className="btn btn-secondary" style={{ padding: '6px', color: '#ef4444' }} onClick={() => handleDelete(rule.period_id)}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem' }}>
                {modalMode === 'add' ? '新增' : '編輯'}
                {activeTab === 'employee' ? '員工規則' : activeTab === 'operation' ? '營運規則' : '禁休期間'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Employee Rules Form */}
              {activeTab === 'employee' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>規則名稱</label>
                    <input type="text" className="input-field" value={formData.rule_name || ''} onChange={e => setFormData({...formData, rule_name: e.target.value})} required />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>每週最大工時</label>
                      <input type="number" className="input-field" value={formData.max_weekly_hours || ''} onChange={e => setFormData({...formData, max_weekly_hours: Number(e.target.value)})} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>最多連續上班(天)</label>
                      <input type="number" className="input-field" value={formData.max_consecutive_days || ''} onChange={e => setFormData({...formData, max_consecutive_days: Number(e.target.value)})} required />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>每月最多假日班數</label>
                      <input type="number" className="input-field" value={formData.max_monthly_holiday_shifts || ''} onChange={e => setFormData({...formData, max_monthly_holiday_shifts: Number(e.target.value)})} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>每月排休(天)</label>
                      <input type="number" className="input-field" value={formData.monthly_leave_days || ''} onChange={e => setFormData({...formData, monthly_leave_days: Number(e.target.value)})} required />
                    </div>
                  </div>
                </>
              )}

              {/* Operation Rules Form */}
              {activeTab === 'operation' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>規則名稱</label>
                    <input type="text" className="input-field" value={formData.rule_name || ''} onChange={e => setFormData({...formData, rule_name: e.target.value})} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>規則描述</label>
                    <textarea className="input-field" value={formData.rule_description || ''} onChange={e => setFormData({...formData, rule_description: e.target.value})} required />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>單班最少人數</label>
                      <input type="number" className="input-field" value={formData.min_staff_per_shift || ''} onChange={e => setFormData({...formData, min_staff_per_shift: Number(e.target.value)})} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>固定上班日</label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '10px 0' }}>
                        {['一', '二', '三', '四', '五', '六', '日'].map(day => {
                          const currentDays = (formData.fixed_work_days || '').split(',').filter(d => d.trim() !== '');
                          const isChecked = currentDays.includes(day);
                          return (
                            <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let newDays = [...currentDays];
                                  if (e.target.checked) {
                                    if (!newDays.includes(day)) newDays.push(day);
                                  } else {
                                    newDays = newDays.filter(d => d !== day);
                                  }
                                  const order = ['一', '二', '三', '四', '五', '六', '日'];
                                  newDays.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                                  setFormData({ ...formData, fixed_work_days: newDays.join(',') });
                                }}
                              />
                              星期{day}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>上班時間</label>
                      <input type="time" className="input-field" value={formData.start_time || ''} onChange={e => setFormData({...formData, start_time: e.target.value})} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>下班時間</label>
                      <input type="time" className="input-field" value={formData.end_time || ''} onChange={e => setFormData({...formData, end_time: e.target.value})} required />
                    </div>
                  </div>
                </>
              )}

              {/* No Leave Periods Form */}
              {activeTab === 'noleave' && (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>禁休事由</label>
                    <input type="text" className="input-field" value={formData.reason || ''} onChange={e => setFormData({...formData, reason: e.target.value})} required />
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>開始日期</label>
                      <input type="date" className="input-field" value={formData.start_date || ''} onChange={e => setFormData({...formData, start_date: e.target.value})} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>結束日期</label>
                      <input type="date" className="input-field" value={formData.end_date || ''} onChange={e => setFormData({...formData, end_date: e.target.value})} required />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary">儲存設定</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
