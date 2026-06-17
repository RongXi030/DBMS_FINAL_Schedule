import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Search, UserCheck, UserX, X, Info, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Employees() {
  const { user, logout } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');

  const [employeeRules, setEmployeeRules] = useState([]);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [formData, setFormData] = useState({
    last_name: '', first_name: '', position: '員工', account: '', password: '',
    gender: 'M', employment_status: '在職', remaining_special_leave_days: 0,
    email: '', phone_number: '', rule_id: ''
  });

  const fetchEmployees = (query = '') => {
    fetch(`https://dbms-final-schedule.onrender.com/api/employees?search=${query}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEmployees(data.employees);
        }
      })
      .catch(error => console.error('Error fetching employees:', error));
  };

  useEffect(() => {
    fetchEmployees();
    fetch('https://dbms-final-schedule.onrender.com/api/rules')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEmployeeRules(data.employeeRules);
        }
      });
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchEmployees(search);
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ last_name: '', first_name: '', position: '員工', gender: 'M', employment_status: '在職', remaining_special_leave_days: 0, email: '', phone_number: '', rule_id: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (emp) => {
    setModalMode('edit');
    setFormData({ ...emp, original_position: emp.position, rule_id: emp.rule_id || '' });
    setIsModalOpen(true);
  };

  const openDetailModal = (emp) => {
    setDetailEmp(emp);
    setDetailModalOpen(true);
  };

  const calcTenure = (hireDate) => {
    if (!hireDate) return '未知';
    const start = new Date(hireDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 365) + ' 年';
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();

    if (modalMode === 'edit' && formData.position !== formData.original_position) {
      if (!window.confirm('確定要變更員工的職位嗎？')) return;
    }

    const url = modalMode === 'add' ? 'https://dbms-final-schedule.onrender.com/api/employees' : `https://dbms-final-schedule.onrender.com/api/employees/${formData.employee_id}`;
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

        if (modalMode === 'edit' && formData.position !== formData.original_position && user.employee_id === formData.employee_id) {
          alert('您的職位已變更，請重新登入！');
          logout();
          return;
        }

        if (modalMode === 'add') {
          alert(`新增成功！
預設帳號: ${data.account}
預設密碼: password`);
        }

        fetchEmployees(search);
      } else {
        alert(data.message);
      }
    } catch {
      alert('連線失敗');
    }
  };

  const handleResetPassword = async (id) => {
    if (!window.confirm('確定要將該員工的密碼重置為預設密碼 (password) 嗎？')) return;
    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/employees/${id}/reset-password`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (data.success) {
        alert('密碼已成功重置為 password');
      } else {
        alert('重置失敗：' + data.message);
      }
    } catch {
      alert('連線失敗');
    }
  };

  const handleStatusToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === '在職' ? '離職' : '在職';
    if (!window.confirm(`確定要將該員工狀態更改為「${newStatus}」嗎？`)) return;

    try {
      const emp = employees.find(e => e.employee_id === id);
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/employees/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employment_status: newStatus,
          position: emp.position,
          remaining_special_leave_days: emp.remaining_special_leave_days,
          last_name: emp.last_name,
          first_name: emp.first_name,
          gender: emp.gender,
          email: emp.email,
          phone_number: emp.phone_number,
          rule_id: emp.rule_id
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchEmployees(search);
      } else {
        alert('狀態更新失敗：' + data.message);
      }
    } catch {
      alert('連線錯誤');
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>基礎資料登錄</h2>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}><Plus size={18} /> 新增員工</button>
      </div>

      <div className="card glass-panel" style={{ marginBottom: 'var(--space-3)' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="搜尋姓名或帳號..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
          <button type="submit" className="btn btn-secondary">
            <Search size={18} /> 查詢
          </button>
        </form>
      </div>

      <div className="card glass-panel">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>編號</th>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>姓名</th>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>帳號</th>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>職位</th>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>特休餘額</th>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>在職狀態</th>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>操作</th>
                <th style={{ padding: '12px 8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>詳細資訊</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.employee_id} style={{ borderBottom: '1px solid var(--color-border)', opacity: emp.employment_status === '離職' ? 0.6 : 1 }}>
                  <td style={{ padding: '16px 8px' }}>#{emp.employee_id}</td>
                  <td style={{ padding: '16px 8px', fontWeight: 500 }}>{emp.last_name}{emp.first_name}</td>
                  <td style={{ padding: '16px 8px' }}>{emp.account}</td>
                  <td style={{ padding: '16px 8px' }}>
                    <span style={{
                      padding: '4px 8px',
                      backgroundColor: emp.position === '管理者' ? '#f3e8ff' : 'var(--color-primary-50)',
                      color: emp.position === '管理者' ? '#7e22ce' : 'var(--color-primary-600)',
                      borderRadius: '4px', fontSize: '0.85rem'
                    }}>
                      {emp.position}
                    </span>
                  </td>
                  <td style={{ padding: '16px 8px' }}>{emp.remaining_special_leave_days} 天</td>
                  <td style={{ padding: '16px 8px' }}>
                    <span style={{ color: emp.employment_status === '在職' ? '#10b981' : '#ef4444', fontWeight: 500 }}>{emp.employment_status}</span>
                  </td>
                  <td style={{ padding: '16px 8px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" onClick={() => openEditModal(emp)} style={{ padding: '6px' }} title="編輯資料"><Edit2 size={16} /></button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleStatusToggle(emp.employee_id, emp.employment_status)}
                        style={{ padding: '6px', color: emp.employment_status === '在職' ? '#ef4444' : '#10b981' }}
                        title={emp.employment_status === '在職' ? "設為離職" : "復職"}
                      >
                        {emp.employment_status === '在職' ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleResetPassword(emp.employee_id)}
                        style={{ padding: '6px', color: '#eab308' }}
                        title="重置密碼"
                      >
                        <KeyRound size={16} />
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '16px 8px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary" onClick={() => openDetailModal(emp)} style={{ padding: '6px' }} title="查看詳情"><Info size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-tertiary)' }}>找不到符合條件的員工</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card glass-panel" style={{ width: '100%', maxWidth: '500px', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem' }}>{modalMode === 'add' ? '新增員工' : '編輯員工'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>姓氏</label>
                  <input type="text" className="input-field" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>名字</label>
                  <input type="text" className="input-field" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>電子郵件</label>
                  <input type="email" className="input-field" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="選填" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>電話號碼</label>
                  <input type="text" className="input-field" value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: e.target.value })} placeholder="選填" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>性別</label>
                  <select className="input-field" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                    <option value="M">男</option>
                    <option value="F">女</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>權限角色</label>
                  <select className="input-field" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })}>
                    <option value="員工">員工</option>
                    <option value="管理者">管理者</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>特休餘額</label>
                  <input type="number" className="input-field" value={formData.remaining_special_leave_days ?? 0} onChange={e => setFormData({ ...formData, remaining_special_leave_days: Number(e.target.value) })} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>套用規則</label>
                  <select className="input-field" value={formData.rule_id || ''} onChange={e => setFormData({ ...formData, rule_id: e.target.value ? Number(e.target.value) : '' })}>
                    <option value="">無 (不套用)</option>
                    {employeeRules.map(rule => (
                      <option key={rule.rule_id} value={rule.rule_id}>{rule.rule_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
                <button type="submit" className="btn btn-primary">{modalMode === 'add' ? '確認新增' : '儲存變更'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {detailModalOpen && detailEmp && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card glass-panel" style={{ width: '100%', maxWidth: '500px', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem' }}>員工詳細資料</h3>
              <button onClick={() => setDetailModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', lineHeight: '1.6' }}>
              <div><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>姓名</p><p style={{ fontWeight: 500 }}>{detailEmp.last_name}{detailEmp.first_name}</p></div>
              <div><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>職位</p><p style={{ fontWeight: 500 }}>{detailEmp.position}</p></div>
              <div><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>性別</p><p style={{ fontWeight: 500 }}>{detailEmp.gender === 'M' ? '男' : '女'}</p></div>
              <div><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>在職狀態</p><p style={{ fontWeight: 500, color: detailEmp.employment_status === '在職' ? '#10b981' : '#ef4444' }}>{detailEmp.employment_status}</p></div>
              <div><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>入職日期</p><p style={{ fontWeight: 500 }}>{detailEmp.hire_date ? detailEmp.hire_date.substring(0, 10) : '未知'}</p></div>
              <div><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>推算年資</p><p style={{ fontWeight: 500 }}>{calcTenure(detailEmp.hire_date)}</p></div>
              <div style={{ gridColumn: '1 / -1' }}><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>電子郵件</p><p style={{ fontWeight: 500 }}>{detailEmp.email || '未提供'}</p></div>
              <div style={{ gridColumn: '1 / -1' }}><p style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>電話號碼</p><p style={{ fontWeight: 500 }}>{detailEmp.phone_number || '未提供'}</p></div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );

}
