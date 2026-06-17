import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db, { testConnection } from './config/db.js';
import apiRoutes from './routes.js';
import { initCronJobs } from './cron/shiftReminder.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize automated tasks
initCronJobs();

// Main API Routes
app.use('/api', apiRoutes);

// 1. Authentication Login
app.post('/api/login', async (req, res) => {
  const { account, password } = req.body;
  try {
    // Check if account is resigned first
    const [accCheck] = await db.execute('SELECT employment_status FROM Employees WHERE account = ?', [account]);
    if (accCheck.length > 0 && accCheck[0].employment_status === '離職') {
      return res.status(401).json({ success: false, message: '帳號不存在' });
    }

    const [rows] = await db.execute(
      'SELECT employee_id, last_name, first_name, position, account, remaining_special_leave_days, gender, hire_date, employment_status, password, email, phone_number FROM Employees WHERE account = ? AND password = ?',
      [account, password]
    );

    if (rows.length > 0) {
      const user = rows[0];
      let needsSetup = false;
      let needsPasswordReset = false;
      if (user.password === 'password') {
        if (!user.email || !user.phone_number) {
          needsSetup = true;
        } else {
          needsPasswordReset = true;
        }
      } else if (!user.email || !user.phone_number) {
        needsSetup = true;
      }
      delete user.password;
      res.json({ success: true, user, needsSetup, needsPasswordReset });
    } else {
      res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
});


app.post('/api/setup-account', async (req, res) => {
  const { account, old_password, new_password, email, phone_number } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM Employees WHERE account = ? AND password = ?', [account, old_password]);
    if (rows.length === 0) return res.json({ success: false, message: '原密碼錯誤' });
    if (old_password === new_password) return res.json({ success: false, message: '新密碼不可與舊密碼相同' });
    
    if (req.body.is_reset_only) {
      await db.execute('UPDATE Employees SET password = ? WHERE account = ?', [new_password, account]);
    } else {
      await db.execute('UPDATE Employees SET password = ?, email = ?, phone_number = ? WHERE account = ?', [new_password, email, phone_number, account]);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ success: false, message: '伺服器內部錯誤' });
  }
});

// Start Server
app.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  await testConnection();
});
