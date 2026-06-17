import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, Wand2, Save, X, RefreshCw } from 'lucide-react';
import { History, Search, Trash2, Plus, AlertTriangle } from 'lucide-react';

export default function AdminSchedule() {
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [stats, setStats] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  const today = new Date();
  const [targetYear, setTargetYear] = useState(today.getFullYear());
  const [targetMonth, setTargetMonth] = useState(today.getMonth() + 1);
  
  const [opRules, setOpRules] = useState([]);
  const [selectedOpRule, setSelectedOpRule] = useState('');

  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapReason, setSwapReason] = useState('');
  const [mustAttendDates, setMustAttendDates] = useState([]);
  const [newEmpId, setNewEmpId] = useState('');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logSearchName, setLogSearchName] = useState('');
  const [logYear, setLogYear] = useState(today.getFullYear());
  const [logMonth, setLogMonth] = useState(today.getMonth() + 1);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearReason, setClearReason] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addTargetDate, setAddTargetDate] = useState(null);
  const [addEmpId, setAddEmpId] = useState('');
  const [addReason, setAddReason] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');

  const fetchLogs = async () => {
    try {
      const url = `https://dbms-final-schedule.onrender.com/api/schedules/logs?year=${logYear}&month=${logMonth}${logSearchName ? '&employee_name='+encodeURIComponent(logSearchName) : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if(data.success) setLogs(data.data);
    } catch (error) {
      console.error('Fetch logs error:', error);
    }
  };

  const fetchData = async () => {
    try {
      const resOp = await fetch('https://dbms-final-schedule.onrender.com/api/operation-rules');
      const dataOp = await resOp.json();
      if (dataOp.success) {
        setOpRules(dataOp.data || []);
        if (dataOp.data && dataOp.data.length > 0) setSelectedOpRule(dataOp.data[0].op_rule_id);
      }
      const resEmp = await fetch('https://dbms-final-schedule.onrender.com/api/employees');
      const dataEmp = await resEmp.json();
      if (dataEmp.success) {
        setEmployees(dataEmp.employees.filter(e => e.employment_status === '在職') || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/schedules?year=${targetYear}&month=${targetMonth}`);
      const data = await res.json();
      if (data.success) {
        setSchedules(data.schedules);
        setMustAttendDates(data.mustAttendDates || []);
      }
      const resStats = await fetch(`https://dbms-final-schedule.onrender.com/api/schedules/stats?year=${targetYear}&month=${targetMonth}`);
      const statsData = await resStats.json();
      if (statsData.success) {
        setStats(statsData.data);
      }
      
      const resLeaves = await fetch('https://dbms-final-schedule.onrender.com/api/leaves');
      const leavesData = await resLeaves.json();
      if (leavesData.success) {
        setLeaves(leavesData.leaves || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSchedules();
  }, [targetYear, targetMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (!selectedOpRule) return alert('請先選擇營運規則');
    setGenerating(true);
    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/schedules/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: targetYear, month: targetMonth, op_rule_id: selectedOpRule })
      });
      const data = await res.json();
      if (data.success) {
        alert('排班草稿已成功生成！');
        fetchSchedules();
      } else {
        alert('生成失敗: ' + data.message);
      }
    } catch {
      alert('連線失敗');
    }
    setGenerating(false);
  };

  const handlePublish = async () => {
    if (schedules.length === 0) {
      alert('目前沒有草稿可以發布！請先點擊「自動排班」或「新增」來建立草稿。');
      return;
    }
    
    // 如果全部都已發布，也不用發布了
    if (schedules.every(s => s.status === '已發布')) {
      alert('這個月的班表都已經發布過了！');
      return;
    }

    // 檢查是否有請假衝突
    const hasConflict = schedules.some(sch => 
      leaves.some(l => {
        const lStart = new Date(l.start_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
        const lEnd = new Date(l.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
        const sDate = new Date(sch.schedule_date).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
        return l.employee_id === sch.employee_id && l.status === '已核准' && lStart <= sDate && lEnd >= sDate;
      })
    );
    if (hasConflict) {
      alert('尚有請假衝突未解決，請替換或刪除紅色的排班後再進行發布！');
      return;
    }

    // 檢查是否有違反排班規則
    const violations = stats.filter(stat => 
      stat.maxConsecutiveDays > stat.rule.max_consecutive_days || 
      stat.totalOffDays < stat.rule.monthly_leave_days || 
      stat.isWeeklyHoursViolation
    );

    if (violations.length > 0) {
      const msgs = violations.map(v => {
        let issues = [];
        if (v.totalOffDays < v.rule.monthly_leave_days) issues.push(`排休不足(${v.totalOffDays}/${v.rule.monthly_leave_days}天)`);
        if (v.maxConsecutiveDays > v.rule.max_consecutive_days) issues.push(`連班過長(${v.maxConsecutiveDays}/${v.rule.max_consecutive_days}天)`);
        if (v.isWeeklyHoursViolation) issues.push(`週工時超標`);
        return `- ${v.employee_name}: ${issues.join('、')}`;
      });
      alert(`無法發布！有員工違反排班規則：\n${msgs.join('\n')}\n\n請先進行手動替換，修正草稿後再發布。`);
      return;
    }

    const firstSch = schedules[0];
    if (firstSch) {
      const rule = opRules.find(r => r.op_rule_id === firstSch.op_rule_id);
      const minStaff = rule ? rule.min_staff_per_shift : 0;
      
      if (minStaff > 0) {
        let understaffedDays = [];
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        
        for (let d = 1; d <= daysInMonth; d++) {
          const targetY = parseInt(targetYear);
          const targetM = parseInt(targetMonth) - 1;
          const targetD = d;
          const dateStrYMD = `${targetY}-${String(targetM + 1).padStart(2, '0')}-${String(targetD).padStart(2, '0')}`;
          
          const dayData = schedules.filter(sch => {
            const schD = new Date(sch.schedule_date);
            return schD.getFullYear() === targetY && 
                   schD.getMonth() === targetM && 
                   schD.getDate() === targetD;
          });
          
          if (dayData.length < minStaff) {
            understaffedDays.push(`${dateStrYMD} (缺 ${minStaff - dayData.length} 人)`);
          }
        }
        
        if (understaffedDays.length > 0) {
          alert(`無法發布！以下日期排班人數低於單班最少人數 (${minStaff} 人)：\n${understaffedDays.join('\n')}\n\n請補齊人數後再發布。`);
          return;
        }
      }
    }

    setPublishing(true);
    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/schedules/publish', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('班表已發佈！系統將自動排程發送上班通知提醒。');
        fetchSchedules();
      } else {
        alert('發布失敗: ' + data.message);
      }
    } catch {
      alert('連線失敗');
    }
    setPublishing(false);
  };

  const openSwapModal = (schedule) => {
    setSwapTarget(schedule);
    
    setNewEmpId('');
    setIsSwapModalOpen(true);
  };

  const handleSwap = async (e) => {
    e.preventDefault();
    if (!newEmpId) return alert('請選擇替換員工');
    try {
      const res = await fetch(`https://dbms-final-schedule.onrender.com/api/schedules/${swapTarget.schedule_id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_employee_id: newEmpId, reason: swapReason, operator_id: JSON.parse(localStorage.getItem('currentUser'))?.employee_id })
      });
      const data = await res.json();
      if (data.success) {
        alert('替換成功！');
        setIsSwapModalOpen(false);
        fetchSchedules();
      } else {
        alert('替換失敗: ' + data.message);
      }
    } catch {
      alert('連線失敗');
    }
  };

  const handleClear = async (e) => {
    e.preventDefault();
    const isPublished = schedules.some(s => s.status === '已發布');
    if (isPublished && !clearReason) return alert('已發布的班表清空必須填寫理由');
    
    if (!window.confirm(`確定要清空 ${targetYear} 年 ${targetMonth} 月的班表嗎？此動作無法復原！`)) return;

    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/schedules/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          year: targetYear, 
          month: targetMonth, 
          reason: clearReason, 
          operator_id: JSON.parse(localStorage.getItem('currentUser'))?.employee_id 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('班表已清空！');
        setIsClearModalOpen(false);
        setClearReason('');
        fetchSchedules();
      } else {
        alert('清空失敗: ' + data.message);
      }
    } catch {
      alert('連線失敗');
    }
  };

  const handleAddSingle = async (e) => {
    e.preventDefault();
    if (!addEmpId) return alert('請選擇要新增的員工');
    const isPublished = schedules.some(s => s.status === '已發布');
    if (isPublished && !addReason) return alert('已發布的班表新增必須填寫理由');

    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/schedules/add-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          schedule_date: addTargetDate, 
          employee_id: addEmpId, 
          op_rule_id: selectedOpRule,
          reason: addReason, 
          operator_id: JSON.parse(localStorage.getItem('currentUser'))?.employee_id 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('新增成功！');
        setIsAddModalOpen(false);
        setAddEmpId('');
        setAddReason('');
        fetchSchedules();
      } else {
        alert('新增失敗: ' + data.message);
      }
    } catch {
      alert('連線失敗');
    }
  };

  const handleDeleteSingle = async (e) => {
    e.preventDefault();
    const isPublished = schedules.some(s => s.status === '已發布');
    if (isPublished && !deleteReason) return alert('已發布的班表刪除必須填寫理由');

    try {
      const res = await fetch('https://dbms-final-schedule.onrender.com/api/schedules/delete-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          schedule_id: deleteTarget.schedule_id, 
          reason: deleteReason, 
          operator_id: JSON.parse(localStorage.getItem('currentUser'))?.employee_id 
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.warning) {
          alert(data.warning);
        } else {
          alert('刪除成功！');
        }
        setIsDeleteModalOpen(false);
        setDeleteTarget(null);
        setDeleteReason('');
        fetchSchedules();
      } else {
        alert('刪除失敗: ' + data.message);
      }
    } catch {
      alert('連線失敗');
    }
  };

  const groupedSchedules = schedules.reduce((acc, sch) => {
    const date = new Date(sch.schedule_date).toLocaleDateString();
    if (!acc[date]) acc[date] = { onDuty: [], offDuty: [], status: sch.status };
    acc[date].onDuty.push(sch);
    return acc;
  }, {});

  Object.keys(groupedSchedules).forEach(date => {
     const onDutyIds = new Set(groupedSchedules[date].onDuty.map(s => s.employee_id));
     groupedSchedules[date].offDuty = employees
        .filter(emp => !onDutyIds.has(emp.employee_id))
        .map(emp => ({ ...emp, schedule_date: new Date(date).toISOString().split('T')[0] }));
  });

  // Calendar rendering logic
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const firstDayOfWeek = new Date(targetYear, targetMonth - 1, 1).getDay();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(<div key={`empty-${i}`} style={{ backgroundColor: 'transparent', padding: 'var(--space-2)' }} />);
  }

  let monthStatus = null;
  if (schedules.length > 0) {
    monthStatus = schedules.some(s => s.status === '草稿') ? '草稿' : '已發布';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(targetYear, targetMonth - 1, d);
    const dateStr = dateObj.toLocaleDateString();
    const dateStrYMD = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = groupedSchedules[dateStr] || { onDuty: [], offDuty: [], status: null };
    const isDraft = dayData.status === '草稿';
    const isMustAttend = mustAttendDates.includes(dateStrYMD);

    calendarCells.push(
      <div key={d} style={{ 
        border: isMustAttend ? '2px solid #609afa' : '1px solid var(--color-border)', 
        borderRadius: 'var(--radius-md)', 
        padding: 'var(--space-2)', 
        backgroundColor: isDraft ? 'var(--color-surface)' : (dayData.status ? '#f8fafc' : '#ffffff'),
        minHeight: '120px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
          <strong style={{ fontSize: '1.1rem', color: dayData.status ? 'inherit' : 'var(--color-text-tertiary)' }}>{d}</strong>
        </div>
        <div style={{ flex: 1 }}>
          {dayData.onDuty.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {isMustAttend ? (
                <>
                <span 
                  style={{ 
                    padding: '4px 8px', 
                    backgroundColor: '#eff5ff', 
                    color: '#2555eb', 
                    border: '1px solid #93bdfd',
                    borderRadius: '4px', 
                    fontSize: '0.85rem', 
                    fontWeight: 'bold',
                    cursor: 'default',
                    width: '100%',
                    textAlign: 'center'
                  }}
                >
                  全體員工必到
                </span>
                {leaves.filter(l => {
                  const lStart = new Date(l.start_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
                  const lEnd = new Date(l.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
                  return l.status === '已核准' && lStart <= dateStrYMD && lEnd >= dateStrYMD;
                }).map(l => {
                   const emp = employees.find(e => e.employee_id === l.employee_id);
                   if (!emp) return null;
                   return (
                     <div key={`leave-${l.leave_id}`} style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e5e7eb', color: '#6b7280', borderRadius: '4px', padding: '2px 6px', fontSize: '0.85rem', width: '100%' }}>
                       {emp.last_name}{emp.first_name} (休)
                     </div>
                   );
                })}
                </>
              ) : (
                dayData.onDuty.map(sch => {
                  const isConflict = leaves.some(l => {
                    const lStart = new Date(l.start_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
                    const lEnd = new Date(l.end_time).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
                    return l.employee_id === sch.employee_id && l.status === '已核准' && lStart <= dateStrYMD && lEnd >= dateStrYMD;
                  });
                  return (
                  <div key={sch.schedule_id} style={{ display: 'flex', alignItems: 'center', backgroundColor: isConflict ? '#ef4444' : 'var(--color-primary-500)', border: isConflict ? '2px solid #b91c1c' : 'none', color: 'white', borderRadius: '4px', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', width: '100%' }}>
                    <span 
                      onClick={() => openSwapModal({ ...sch, dateStr })}
                      style={{ 
                        padding: '2px 6px', 
                        fontSize: '0.85rem', 
                        cursor: 'pointer',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={isConflict ? "此員工在該日已請假，請點擊替換人員" : "點擊替換人員"}
                    >
                      {sch.last_name}{sch.first_name}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({...sch, dateStr}); setIsDeleteModalOpen(true); }}
                      style={{ background: 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.3)', color: 'white', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="刪除"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  );
                })
              )}
              {(!isMustAttend && schedules.length > 0) && (
                <button 
                  onClick={() => { setAddTargetDate(dateStrYMD); setIsAddModalOpen(true); }}
                  style={{ 
                    padding: '2px 6px', 
                    backgroundColor: 'transparent', 
                    color: 'var(--color-primary-600)', 
                    border: '1px dashed var(--color-primary-400)',
                    borderRadius: '4px', 
                    fontSize: '0.85rem', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px'
                  }}
                  title="單日新增人員"
                >
                  <Plus size={12} /> 新增
                </button>
              )}
            </div>
          ) : dayData.status ? (
            <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>無排班</div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>班表生成與發布</h2>
          <p>自動生成班表草稿並發布最新班表。</p>
        </div>
        
        <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>年份</label>
              <input type="number" className="input-field" value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} style={{ width: '100px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>月份</label>
              <input type="number" className="input-field" value={targetMonth} onChange={e => setTargetMonth(Number(e.target.value))} min="1" max="12" style={{ width: '80px' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>套用營運規則</label>
              <select className="input-field" value={selectedOpRule} onChange={e => setSelectedOpRule(e.target.value)}>
                {opRules.map(rule => (
                  <option key={rule.op_rule_id} value={rule.op_rule_id}>{rule.rule_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={handleGenerate} disabled={generating} className="btn btn-secondary" style={{ flex: 1 }}>
              <Wand2 size={18} /> {generating ? '生成中...' : '生成班表'}
            </button>
            <button onClick={handlePublish} className="btn btn-primary" disabled={publishing} style={{ flex: 1 }}>
              <Save size={18} /> 發布草稿
            </button>
            <button onClick={() => setIsClearModalOpen(true)} className="btn btn-secondary" style={{ flex: 1, backgroundColor: '#fef2f2', color: '#ef4444', borderColor: '#fca5a5' }} disabled={schedules.length === 0}>
              <Trash2 size={18} /> 清空班表
            </button>
            <button onClick={() => { setIsLogModalOpen(true); fetchLogs(); }} className="btn btn-secondary" style={{ flex: 1, backgroundColor: '#eff5ff', color: '#2555eb', borderColor: '#93bdfd' }}>
              <History size={18} /> 異動記錄
            </button>
          </div>
        </div>
      </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
        <div className="card glass-panel" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ margin: 0 }}>{targetYear} 年 {targetMonth} 月 班表預覽</h3>
          {monthStatus && (
            <span style={{ 
              padding: '4px 12px', 
              borderRadius: '99px', 
              fontSize: '0.9rem',
              fontWeight: 'bold',
              backgroundColor: monthStatus === '草稿' ? 'var(--color-primary-100)' : '#ecfdf5',
              color: monthStatus === '草稿' ? 'var(--color-primary-700)' : '#047857',
            }}>
              狀態：{monthStatus}
            </span>
          )}
        </div>
        {Object.keys(groupedSchedules).length === 0 ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <CalendarIcon size={64} color="var(--color-text-tertiary)" />
            <h3 style={{ color: 'var(--color-text-secondary)' }}>該月份目前無排班紀錄，請點擊「自動生成班表」來產生草稿</h3>
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <div style={{ minWidth: '800px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
              {weekDays.map(day => (
                <div key={day} style={{ textAlign: 'center', fontWeight: 'bold', padding: '8px 0', color: 'var(--color-text-secondary)', borderBottom: '2px solid var(--color-border)' }}>
                  星期{day}
                </div>
              ))}
              {calendarCells}
            </div>
          </div>
        )}
      </div>

        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
           <div className="card glass-panel" style={{ display: 'flex', flexDirection: 'column', maxHeight: '750px' }}>
             <h3 style={{ margin: '0 0 var(--space-3) 0', fontSize: '1.1rem', flexShrink: 0 }}>排班統計預覽</h3>
             <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
               {stats.length === 0 ? <p style={{color: 'var(--color-text-secondary)', fontSize: '0.9rem'}}>暫無統計資料</p> : stats.map(s => (
                 <div key={s.employee_id} style={{ marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
                   <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '1rem', color: 'var(--color-primary-700)' }}>{s.employee_name}</div>
                   <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>總上班天數：</span>
                        <span>{s.totalWorkDays} 天</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: s.isWeeklyHoursViolation ? '#ef4444' : 'inherit', fontWeight: s.isWeeklyHoursViolation ? 'bold' : 'normal', backgroundColor: s.isWeeklyHoursViolation ? '#fee2e2' : 'transparent', padding: s.isWeeklyHoursViolation ? '2px 4px' : '0', borderRadius: '4px' }}>
                        <span>總工時 (週限 {s.rule.max_weekly_hours}h)：</span>
                        <span>{s.totalHours} 小時</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: s.totalOffDays < s.rule.monthly_leave_days ? '#ef4444' : 'inherit', fontWeight: s.totalOffDays < s.rule.monthly_leave_days ? 'bold' : 'normal', backgroundColor: s.totalOffDays < s.rule.monthly_leave_days ? '#fee2e2' : 'transparent', padding: s.totalOffDays < s.rule.monthly_leave_days ? '2px 4px' : '0', borderRadius: '4px' }}>
                        <span>排休 (最低 {s.rule.monthly_leave_days}d)：</span>
                        <span>{s.totalOffDays} 天</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: s.maxConsecutiveDays > s.rule.max_consecutive_days ? '#ef4444' : 'inherit', fontWeight: s.maxConsecutiveDays > s.rule.max_consecutive_days ? 'bold' : 'normal', backgroundColor: s.maxConsecutiveDays > s.rule.max_consecutive_days ? '#fee2e2' : 'transparent', padding: s.maxConsecutiveDays > s.rule.max_consecutive_days ? '2px 4px' : '0', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>連班 (最高 {s.rule.max_consecutive_days}d)：</span>
                          <span>{s.maxConsecutiveDays} 天</span>
                        </div>
                        {s.maxConsecutiveDays > s.rule.max_consecutive_days && s.maxConsecutiveStartDate && (
                          <div style={{ fontSize: '0.8rem', textAlign: 'right', marginTop: '-4px' }}>
                            ({new Date(s.maxConsecutiveStartDate).getDate()}日 ~ {new Date(s.maxConsecutiveEndDate).getDate()}日)
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>已核准請假：</span>
                        <span>{s.approvedLeaveDays} 天</span>
                      </div>
                   </div>
                 </div>
               ))}
             </div>
           </div>
        </div>
      </div>

      {isSwapModalOpen && swapTarget && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem' }}>替換排班人員</h3>
              <button onClick={() => setIsSwapModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              替換 {new Date(swapTarget.schedule_date).toLocaleDateString()} 的值班人員 <strong>{swapTarget.last_name}{swapTarget.first_name}</strong>
            </p>
            <form onSubmit={handleSwap} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>選擇新人員</label>
                <select className="input-field" value={newEmpId} onChange={e => setNewEmpId(e.target.value)} required>
                  <option value="">-- 請選擇 --</option>
                  {groupedSchedules[swapTarget.dateStr]?.offDuty.map(sch => (
                    <option key={sch.employee_id} value={sch.employee_id}>{sch.last_name}{sch.first_name}</option>
                  ))}
                </select>
              </div>
              {monthStatus === '已發布' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>替換事由 <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" value={swapReason} onChange={e => setSwapReason(e.target.value)} placeholder="請輸入單筆修改原因" required />
                  <p style={{fontSize: '0.85rem', color: 'var(--color-text-tertiary)', marginTop: '4px'}}>已發布的班表異動將會寫入稽核紀錄</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsSwapModalOpen(false)}>取消</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><RefreshCw size={18} /> 確認替換</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}


      {isClearModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}><AlertTriangle size={20} /> 清空整月班表</h3>
              <button onClick={() => setIsClearModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleClear} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <p>即將清空 <strong>{targetYear} 年 {targetMonth} 月</strong> 的所有排班資料，此操作無法復原。</p>
              {monthStatus === '已發布' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>清空事由 <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" value={clearReason} onChange={e => setClearReason(e.target.value)} required placeholder="請說明為何清空已發布的班表" />
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsClearModalOpen(false)}>取消</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444' }}><Trash2 size={18} /> 確認清空</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isAddModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem' }}>單日新增人員</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              新增人員至 <strong>{addTargetDate}</strong> 的班表
            </p>
            <form onSubmit={handleAddSingle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>選擇新人員</label>
                <select className="input-field" value={addEmpId} onChange={e => setAddEmpId(e.target.value)} required>
                  <option value="">-- 請選擇 --</option>
                  {(() => {
                    const dateSchs = groupedSchedules[new Date(addTargetDate).toLocaleDateString()];
                    return dateSchs?.offDuty.map(sch => (
                      <option key={sch.employee_id} value={sch.employee_id}>{sch.last_name}{sch.first_name}</option>
                    ));
                  })()}
                </select>
              </div>
              {monthStatus === '已發布' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>新增事由 <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" value={addReason} onChange={e => setAddReason(e.target.value)} required placeholder="請輸入單筆新增原因" />
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddModalOpen(false)}>取消</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}><Plus size={18} /> 確認新增</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isDeleteModalOpen && deleteTarget && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#ef4444' }}>單日刪除人員</h3>
              <button onClick={() => setIsDeleteModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleDeleteSingle} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <p>確定要將 <strong>{deleteTarget.last_name}{deleteTarget.first_name}</strong> 從 <strong>{deleteTarget.dateStr}</strong> 的班表中刪除嗎？</p>
              {monthStatus === '已發布' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>刪除事由 <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} required placeholder="請輸入單筆刪除原因" />
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsDeleteModalOpen(false)}>取消</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, backgroundColor: '#ef4444', borderColor: '#ef4444' }}><Trash2 size={18} /> 確認刪除</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isLogModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><History size={20} /> 班表異動記錄</h3>
              <button onClick={() => setIsLogModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>查詢年份</label>
                <input type="number" className="input-field" value={logYear} onChange={e => setLogYear(e.target.value)} style={{ width: '100px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>查詢月份</label>
                <input type="number" className="input-field" value={logMonth} onChange={e => setLogMonth(e.target.value)} min="1" max="12" style={{ width: '80px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>員工姓名</label>
                <input type="text" className="input-field" placeholder="輸入姓名查詢..." value={logSearchName} onChange={e => setLogSearchName(e.target.value)} style={{ width: '150px' }} />
              </div>
              <button onClick={fetchLogs} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                <Search size={16} /> 查詢
              </button>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-surface)', whiteSpace: 'nowrap' }}>
                  <tr>
                    <th style={{ padding: '12px', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>操作時間</th>
                    <th style={{ padding: '12px', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>操作管理者</th>
                    <th style={{ padding: '12px', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>異動日期</th>
                    <th style={{ padding: '12px', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>異動類型</th>
                    <th style={{ padding: '12px', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>異動前員工</th>
                    <th style={{ padding: '12px', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>異動後員工</th>
                    <th style={{ padding: '12px', borderBottom: '2px solid var(--color-border)', textAlign: 'center', whiteSpace: 'normal' }}>異動事由</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length > 0 ? logs.map(log => (
                    <tr key={log.log_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{new Date(log.operation_time).toLocaleString()}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{log.op_last_name ? log.op_last_name + log.op_first_name : '系統'}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{new Date(log.change_date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{log.action_type || '系統排程'}</td>
                      <td style={{ padding: '12px', color: '#ef4444', textAlign: 'center' }}>{log.orig_last_name ? log.orig_last_name + log.orig_first_name : '-'}</td>
                      <td style={{ padding: '12px', color: '#10b981', textAlign: 'center' }}>{log.new_last_name ? log.new_last_name + log.new_first_name : '-'}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{log.reason || '-'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>無符合條件的異動紀錄</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
