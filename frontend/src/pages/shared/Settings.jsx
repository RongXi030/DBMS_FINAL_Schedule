import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Phone, Calendar, Briefcase, Activity, Clock, Edit2, X } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [editingField, setEditingField] = useState(null); // 'email' or 'phone_number'
  const [editValue, setEditValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const calculateSeniority = (hireDate) => {
    if (!hireDate) return '0 年';
    const start = new Date(hireDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
    return `${diffYears} 年`;
  };

  const handleEditClick = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const handleConfirmEdit = async () => {
    if (!window.confirm(`確定要修改${editingField === 'email' ? '電子郵件' : '電話號碼'}嗎？`)) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: user.account,
          [editingField]: editValue
        })
      });
      
      const data = await response.json();
      if (data.success) {
        alert('資料更新成功！');
        // Update local storage and reload to reflect changes
        const updatedUser = { ...user, [editingField]: editValue };
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        window.location.reload();
      } else {
        alert(data.message || '更新失敗');
      }
    } catch (error) {
      alert('伺服器錯誤');
    } finally {
      setIsLoading(false);
      setEditingField(null);
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'var(--space-4)' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-6)', color: 'var(--color-text-primary)' }}>個人設定</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
        
        {/* Basic Info Card */}
        <div className="card glass-panel" style={{ padding: 'var(--space-8)' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-2)' }}>基礎資料</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '40px 24px' }}>
            
            {/* Row 1 */}
            <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>姓名</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.last_name}{user.first_name}</div>
              </div>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>性別</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.gender === 'M' ? '男' : '女'}</div>
              </div>
            </div>

            {/* Row 2 */}
            <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Briefcase size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>職位</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.position}</div>
              </div>
            </div>

            <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Activity size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>在職狀態</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: user.employment_status === '在職' ? '#d1fae5' : '#fee2e2', color: user.employment_status === '在職' ? '#059669' : '#dc2626', fontSize: '0.9rem' }}>
                    {user.employment_status}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>入職日期</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{new Date(user.hire_date).toLocaleDateString('zh-TW')}</div>
              </div>
            </div>

            {/* Row 3 */}
            <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>年資</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{calculateSeniority(user.hire_date)}</div>
              </div>
            </div>

            {/* Row 4 */}
            <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>電子郵件</div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem', wordBreak: 'break-all' }}>{user.email || '未設定'}</div>
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => handleEditClick('email', user.email)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
                <Edit2 size={16} /> 編輯
              </button>
            </div>

            {/* Row 5 */}
            <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>電話號碼</div>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user.phone_number || '未設定'}</div>
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => handleEditClick('phone_number', user.phone_number)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
                <Edit2 size={16} /> 編輯
              </button>
            </div>

          </div>
        </div>

        {editingField && createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', margin: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ margin: 0 }}>修改{editingField === 'email' ? '電子郵件' : '電話號碼'}</h3>
                <button 
                  onClick={() => setEditingField(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  新{editingField === 'email' ? '電子郵件' : '電話號碼'}
                </label>
                <input
                  type={editingField === 'email' ? 'email' : 'text'}
                  className="form-input"
                  style={{ padding: '12px', fontSize: '1rem', width: '100%' }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder={`輸入新的${editingField === 'email' ? '電子郵件' : '電話號碼'}`}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button className="btn btn-outline" onClick={() => setEditingField(null)} disabled={isLoading}>
                  取消
                </button>
                <button className="btn btn-primary" onClick={handleConfirmEdit} disabled={isLoading || !editValue}>
                  {isLoading ? '處理中...' : '確認'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        
      </div>
    </div>
  );
}
