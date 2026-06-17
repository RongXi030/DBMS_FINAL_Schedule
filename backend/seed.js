import pool from './src/config/db.js';

async function seed() {
  try {
    await pool.execute(`
      INSERT IGNORE INTO Employees (employee_id, last_name, first_name, position, account, password, remaining_special_leave_days, gender, hire_date, employment_status)
      VALUES (1, '管', '理員', '管理者', 'admin', 'password', 14, 'M', '2023-01-01', '在職')
    `);
    await pool.execute(`
      INSERT IGNORE INTO Employees (employee_id, last_name, first_name, position, account, password, remaining_special_leave_days, gender, hire_date, employment_status)
      VALUES (2, '員', '工一號', '員工', 'user', 'password', 7, 'F', '2024-01-01', '在職')
    `);
    console.log('Database seeded with default accounts.');
  } catch(e) {
    console.error('Seed error:', e);
  } finally {
    process.exit(0);
  }
}
seed();
