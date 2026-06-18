import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertCircle, CheckCircle, Clock, AlertTriangle, Trophy } from 'lucide-react';

export default function Reports() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingLeaves: 0,
    abnormalAttendances: 0
  });

  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [detailedData, setDetailedData] = useState([]);

  const fetchStats = () => {
    fetch(`https://dbms-final-schedule.onrender.com/api/reports/stats?year=${year}&month=${month}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setStats(data.stats);
      })
      .catch(e => console.error(e));
  };

  const fetchDetailedReport = () => {
    fetch(`https://dbms-final-schedule.onrender.com/api/reports/detailed?year=${year}&month=${month}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setDetailedData(data.data);
      })
      .catch(e => console.error(e));
  };

  useEffect(() => {
    fetchStats();
    fetchDetailedReport();
  }, [year, month]);

  const avgAttendance = detailedData.length ? (detailedData.reduce((acc, curr) => acc + curr.attendanceRate, 0) / detailedData.length).toFixed(1) : 0;
  const totalAbnormal = detailedData.reduce((acc, curr) => acc + curr.abnormal.late + curr.abnormal.early + curr.abnormal.absent, 0);

  const topAbnormal = [...detailedData]
    .filter(emp => (emp.abnormal.late + emp.abnormal.early + emp.abnormal.absent) > 0)
    .sort((a, b) => (b.abnormal.late + b.abnormal.early + b.abnormal.absent) - (a.abnormal.late + a.abnormal.early + a.abnormal.absent))
    .slice(0, 3);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>統計報表生成</h2>
          <p>檢視員工出勤率、異常統計與各項營運數據。</p>
        </div>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>年份</label>
            <input type="number" className="input-field" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: '100px', textAlign: 'center' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>月份</label>
            <input type="number" className="input-field" value={month} onChange={e => setMonth(Number(e.target.value))} min="1" max="12" style={{ width: '80px', textAlign: 'center' }} />
          </div>
        </div>

        <div style={{ flex: 1 }}></div>
      </div>

      <div className="grid-system" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 'var(--space-6)' }}>
        <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <TrendingUp size={48} color="#10b981" style={{ margin: '0 auto var(--space-3)' }} />
          <h3 style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>全店平均出勤率</h3>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: '#10b981' }}>{avgAttendance}%</div>
        </div>

        <div className="card glass-panel" style={{ padding: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <AlertTriangle color="#ef4444" size={24} /> 出勤異常 Top 3
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topAbnormal.length === 0 ? <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center' }}>本月無異常紀錄</p> : topAbnormal.map((emp, index) => {
              const abnormalCount = emp.abnormal.late + emp.abnormal.early + emp.abnormal.absent;
              const details = [];
              if (emp.abnormal.late > 0) details.push(`遲到 ${emp.abnormal.late}`);
              if (emp.abnormal.early > 0) details.push(`早退 ${emp.abnormal.early}`);
              if (emp.abnormal.absent > 0) details.push(`缺勤 ${emp.abnormal.absent}`);
              return (
                <div key={emp.employee_id} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: index < topAbnormal.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ fontWeight: 500 }}>第 {index + 1} 名：{emp.name}</div>
                  <div style={{ color: '#ef4444' }}>{abnormalCount} 次 <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>({details.join('、')})</span></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card glass-panel" style={{ textAlign: 'center', padding: 'var(--space-6) var(--space-4)' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto var(--space-3)' }} />
          <h3 style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', marginBottom: '8px' }}>本月異常總次數</h3>
          <div style={{ fontSize: '3rem', fontWeight: 700, color: '#ef4444' }}>{totalAbnormal} 次</div>
        </div>
      </div>

      <div className="card glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>員工詳細月報表</h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>員工姓名</th>
                <th>應出勤</th>
                <th>實打卡</th>
                <th>已准假</th>
                <th>異常(遲/早/缺)</th>
                <th>出勤率</th>
                <th>總工時</th>
              </tr>
            </thead>
            <tbody>
              {detailedData.map(emp => (
                <tr key={emp.employee_id}>
                  <td style={{ fontWeight: 500 }}>{emp.name}</td>
                  <td>{emp.scheduledDays} 天</td>
                  <td>{emp.actualPunches} 次</td>
                  <td>{emp.approvedLeaveDays} 天</td>
                  <td style={{ color: (emp.abnormal.late > 0 || emp.abnormal.early > 0 || emp.abnormal.absent > 0) ? '#ef4444' : 'inherit' }}>
                    {emp.abnormal.late} / {emp.abnormal.early} / {emp.abnormal.absent}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: emp.attendanceRate < 90 ? '#ef4444' : '#10b981', width: `${emp.attendanceRate}%` }}></div>
                      </div>
                      <span style={{ fontSize: '0.875rem' }}>{emp.attendanceRate}%</span>
                    </div>
                  </td>
                  <td>{Number(emp.totalActualHours).toFixed(2)} 小時</td>
                </tr>
              ))}
              {detailedData.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--color-text-secondary)' }}>查無資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
