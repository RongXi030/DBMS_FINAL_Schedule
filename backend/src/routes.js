import express from 'express';
import db from './config/db.js';
import { sendSchedulePublishEmail, sendLeaveApplicationEmail, sendLeaveReviewEmail } from './utils/mailer.js';
import { triggerTomorrowReminders } from './cron/shiftReminder.js';

const router = express.Router();

// 1. Employees
router.get('/employees', async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT * FROM Employees';
    let params = [];
    if (search) {
      query += ' WHERE CONCAT(IFNULL(last_name,""), IFNULL(first_name,"")) LIKE ? OR account LIKE ?';
      const searchStr = `%${search}%`;
      params = [searchStr, searchStr];
    }
    const [rows] = await db.execute(query, params);
    res.json({ success: true, employees: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/employees', async (req, res) => {
  const { last_name, first_name, position, gender, hire_date, employment_status, remaining_special_leave_days, rule_id } = req.body;
  try {
    const today = hire_date ? new Date(hire_date) : new Date();
    const rocYear = today.getFullYear() - 1911;
    const prefix = `user${rocYear}`;

    const [rows] = await db.execute(`SELECT account FROM Employees WHERE account LIKE ? ORDER BY account DESC LIMIT 1`, [`${prefix}%`]);
    let nextSeq = 1;
    if (rows.length > 0) {
      const lastAccount = rows[0].account;
      const seqStr = lastAccount.replace(prefix, '');
      if (!isNaN(seqStr)) {
        nextSeq = parseInt(seqStr, 10) + 1;
      }
    }
    const account = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    const password = 'password';

    await db.execute(
      `INSERT INTO Employees (last_name, first_name, position, account, password, gender, hire_date, employment_status, remaining_special_leave_days, rule_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [last_name, first_name, position, account, password, gender, today, employment_status, remaining_special_leave_days || 0, rule_id || null]
    );
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/employees/:id', async (req, res) => {
  const { id } = req.params;
  const { employment_status, position, remaining_special_leave_days, last_name, first_name, gender, rule_id } = req.body;
  try {
    await db.execute(
      `UPDATE Employees SET employment_status = ?, position = ?, remaining_special_leave_days = ?, last_name = ?, first_name = ?, gender = ?, rule_id = ? WHERE employee_id = ?`,
      [employment_status, position, remaining_special_leave_days, last_name, first_name, gender, rule_id || null, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/employees/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('UPDATE Employees SET password = "password" WHERE employee_id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Attendance (Clock in/out)
router.get('/attendance/status/:employee_id', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [records] = await db.execute(
      `SELECT a.* FROM Attendances a 
       JOIN Schedules s ON a.schedule_id = s.schedule_id 
       WHERE a.employee_id = ? AND DATE(a.clock_in_time) = ?`,
      [req.params.employee_id, today]
    );
    res.json({ success: true, record: records[0] });
  } catch (e) {
    res.json({ success: false });
  }
});

router.post('/attendance/clock-in', async (req, res) => {
  const { employee_id } = req.body;
  try {
    const today = new Date().toISOString().split('T')[0];
    const [schedules] = await db.execute(
      `SELECT * FROM Schedules WHERE employee_id = ? AND schedule_date = ?`,
      [employee_id, today]
    );

    if (schedules.length === 0) {
      return res.status(400).json({ success: false, message: '今日無您的排班或非排班時段' });
    }

    const clockInTime = new Date();
    await db.execute(
      `INSERT INTO Attendances (employee_id, schedule_id, clock_in_time, status) VALUES (?, ?, ?, ?)`,
      [employee_id, schedules[0].schedule_id, clockInTime, '值班中']
    );
    res.json({ success: true, message: '打卡成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/attendance/clock-out', async (req, res) => {
  const { employee_id } = req.body;
  try {
    const today = new Date().toISOString().split('T')[0];
    const clockOutTime = new Date();

    const [attendances] = await db.execute(
      `SELECT a.attendance_id, r.end_time 
       FROM Attendances a 
       JOIN Schedules s ON a.schedule_id = s.schedule_id
       JOIN OperationRules r ON s.op_rule_id = r.op_rule_id
       WHERE a.employee_id = ? AND a.status = '值班中' AND DATE(a.clock_in_time) = ?`,
      [employee_id, today]
    );

    if (attendances.length === 0) {
      return res.status(400).json({ success: false, message: '查無值班中的打卡紀錄' });
    }

    const attendanceId = attendances[0].attendance_id;
    const endTimeStr = attendances[0].end_time; // e.g., '18:00:00'
    let isAbnormal = false;

    if (endTimeStr) {
      const scheduledEndTime = new Date(`${today}T${endTimeStr}`);
      // Add 15 mins grace period
      const gracePeriodEndTime = new Date(scheduledEndTime.getTime() + 15 * 60000);

      if (clockOutTime > gracePeriodEndTime) {
        isAbnormal = true;
      }
    }

    await db.execute(
      `UPDATE Attendances SET clock_out_time = ?, status = '下班', is_abnormal = ? WHERE attendance_id = ?`,
      [clockOutTime, isAbnormal, attendanceId]
    );
    res.json({ success: true, message: '下班打卡成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Leaves
router.get('/leaves', async (req, res) => {
  const { employee_id } = req.query;
  try {
      SELECT l.*, e.last_name, e.first_name, r.last_name AS reviewer_last_name, r.first_name AS reviewer_first_name
      FROM LeaveRecords l 
      JOIN Employees e ON l.employee_id = e.employee_id
      LEFT JOIN Employees r ON l.reviewer_id = r.employee_id
    let params = [];
    if (employee_id) {
      query += ' WHERE l.employee_id = ?';
      params.push(employee_id);
    }
    query += ' ORDER BY l.application_time DESC';

    const [rows] = await db.execute(query, params);
    res.json({ success: true, leaves: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/leaves/apply', async (req, res) => {
  const { employee_id, leave_type, start_time, end_time, reason } = req.body;
  try {
    if (leave_type === '特休') {
      const sDate = new Date(start_time);
      const eDate = new Date(end_time);
      const requestedDays = Math.ceil((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;

      const [emp] = await db.execute('SELECT remaining_special_leave_days FROM Employees WHERE employee_id = ?', [employee_id]);
      if (emp[0].remaining_special_leave_days < requestedDays) {
        return res.status(400).json({ success: false, message: `特休額度不足。您申請了 ${requestedDays} 天，但只剩 ${emp[0].remaining_special_leave_days} 天。` });
      }
    }

    await db.execute(
      `INSERT INTO LeaveRecords (employee_id, leave_type, start_time, end_time, reason, application_time, status)
       VALUES (?, ?, ?, ?, ?, NOW(), '審核中')`,
      [employee_id, leave_type, start_time, end_time, reason]
    );

    const [empDetails] = await db.execute('SELECT email, last_name, first_name FROM Employees WHERE employee_id = ?', [employee_id]);
    if (empDetails.length > 0 && empDetails[0].email) {
      await sendLeaveApplicationEmail(
        empDetails[0].email, 
        `${empDetails[0].last_name}${empDetails[0].first_name}`, 
        { leave_type, start_time, end_time, reason }
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/leaves/approve', async (req, res) => {
  const { leave_id, reviewer_id } = req.body;
  try {
    const [leaves] = await db.execute('SELECT * FROM LeaveRecords WHERE leave_id = ?', [leave_id]);
    const leave = leaves[0];

    if (leave.leave_type === '特休') {
      const sDate = new Date(leave.start_time);
      const eDate = new Date(leave.end_time);
      const requestedDays = Math.ceil((eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;

      await db.execute(
        `UPDATE Employees SET remaining_special_leave_days = remaining_special_leave_days - ? 
         WHERE employee_id = ?`,
        [requestedDays, leave.employee_id]
      );
    }

    await db.execute('UPDATE LeaveRecords SET status = ?, reviewer_id = ? WHERE leave_id = ?', ['已核准', reviewer_id || null, leave_id]);

    const [empDetails] = await db.execute('SELECT email, last_name, first_name FROM Employees WHERE employee_id = ?', [leave.employee_id]);
    if (empDetails.length > 0 && empDetails[0].email) {
      await sendLeaveReviewEmail(
        empDetails[0].email, 
        `${empDetails[0].last_name}${empDetails[0].first_name}`, 
        leave, 
        '已核准'
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/leaves/reject', async (req, res) => {
  const { leave_id, reviewer_id } = req.body;
  try {
    const [leaves] = await db.execute('SELECT * FROM LeaveRecords WHERE leave_id = ?', [leave_id]);
    const leave = leaves[0];

    await db.execute('UPDATE LeaveRecords SET status = ?, reviewer_id = ? WHERE leave_id = ?', ['已駁回', reviewer_id || null, leave_id]);

    const [empDetails] = await db.execute('SELECT email, last_name, first_name FROM Employees WHERE employee_id = ?', [leave.employee_id]);
    if (empDetails.length > 0 && empDetails[0].email) {
      await sendLeaveReviewEmail(
        empDetails[0].email, 
        `${empDetails[0].last_name}${empDetails[0].first_name}`, 
        leave, 
        '已駁回'
      );
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Schedules

router.get('/schedules', async (req, res) => {
  const { employee_id, date, year, month } = req.query;
  try {
    let query = 'SELECT s.*, e.last_name, e.first_name FROM Schedules s JOIN Employees e ON s.employee_id = e.employee_id WHERE 1=1';
    let params = [];
    if (employee_id) { query += ' AND s.employee_id = ?'; params.push(employee_id); }
    if (date) { query += ' AND s.schedule_date = ?'; params.push(date); }

    let mustAttendDates = [];
    if (year && month) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month == 12 ? 1 : parseInt(month) + 1;
      const nextYear = month == 12 ? parseInt(year) + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      query += ' AND s.schedule_date >= ? AND s.schedule_date < ?';
      params.push(startDate, endDate);

      const [noLeavePeriods] = await db.execute(
        `SELECT start_date, end_date FROM NoLeavePeriods WHERE start_date < ? AND end_date >= ?`,
        [endDate, startDate]
      );

      const [schedules] = await db.execute(
        'SELECT DISTINCT op_rule_id FROM Schedules WHERE schedule_date >= ? AND schedule_date < ?',
        [startDate, endDate]
      );
      let fixedDaysMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
      let workDays = [];
      if (schedules.length > 0 && schedules[0].op_rule_id) {
        const [ruleRows] = await db.execute('SELECT fixed_work_days FROM OperationRules WHERE op_rule_id = ?', [schedules[0].op_rule_id]);
        if (ruleRows.length > 0 && ruleRows[0].fixed_work_days) {
          workDays = ruleRows[0].fixed_work_days.split(',').map(d => fixedDaysMap[d.trim()]).filter(d => d !== undefined);
        }
      }

      const daysInMonth = new Date(year, month, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month - 1, i);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        let isMustAttend = false;
        if (workDays.includes(d.getDay())) {
          isMustAttend = true;
        } else {
          for (const period of noLeavePeriods) {
            if (new Date(period.start_date) <= d && new Date(period.end_date) >= d) {
              isMustAttend = true;
              break;
            }
          }
        }
        if (isMustAttend) mustAttendDates.push(dateStr);
      }
    }
    query += ' ORDER BY s.schedule_date ASC';

    const [rows] = await db.execute(query, params);
    res.json({ success: true, schedules: rows, mustAttendDates });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/schedules/generate', async (req, res) => {
  const { year, month, op_rule_id } = req.body;
  if (!year || !month || !op_rule_id) return res.status(400).json({ success: false, message: '缺少必要參數' });

  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const nextMonthFirst = new Date(year, month, 1);

    const startStr = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
    const endStr = `${nextMonthFirst.getFullYear()}-${String(nextMonthFirst.getMonth() + 1).padStart(2, '0')}-01 00:00:00`;

    const [pendingLeaves] = await db.execute(`SELECT * FROM LeaveRecords WHERE status = '審核中' AND start_time < ? AND end_time >= ?`, [endStr, startStr]);
    if (pendingLeaves.length > 0) return res.status(400).json({ success: false, message: '該月份有尚未審核的請假單，請先完成審核再進行排班。' });

    const [opRules] = await db.execute(`SELECT * FROM OperationRules WHERE op_rule_id = ?`, [op_rule_id]);
    if (opRules.length === 0) return res.status(400).json({ success: false, message: '找不到營運規則' });
    const opRule = opRules[0];
    const minStaff = opRule.min_staff_per_shift || 0;
    const fixedDaysMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
    const workDays = (opRule.fixed_work_days || '').split(',').map(d => fixedDaysMap[d.trim()]).filter(d => d !== undefined);

    // 獲取在職員工 (僅限有套用員工規則者)
    const [emps] = await db.execute(`SELECT employee_id FROM Employees WHERE employment_status = '在職' AND rule_id IS NOT NULL`);
    if (emps.length === 0) return res.status(400).json({ success: false, message: '沒有符合規則的在職員工' });

    const [approvedLeaves] = await db.execute(`SELECT employee_id, start_time, end_time FROM LeaveRecords WHERE status = '已核准' AND start_time < ? AND end_time >= ?`, [endStr, startStr]);
    const [noLeavePeriods] = await db.execute(`SELECT start_date, end_date FROM NoLeavePeriods WHERE start_date < ? AND end_date >= ?`, [endStr, startStr]);

    // First, check if there are any '已發布' in this month. If so, block generation.
    const [published] = await db.execute(`SELECT 1 FROM Schedules WHERE status = '已發布' AND schedule_date >= ? AND schedule_date < ? LIMIT 1`, [startStr.split(' ')[0], endStr.split(' ')[0]]);
    if (published.length > 0) return res.status(400).json({ success: false, message: '已有發布的班表，無法重新生成' });

    // Since they are all drafts, we safely clear them
    await db.execute(`DELETE FROM ScheduleChangeLogs WHERE schedule_id IN (SELECT schedule_id FROM Schedules WHERE schedule_date >= ? AND schedule_date < ?)`, [startStr.split(' ')[0], endStr.split(' ')[0]]);
    await db.execute(`DELETE FROM Schedules WHERE schedule_date >= ? AND schedule_date < ?`, [startStr.split(' ')[0], endStr.split(' ')[0]]);

    // Initialize employee stats tracking
    const empStats = {};
    emps.forEach(emp => {
      empStats[emp.employee_id] = { workload: 0, consecutiveDays: 0 };
    });

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayOfWeek = d.getDay();

      let isMustAttendDay = workDays.includes(dayOfWeek);
      if (!isMustAttendDay) {
        for (const period of noLeavePeriods) {
          if (new Date(period.start_date) <= d && new Date(period.end_date) >= d) {
            isMustAttendDay = true; break;
          }
        }
      }

      const availableEmps = emps.filter(emp => {
        return !approvedLeaves.some(leave => leave.employee_id === emp.employee_id && new Date(leave.start_time) <= d && new Date(leave.end_time) >= d);
      });

      let assignedIds = [];
      if (isMustAttendDay) {
        assignedIds = availableEmps.map(e => e.employee_id);
      } else {
        // Smart sorting algorithm to balance workload and break consecutive shifts
        const sorted = [...availableEmps].sort((a, b) => {
          const statsA = empStats[a.employee_id];
          const statsB = empStats[b.employee_id];

          // Priority B: Break consecutive shifts (heavy penalty for >= 3 days)
          const penaltyA = statsA.consecutiveDays >= 3 ? 100 : statsA.consecutiveDays;
          const penaltyB = statsB.consecutiveDays >= 3 ? 100 : statsB.consecutiveDays;

          if (penaltyA !== penaltyB) return penaltyA - penaltyB;

          // Priority A: Balance workload
          if (statsA.workload !== statsB.workload) return statsA.workload - statsB.workload;

          // Tie-breaker
          return 0.5 - Math.random();
        });

        assignedIds = sorted.slice(0, minStaff).map(e => e.employee_id);
      }

      // Update stats and insert records
      for (const emp of emps) {
        const eid = emp.employee_id;
        const isAssigned = assignedIds.includes(eid);

        if (isAssigned) {
          empStats[eid].workload += 1;
          empStats[eid].consecutiveDays += 1;
          await db.execute(`INSERT INTO Schedules (schedule_date, status, employee_id, op_rule_id) VALUES (?, ?, ?, ?)`, [dateStr, '草稿', eid, op_rule_id]);
        } else {
          empStats[eid].consecutiveDays = 0; // Reset consecutive days if they don't work
        }
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/schedules/:id/replace', async (req, res) => {
  const { id } = req.params;
  const { new_employee_id, operator_id } = req.body;
  try {
    const [schedules] = await db.execute(`SELECT * FROM Schedules WHERE schedule_id = ?`, [id]);
    if (schedules.length === 0) return res.status(404).json({ success: false, message: '班表不存在' });
    const schedule = schedules[0];
    // Allow both draft and published, but handle them differently
    const [opRules] = await db.execute(`SELECT fixed_work_days FROM OperationRules WHERE op_rule_id = ?`, [schedule.op_rule_id]);
    const fixedDaysMap = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
    const workDays = (opRules[0]?.fixed_work_days || '').split(',').map(d => fixedDaysMap[d.trim()]).filter(d => d !== undefined);
    const targetDateObj = new Date(`${schedule.schedule_date}T00:00:00`);
    let isMustAttendDay = workDays.includes(targetDateObj.getDay());

    if (!isMustAttendDay) {
      const [noLeavePeriods] = await db.execute(`SELECT start_date, end_date FROM NoLeavePeriods WHERE start_date <= ? AND end_date >= ?`, [schedule.schedule_date, schedule.schedule_date]);
      if (noLeavePeriods.length > 0) isMustAttendDay = true;
    }

    if (isMustAttendDay) {
      return res.status(400).json({ success: false, message: '違反排班規則：該日為固定上班日或禁止排休日，所有員工必須出勤，不可替換！' });
    }

    const original_emp_id = schedule.employee_id;


    const [newEmpSchedules] = await db.execute(`SELECT * FROM Schedules WHERE schedule_date = ? AND employee_id = ?`, [schedule.schedule_date, new_employee_id]);

    if (newEmpSchedules.length > 0) {
      return res.status(400).json({ success: false, message: '該員工當日已有排班，無法替換！' });
    }

    await db.execute(`UPDATE Schedules SET employee_id = ? WHERE schedule_id = ?`, [new_employee_id, id]);

    if (schedule.status === '已發布') {
      const actualReason = req.body.reason || '單筆修改';
      await db.execute(
        `INSERT INTO ScheduleChangeLogs (operation_time, change_date, reason, action_type, original_employee_id, new_employee_id, schedule_id, operator_id) VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?)`,
        [schedule.schedule_date, actualReason, '單筆修改', original_emp_id, new_employee_id, id, operator_id || null]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});


router.post('/schedules/clear', async (req, res) => {
  const { year, month, reason, operator_id } = req.body;
  if (!year || !month) return res.status(400).json({ success: false, message: '缺少必要參數' });
  try {
    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthFirst = new Date(year, month, 1);
    const endStr = `${nextMonthFirst.getFullYear()}-${String(nextMonthFirst.getMonth() + 1).padStart(2, '0')}-01`;

    const [schedules] = await db.execute(`SELECT * FROM Schedules WHERE schedule_date >= ? AND schedule_date < ?`, [startStr, endStr]);
    if (schedules.length === 0) return res.json({ success: true, message: '無班表可清空' });

    const isPublished = schedules.some(s => s.status === '已發布');
    if (isPublished && !reason) return res.status(400).json({ success: false, message: '已發布的班表清空必須填寫理由' });

    if (isPublished) {
      await db.execute(
        `INSERT INTO ScheduleChangeLogs (operation_time, change_date, reason, action_type, operator_id) VALUES (NOW(), ?, ?, ?, ?)`,
        [startStr, reason, '發布後清空', operator_id || null]
      );
    }

    const scheduleIds = schedules.map(s => s.schedule_id);
    if (scheduleIds.length > 0) {
      const placeholders = scheduleIds.map(() => '?').join(',');
      await db.execute(`DELETE FROM Attendances WHERE schedule_id IN (${placeholders})`, scheduleIds);
      await db.execute(`UPDATE ScheduleChangeLogs SET schedule_id = NULL WHERE schedule_id IN (${placeholders})`, scheduleIds);
      await db.execute(`DELETE FROM Schedules WHERE schedule_id IN (${placeholders})`, scheduleIds);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/schedules/add-single', async (req, res) => {
  const { schedule_date, employee_id, op_rule_id, operator_id, reason } = req.body;
  try {
    const [exist] = await db.execute(`SELECT * FROM Schedules WHERE schedule_date = ? AND employee_id = ?`, [schedule_date, employee_id]);
    if (exist.length > 0) {
      return res.status(400).json({ success: false, message: '該員工當日已有班次' });
    } else {
      await db.execute(`INSERT INTO Schedules (schedule_date, status, employee_id, op_rule_id) VALUES (?, ?, ?, ?)`, [schedule_date, '草稿', employee_id, op_rule_id]);
    }

    // We need to check if the month is published
    const [monthSchedules] = await db.execute(`SELECT status FROM Schedules WHERE schedule_date >= ? AND schedule_date <= LAST_DAY(?) LIMIT 1`, [schedule_date.substring(0, 8) + '01', schedule_date]);
    const isPublished = monthSchedules.length > 0 && monthSchedules[0].status === '已發布';

    if (isPublished) {
      await db.execute(`UPDATE Schedules SET status = '已發布' WHERE schedule_date = ? AND employee_id = ?`, [schedule_date, employee_id]);
      await db.execute(
        `INSERT INTO ScheduleChangeLogs (operation_time, change_date, reason, action_type, new_employee_id, operator_id) VALUES (NOW(), ?, ?, ?, ?, ?)`,
        [schedule_date, reason, '單筆新增', employee_id, operator_id || null]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/schedules/delete-single', async (req, res) => {
  const { schedule_id, operator_id, reason } = req.body;
  try {
    const [schedules] = await db.execute(`SELECT * FROM Schedules WHERE schedule_id = ?`, [schedule_id]);
    if (schedules.length === 0) return res.status(404).json({ success: false, message: '找不到該排班' });
    const schedule = schedules[0];

    // Check min_staff_per_shift
    const [opRules] = await db.execute(`SELECT min_staff_per_shift FROM OperationRules WHERE op_rule_id = ?`, [schedule.op_rule_id]);
    const minStaff = opRules[0]?.min_staff_per_shift || 0;

    let warning = null;
    const [daySchedules] = await db.execute(`SELECT count(*) as count FROM Schedules WHERE schedule_date = ?`, [schedule.schedule_date]);
    if (daySchedules[0].count <= minStaff) {
      if (schedule.status === '已發布') {
        return res.status(400).json({ success: false, message: `無法刪除！當日排班人數將低於單班最少人數 (${minStaff} 人)` });
      } else {
        const d = new Date(schedule.schedule_date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        warning = `【軟警告】刪除後 ${dateStr} 的排班人數將低於單班最少人數 (${minStaff} 人)！\n請記得在發布前補齊人數。`;
      }
    }

    if (schedule.status === '已發布') {
      if (!reason) return res.status(400).json({ success: false, message: '已發布的班表刪除必須填寫理由' });
      await db.execute(
        `INSERT INTO ScheduleChangeLogs (operation_time, change_date, reason, action_type, original_employee_id, operator_id) VALUES (NOW(), ?, ?, ?, ?, ?)`,
        [schedule.schedule_date, reason, '單筆刪除', schedule.employee_id, operator_id || null]
      );
    }

    await db.execute(`DELETE FROM Attendances WHERE schedule_id = ?`, [schedule_id]);
    await db.execute(`UPDATE ScheduleChangeLogs SET schedule_id = NULL WHERE schedule_id = ?`, [schedule_id]);
    await db.execute(`DELETE FROM Schedules WHERE schedule_id = ?`, [schedule_id]);
    res.json({ success: true, warning });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/schedules/logs', async (req, res) => {
  const { year, month, employee_name } = req.query;
  try {
    let query = `
      SELECT 
        l.log_id, l.operation_time, l.change_date, l.reason, l.action_type,
        o.last_name AS orig_last_name, o.first_name AS orig_first_name,
        n.last_name AS new_last_name, n.first_name AS new_first_name,
        op.last_name AS op_last_name, op.first_name AS op_first_name
      FROM ScheduleChangeLogs l
      LEFT JOIN Employees o ON l.original_employee_id = o.employee_id
      LEFT JOIN Employees n ON l.new_employee_id = n.employee_id
      LEFT JOIN Employees op ON l.operator_id = op.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (year && month) {
      query += ` AND YEAR(l.change_date) = ? AND MONTH(l.change_date) = ?`;
      params.push(year, month);
    }
    if (employee_name) {
      query += ` AND (o.last_name LIKE ? OR o.first_name LIKE ? OR n.last_name LIKE ? OR n.first_name LIKE ?)`;
      const nameMatch = `%${employee_name}%`;
      params.push(nameMatch, nameMatch, nameMatch, nameMatch);
    }

    query += ` ORDER BY l.operation_time DESC`;
    const [logs] = await db.execute(query, params);
    res.json({ success: true, data: logs });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/schedules/publish', async (req, res) => {
  try {
    const [drafts] = await db.execute(`
      SELECT s.employee_id, s.schedule_date, e.email, e.first_name, e.last_name 
      FROM Schedules s
      JOIN Employees e ON s.employee_id = e.employee_id
      WHERE s.status = '草稿'
    `);

    const empSchedules = {};
    for (const draft of drafts) {
      if (!empSchedules[draft.employee_id]) {
        empSchedules[draft.employee_id] = {
          email: draft.email,
          name: `${draft.last_name}${draft.first_name}`,
          dates: []
        };
      }
      empSchedules[draft.employee_id].dates.push(draft.schedule_date);
    }

    for (const empId in empSchedules) {
      const { email, name, dates } = empSchedules[empId];
      if (email) {
        sendSchedulePublishEmail(email, name, dates).catch(console.error);
      }
    }

    await db.execute(`UPDATE Schedules SET status = '已發布' WHERE status = '草稿'`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/schedules/remind-tomorrow', async (req, res) => {
  try {
    const result = await triggerTomorrowReminders();
    if (result.success) {
      res.json({ success: true, count: result.count, message: result.message });
    } else {
      res.status(500).json({ success: false, message: result.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. Reports
// --- 新增的詳細統計與異常出勤 API ---
router.get('/reports/detailed', async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ success: false, message: '請提供年月' });

  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthFirst = new Date(year, month, 1);
  const endStr = `${nextMonthFirst.getFullYear()}-${String(nextMonthFirst.getMonth() + 1).padStart(2, '0')}-01`;

  try {
    const [emps] = await db.execute(`
      SELECT DISTINCT e.employee_id, e.last_name, e.first_name 
      FROM Employees e 
      LEFT JOIN Schedules s ON e.employee_id = s.employee_id AND s.schedule_date >= ? AND s.schedule_date < ?
      WHERE (e.employment_status = '在職' OR s.schedule_id IS NOT NULL) 
      AND e.rule_id IS NOT NULL
    `, [startStr, endStr]);

    // 獲取所有相關紀錄
    const [schedules] = await db.execute(`
      SELECT s.employee_id, s.schedule_date, r.start_time, r.end_time 
      FROM Schedules s
      JOIN OperationRules r ON s.op_rule_id = r.op_rule_id
      WHERE s.schedule_date >= ? AND s.schedule_date < ? AND s.status = '已發布'
    `, [startStr, endStr]);

    const [attendances] = await db.execute(`
      SELECT a.employee_id, a.status, a.clock_in_time, a.clock_out_time, a.is_abnormal, a.is_abnormal_resolved, a.admin_approved_hours, s.schedule_date, r.start_time, r.end_time
      FROM Attendances a
      JOIN Schedules s ON a.schedule_id = s.schedule_id
      JOIN OperationRules r ON s.op_rule_id = r.op_rule_id
      WHERE s.schedule_date >= ? AND s.schedule_date < ?
    `, [startStr, endStr]);

    const [leaves] = await db.execute(`
      SELECT employee_id, leave_type, start_time, end_time 
      FROM LeaveRecords 
      WHERE status = '已核准' AND start_time < ? AND end_time >= ?
    `, [endStr, startStr]);

    // 不扣考勤的法定假別
    const statutoryLeaves = ['喪假', '婚假', '公假', '特休'];

    const reportData = emps.map(emp => {
      const empId = emp.employee_id;
      const empSchedules = schedules.filter(s => s.employee_id === empId);
      const empAttendances = attendances.filter(a => a.employee_id === empId);
      const empLeaves = leaves.filter(l => l.employee_id === empId);

      // 1. 應出勤總天數
      const scheduledDays = empSchedules.length;

      // 2. 實際有打卡天數
      const actualPunches = empAttendances.filter(a => ['值班中', '下班', '遲到', '早退'].includes(a.status)).length;

      // 3. 各假別計算 (粗略以天數計算)
      const leaveDaysByType = {};
      let statutoryLeaveDays = 0;
      let totalApprovedLeaveDays = 0;

      empLeaves.forEach(l => {
        // 簡單計算該月涵蓋的天數 (假設假單不跨月或跨月已拆分，簡單以毫秒轉天數)
        const sTime = Math.max(new Date(l.start_time).getTime(), new Date(startStr).getTime());
        const eTime = Math.min(new Date(l.end_time).getTime(), new Date(endStr).getTime());
        const days = Math.round((eTime - sTime) / (1000 * 60 * 60 * 24));

        if (!leaveDaysByType[l.leave_type]) leaveDaysByType[l.leave_type] = 0;
        leaveDaysByType[l.leave_type] += days;
        totalApprovedLeaveDays += days;

        if (statutoryLeaves.includes(l.leave_type)) {
          statutoryLeaveDays += days;
        }
      });

      // 4. 異常與曠職 (未到)
      const lateCount = empAttendances.filter(a => a.status === '遲到').length;
      const earlyCount = empAttendances.filter(a => a.status === '早退').length;
      const absentCount = empAttendances.filter(a => a.status === '未到').length;

      // 5. 出勤率計算: 實際有打卡天數 / (應出勤總天數 - 不扣考勤的法定假別天數) * 100%
      const denominator = scheduledDays - statutoryLeaveDays;
      let attendanceRate = 0;
      if (denominator > 0) {
        attendanceRate = ((actualPunches) / denominator) * 100;
      } else if (scheduledDays === 0) {
        attendanceRate = 100; // 沒班算100%
      } else {
        attendanceRate = 100; // 特例處理
      }
      attendanceRate = Math.min(100, Math.round(attendanceRate * 10) / 10);

      // 6. 總工時與加班時數
      let totalActualHours = 0;
      let totalOvertimeHours = 0;

      empAttendances.forEach(a => {
        if (!a.clock_in_time || !a.clock_out_time) return;

        // 班表預定工時
        const sDate = new Date(`1970-01-01T${a.start_time}`);
        const eDate = new Date(`1970-01-01T${a.end_time}`);
        let scheduledHours = (eDate - sDate) / (1000 * 60 * 60);
        if (scheduledHours < 0) scheduledHours += 24; // 跨夜

        let actualHours = 0;
        let overtime = 0;

        if (a.is_abnormal && !a.is_abnormal_resolved) {
          // 異常且未排除，加班時數預設為 0
          const cIn = new Date(a.clock_in_time);
          const cOut = new Date(a.clock_out_time);
          actualHours = (cOut - cIn) / (1000 * 60 * 60);
          overtime = 0;
        } else if (a.is_abnormal && a.is_abnormal_resolved) {
          // 已由管理者核准實際工時
          actualHours = parseFloat(a.admin_approved_hours) || 0;
          overtime = actualHours - scheduledHours;
          if (overtime < 0) overtime = 0;
        } else {
          // 正常下班 (在寬限值內)
          const cIn = new Date(a.clock_in_time);
          const cOut = new Date(a.clock_out_time);
          actualHours = (cOut - cIn) / (1000 * 60 * 60);
          // 寬限值內不計加班
          overtime = 0;
        }

        totalActualHours += actualHours;
        totalOvertimeHours += overtime;
      });

      return {
        employee_id: empId,
        name: `${emp.last_name}${emp.first_name}`,
        scheduledDays,
        actualPunches,
        approvedLeaveDays: totalApprovedLeaveDays,
        leaveDaysByType,
        abnormal: { late: lateCount, early: earlyCount, absent: absentCount },
        attendanceRate,
        totalActualHours: Math.round(totalActualHours * 10) / 10,
        totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10
      };
    });

    res.json({ success: true, data: reportData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/reports/abnormal-attendances', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT a.attendance_id, a.clock_in_time, a.clock_out_time, a.status, a.is_abnormal_resolved,
             e.last_name, e.first_name, s.schedule_date, r.start_time, r.end_time
      FROM Attendances a
      JOIN Employees e ON a.employee_id = e.employee_id
      JOIN Schedules s ON a.schedule_id = s.schedule_id
      JOIN OperationRules r ON s.op_rule_id = r.op_rule_id
      WHERE a.is_abnormal = TRUE AND a.is_abnormal_resolved = FALSE
      ORDER BY a.clock_out_time DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/reports/abnormal-attendances/:id/resolve', async (req, res) => {
  const { id } = req.params;
  const { admin_approved_hours } = req.body;
  if (admin_approved_hours === undefined) return res.status(400).json({ success: false, message: '請提供核准工時' });

  try {
    await db.execute(`
      UPDATE Attendances 
      SET is_abnormal_resolved = TRUE, admin_approved_hours = ? 
      WHERE attendance_id = ?
    `, [admin_approved_hours, id]);
    res.json({ success: true, message: '異常已排除' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// ----------------------------------------

router.get('/dashboard/today', async (req, res) => {
  try {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    const [todaySchedules] = await db.execute(`
      SELECT 
        s.schedule_id, 
        e.employee_id, e.last_name, e.first_name, e.phone_number,
        a.clock_in_time, a.clock_out_time, a.status as attendance_status,
        o.start_time, o.end_time
      FROM Schedules s
      JOIN Employees e ON s.employee_id = e.employee_id
      LEFT JOIN Attendances a ON s.schedule_id = a.schedule_id
      LEFT JOIN OperationRules o ON s.op_rule_id = o.op_rule_id
      WHERE s.schedule_date = ? AND s.status = '已發布'
    `, [todayStr]);

    res.json({ success: true, data: todaySchedules });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

router.get('/reports/stats', async (req, res) => {
  try {
    const { year, month } = req.query;
    let empsQuery = `SELECT COUNT(*) as count FROM Employees WHERE employment_status = '在職' AND rule_id IS NOT NULL`;
    let empsParams = [];
    if (year && month) {
      const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month == 12 ? 1 : Number(month) + 1;
      const nextYear = month == 12 ? Number(year) + 1 : Number(year);
      const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      empsQuery = `
        SELECT COUNT(DISTINCT e.employee_id) as count 
        FROM Employees e 
        LEFT JOIN Schedules s ON e.employee_id = s.employee_id AND s.schedule_date >= ? AND s.schedule_date < ?
        WHERE (e.employment_status = '在職' OR s.schedule_id IS NOT NULL) 
        AND e.rule_id IS NOT NULL
      `;
      empsParams = [startStr, endStr];
    }
    const [emps] = await db.execute(empsQuery, empsParams);
    const [leaves] = await db.execute(`SELECT COUNT(*) as count FROM LeaveRecords WHERE status = '審核中'`);

    let abnormalCount = 0;
    if (year && month) {
      const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month == 12 ? 1 : Number(month) + 1;
      const nextYear = month == 12 ? Number(year) + 1 : Number(year);
      const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      const [abnormal] = await db.execute(`
        SELECT COUNT(*) as count 
        FROM Attendances a 
        JOIN Schedules s ON a.schedule_id = s.schedule_id 
        WHERE a.is_abnormal = TRUE AND a.is_abnormal_resolved = FALSE 
        AND s.schedule_date >= ? AND s.schedule_date < ?
      `, [startStr, endStr]);
      abnormalCount = abnormal[0].count;
    } else {
      const [abnormal] = await db.execute(`SELECT COUNT(*) as count FROM Attendances WHERE is_abnormal = TRUE AND is_abnormal_resolved = FALSE`);
      abnormalCount = abnormal[0].count;
    }

    res.json({
      success: true,
      stats: {
        totalEmployees: emps[0].count,
        pendingLeaves: leaves[0].count,
        abnormalAttendances: abnormalCount
      }
    });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// 6. Rules
router.get('/rules', async (req, res) => {
  try {
    const [eRules] = await db.execute('SELECT * FROM EmployeeRules');
    const [oRules] = await db.execute('SELECT * FROM OperationRules');
    res.json({ success: true, employeeRules: eRules, operationRules: oRules });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});


// ==========================================
// Scheduling Rules CRUD APIs
// ==========================================

// 1. EmployeeRules (員工排班規則)
router.get('/employee-rules', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM EmployeeRules');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/employee-rules', async (req, res) => {
  const { rule_name, max_weekly_hours, max_consecutive_days, max_monthly_holiday_shifts, monthly_leave_days } = req.body;
  try {
    await db.execute(
      'INSERT INTO EmployeeRules (rule_name, max_weekly_hours, max_consecutive_days, max_monthly_holiday_shifts, monthly_leave_days) VALUES (?, ?, ?, ?, ?)',
      [rule_name, max_weekly_hours, max_consecutive_days, max_monthly_holiday_shifts, monthly_leave_days]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/employee-rules/:id', async (req, res) => {
  const { id } = req.params;
  const { rule_name, max_weekly_hours, max_consecutive_days, max_monthly_holiday_shifts, monthly_leave_days } = req.body;
  try {
    await db.execute(
      'UPDATE EmployeeRules SET rule_name = ?, max_weekly_hours = ?, max_consecutive_days = ?, max_monthly_holiday_shifts = ?, monthly_leave_days = ? WHERE rule_id = ?',
      [rule_name, max_weekly_hours, max_consecutive_days, max_monthly_holiday_shifts, monthly_leave_days, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/employee-rules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check if rule is in use
    const [emps] = await db.execute('SELECT employee_id FROM Employees WHERE rule_id = ? LIMIT 1', [id]);
    if (emps.length > 0) {
      return res.status(400).json({ success: false, message: '此規則正被員工使用中，無法刪除' });
    }
    await db.execute('DELETE FROM EmployeeRules WHERE rule_id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. OperationRules (營運規則)
router.get('/operation-rules', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM OperationRules');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/operation-rules', async (req, res) => {
  const { rule_name, rule_description, min_staff_per_shift, fixed_work_days, start_time, end_time } = req.body;
  try {
    await db.execute(
      'INSERT INTO OperationRules (rule_name, rule_description, min_staff_per_shift, fixed_work_days, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)',
      [rule_name, rule_description, min_staff_per_shift, fixed_work_days, start_time, end_time]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/operation-rules/:id', async (req, res) => {
  const { id } = req.params;
  const { rule_name, rule_description, min_staff_per_shift, fixed_work_days, start_time, end_time } = req.body;
  try {
    await db.execute(
      'UPDATE OperationRules SET rule_name = ?, rule_description = ?, min_staff_per_shift = ?, fixed_work_days = ?, start_time = ?, end_time = ? WHERE op_rule_id = ?',
      [rule_name, rule_description, min_staff_per_shift, fixed_work_days, start_time, end_time, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/operation-rules/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [schedules] = await db.execute('SELECT schedule_id FROM Schedules WHERE op_rule_id = ? LIMIT 1', [id]);
    if (schedules.length > 0) {
      return res.status(400).json({ success: false, message: '此規則正被班表使用中，無法刪除' });
    }
    await db.execute('DELETE FROM OperationRules WHERE op_rule_id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. NoLeavePeriods (禁止排休期間)
router.get('/no-leave-periods', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT period_id, DATE_FORMAT(start_date, "%Y-%m-%d") as start_date, DATE_FORMAT(end_date, "%Y-%m-%d") as end_date, reason FROM NoLeavePeriods');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/no-leave-periods', async (req, res) => {
  const { start_date, end_date, reason } = req.body;
  try {
    await db.execute(
      'INSERT INTO NoLeavePeriods (start_date, end_date, reason) VALUES (?, ?, ?)',
      [start_date, end_date, reason]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/no-leave-periods/:id', async (req, res) => {
  const { id } = req.params;
  const { start_date, end_date, reason } = req.body;
  try {
    await db.execute(
      'UPDATE NoLeavePeriods SET start_date = ?, end_date = ?, reason = ? WHERE period_id = ?',
      [start_date, end_date, reason, id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/no-leave-periods/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM NoLeavePeriods WHERE period_id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 6. Profile
router.put('/profile/update', async (req, res) => {
  const { account, email, phone_number } = req.body;
  try {
    const updates = [];
    const params = [];
    
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (phone_number !== undefined) {
      updates.push('phone_number = ?');
      params.push(phone_number);
    }
    
    if (updates.length > 0) {
      params.push(account);
      await db.execute(`UPDATE Employees SET ${updates.join(', ')} WHERE account = ?`, params);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

router.get('/schedules/stats', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) return res.status(400).json({ success: false, message: 'Missing year or month' });

    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month == 12 ? 1 : Number(month) + 1;
    const nextYear = month == 12 ? Number(year) + 1 : Number(year);
    const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const [emps] = await db.execute(`
      SELECT e.employee_id, e.last_name, e.first_name, er.max_weekly_hours, er.max_consecutive_days, er.monthly_leave_days 
      FROM Employees e 
      JOIN EmployeeRules er ON e.rule_id = er.rule_id 
      WHERE e.employment_status = '在職'
    `);

    const [schedules] = await db.execute(`
      SELECT s.employee_id, s.schedule_date, o.start_time, o.end_time 
      FROM Schedules s
      LEFT JOIN OperationRules o ON s.op_rule_id = o.op_rule_id
      WHERE s.schedule_date >= ? AND s.schedule_date < ?
      ORDER BY s.schedule_date ASC
    `, [startStr, endStr]);

    const [leaves] = await db.execute(`
      SELECT employee_id, start_time, end_time 
      FROM LeaveRecords 
      WHERE status = '已核准' AND start_time < ? AND end_time >= ?
    `, [endStr, startStr]);

    const stats = {};
    for (const emp of emps) {
      stats[emp.employee_id] = {
        employee_id: emp.employee_id,
        employee_name: `${emp.last_name}${emp.first_name}`,
        rule: {
          max_weekly_hours: emp.max_weekly_hours,
          max_consecutive_days: emp.max_consecutive_days,
          monthly_leave_days: emp.monthly_leave_days
        },
        totalWorkDays: 0,
        totalOffDays: 0,
        totalHours: 0,
        maxConsecutiveDays: 0,
        approvedLeaveDays: 0,
        isWeeklyHoursViolation: false
      };

      let leaveDays = 0;
      const empLeaves = leaves.filter(l => l.employee_id === emp.employee_id);
      for (const l of empLeaves) {
        let lStart = new Date(l.start_time);
        let lEnd = new Date(l.end_time);
        let mStart = new Date(startStr);
        let mEnd = new Date(endStr);
        let actualStart = lStart < mStart ? mStart : lStart;
        let actualEnd = lEnd > mEnd ? mEnd : lEnd;
        if (actualEnd > actualStart) {
          leaveDays += Math.round((actualEnd - actualStart) / (1000 * 60 * 60 * 24));
        }
      }
      stats[emp.employee_id].approvedLeaveDays = leaveDays;
    }

    const empDailyMap = {};
    for (const sch of schedules) {
      const eid = sch.employee_id;
      if (!stats[eid]) continue;
      if (!empDailyMap[eid]) empDailyMap[eid] = [];
      empDailyMap[eid].push(sch);
    }

    for (const eid in empDailyMap) {
      const empSchs = empDailyMap[eid];
      let currentConsecutive = 0;
      let maxConsecutive = 0;
      let currentConsecutiveStart = null;
      let maxConsecutiveStartDate = null;
      let maxConsecutiveEndDate = null;
      let totalWork = 0;
      let totalOff = 0;
      let totalHours = 0;
      const weeklyHours = {};
      const startOfMonth = new Date(startStr);
      const endOfMonthDate = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      const daysInMonth = endOfMonthDate.getDate();
      let prevDateStr = null;

      for (const sch of empSchs) {
        totalWork++;

        if (prevDateStr) {
           const prevD = new Date(`${prevDateStr}T00:00:00`);
           const currD = new Date(`${sch.schedule_date}T00:00:00`);
           const diffDays = Math.round((currD - prevD) / (1000 * 60 * 60 * 24));
           if (diffDays === 1) {
              currentConsecutive++;
              if (currentConsecutive === 2) currentConsecutiveStart = prevDateStr;
           } else {
              currentConsecutive = 1;
              currentConsecutiveStart = sch.schedule_date;
           }
        } else {
           currentConsecutive = 1;
           currentConsecutiveStart = sch.schedule_date;
        }
        prevDateStr = sch.schedule_date;

        if (currentConsecutive > maxConsecutive) {
          maxConsecutive = currentConsecutive;
          maxConsecutiveStartDate = currentConsecutiveStart;
          maxConsecutiveEndDate = sch.schedule_date;
        }

        if (sch.start_time && sch.end_time) {
          let start = new Date(`1970-01-01T${sch.start_time}Z`).getTime();
          let end = new Date(`1970-01-01T${sch.end_time}Z`).getTime();
          if (end < start) end += 24 * 60 * 60 * 1000;
          let hours = (end - start) / (1000 * 60 * 60);
          totalHours += hours;

          const schDate = new Date(sch.schedule_date);
          const diffDays = Math.floor((schDate - startOfMonth) / (1000 * 60 * 60 * 24));
          const weekNo = Math.floor((diffDays + startOfMonth.getDay()) / 7);
          if (!weeklyHours[weekNo]) weeklyHours[weekNo] = 0;
          weeklyHours[weekNo] += hours;
        }
      }
      
      totalOff = daysInMonth - totalWork;

      stats[eid].totalWorkDays = totalWork;
      stats[eid].totalOffDays = totalOff;
      stats[eid].maxConsecutiveDays = maxConsecutive;
      stats[eid].maxConsecutiveStartDate = maxConsecutiveStartDate;
      stats[eid].maxConsecutiveEndDate = maxConsecutiveEndDate;
      stats[eid].totalHours = totalHours;

      for (const w in weeklyHours) {
        if (weeklyHours[w] > stats[eid].rule.max_weekly_hours) {
          stats[eid].isWeeklyHoursViolation = true;
          break;
        }
      }
    }

    res.json({ success: true, data: Object.values(stats) });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ success: false, message: '獲取統計資料失敗' });
  }
});


