import cron from 'node-cron';
import db from '../config/db.js';
import { sendTomorrowShiftReminder } from '../utils/mailer.js';

export const triggerTomorrowReminders = async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const [schedules] = await db.execute(`
      SELECT s.employee_id, s.schedule_date, e.email, e.first_name, e.last_name 
      FROM Schedules s
      JOIN Employees e ON s.employee_id = e.employee_id
      WHERE s.schedule_date = ? AND s.status = '已發布'
    `, [tomorrowStr]);

    let sentCount = 0;
    for (const schedule of schedules) {
      if (schedule.email) {
        const fullName = `${schedule.last_name}${schedule.first_name}`;
        await sendTomorrowShiftReminder(schedule.email, fullName, schedule.schedule_date);
        sentCount++;
      }
    }
    return { success: true, count: sentCount, message: `成功發送 ${sentCount} 封提醒信件。` };
  } catch (error) {
    console.error('Error sending tomorrow reminders:', error);
    return { success: false, message: error.message };
  }
};

export const initCronJobs = () => {
  // 每天下午 6:00 (18:00) 執行
  cron.schedule('0 18 * * *', async () => {
    console.log('Running scheduled task: send tomorrow shift reminders...');
    await triggerTomorrowReminders();
  });
};
