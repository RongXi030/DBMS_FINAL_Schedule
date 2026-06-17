export const initializeMockData = () => {
  if (!localStorage.getItem('employees')) {
    const employees = [
      {
        employee_id: 1,
        last_name: '管理',
        first_name: '員',
        position: '管理者',
        account: 'admin',
        password: 'password',
        remaining_special_leave_days: 14,
        gender: 'M',
        hire_date: '2023-01-01',
        employment_status: '在職'
      },
      {
        employee_id: 2,
        last_name: '一般',
        first_name: '員工',
        position: '員工',
        account: 'user',
        password: 'password',
        remaining_special_leave_days: 7,
        gender: 'F',
        hire_date: '2024-01-01',
        employment_status: '在職'
      }
    ];
    localStorage.setItem('employees', JSON.stringify(employees));
  }
  
  if (!localStorage.getItem('schedules')) {
    localStorage.setItem('schedules', JSON.stringify([]));
  }
  if (!localStorage.getItem('leaveRecords')) {
    localStorage.setItem('leaveRecords', JSON.stringify([]));
  }
  if (!localStorage.getItem('attendances')) {
    localStorage.setItem('attendances', JSON.stringify([]));
  }
  if (!localStorage.getItem('operationRules')) {
    localStorage.setItem('operationRules', JSON.stringify([]));
  }
  if (!localStorage.getItem('employeeRules')) {
    localStorage.setItem('employeeRules', JSON.stringify([]));
  }
};
