-- 建立資料庫
CREATE DATABASE IF NOT EXISTS DBMS_FINAL_Schedule DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE DBMS_FINAL_Schedule;

-- 3. 員工規則 (EmployeeRules)
CREATE TABLE EmployeeRules (
    rule_id INT AUTO_INCREMENT PRIMARY KEY, -- 員工規則編號
    rule_name VARCHAR(100) NOT NULL UNIQUE, -- 規則名稱
    max_weekly_hours INT,                   -- 每周最大工時
    max_consecutive_days INT,               -- 最多連續上班天數
    max_monthly_holiday_shifts INT,         -- 每月最多假日班數
    monthly_leave_days INT                  -- 每月排休天數
);

-- 7. 禁止排休期間 (NoLeavePeriods)
CREATE TABLE NoLeavePeriods (
    period_id INT AUTO_INCREMENT PRIMARY KEY, -- 禁休編號
    start_date DATE NOT NULL,                 -- 開始日期
    end_date DATE NOT NULL,                   -- 結束日期
    reason VARCHAR(255)                       -- 禁休事由
);

-- 4. 營運規則 (OperationRules)
CREATE TABLE OperationRules (
    op_rule_id INT AUTO_INCREMENT PRIMARY KEY, -- 營運規則編號
    rule_name VARCHAR(100) NOT NULL UNIQUE,    -- 規則名稱
    rule_description TEXT,                     -- 規則詳細敘述
    min_staff_per_shift INT,                   -- 單班最少人數
    fixed_work_days VARCHAR(50),               -- 固定上班日
    start_time TIME,                           -- 上班時間
    end_time TIME                              -- 下班時間
);

-- 1. 員工 (Employees)
CREATE TABLE Employees (
    employee_id INT AUTO_INCREMENT PRIMARY KEY, -- 員工編號
    last_name VARCHAR(50),                      -- 姓氏
    first_name VARCHAR(50),                     -- 名字
    position VARCHAR(50) CHECK (position IN ('管理者', '員工')), -- 職位
    area_code VARCHAR(10),                      -- 地區號碼
    phone_number VARCHAR(20),                   -- 本地電話
    email VARCHAR(100),                         -- 電子郵件
    account VARCHAR(100) NOT NULL UNIQUE,       -- 帳號
    password VARCHAR(255) NOT NULL,             -- 密碼
    remaining_special_leave_days INT,           -- 員工剩餘特休天數
    gender CHAR(1) CHECK (gender IN ('M', 'F')), -- 性別
    hire_date DATE,                             -- 入職日期
    employment_status VARCHAR(20) CHECK (employment_status IN ('在職', '離職')), -- 在職狀態
    rule_id INT,                                -- 員工規則編號
    FOREIGN KEY (rule_id) REFERENCES EmployeeRules(rule_id)
);

-- 2. 請假資料 (LeaveRecords)
CREATE TABLE LeaveRecords (
    leave_id INT AUTO_INCREMENT PRIMARY KEY,    -- 請假單編號
    application_time DATETIME,                  -- 申請時間
    status VARCHAR(50) DEFAULT '審核中',        -- 審核狀態
    leave_type VARCHAR(50),                     -- 請假類別
    reason TEXT,                                -- 請假事由
    start_time DATETIME,                        -- 請假開始時間
    end_time DATETIME,                          -- 請假結束時間
    employee_id INT,                            -- 員工編號
    FOREIGN KEY (employee_id) REFERENCES Employees(employee_id) ON DELETE CASCADE
);

-- 5. 全體班表 (Schedules)
CREATE TABLE Schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY, -- 班表編號
    schedule_date DATE NOT NULL,                -- 排班日期
    status VARCHAR(50) DEFAULT '草稿',          -- 班表狀態
    employee_id INT,                            -- 員工編號
    op_rule_id INT,                             -- 營運規則編號
    period_id INT,                              -- 禁休編號
    FOREIGN KEY (employee_id) REFERENCES Employees(employee_id),
    FOREIGN KEY (op_rule_id) REFERENCES OperationRules(op_rule_id),
    FOREIGN KEY (period_id) REFERENCES NoLeavePeriods(period_id),
    UNIQUE (schedule_date, employee_id)
);

-- 6. 出勤資料 (Attendances)
CREATE TABLE Attendances (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY, -- 出勤編號
    clock_in_time DATETIME,                       -- 上班打卡時間
    clock_out_time DATETIME,                      -- 下班打卡時間
    status VARCHAR(50) CHECK (status IN ('值班中', '下班', '未到', '遲到', '請假')), -- 員工出勤狀態
    is_abnormal BOOLEAN DEFAULT FALSE,            -- 是否異常 (超出寬限值)
    is_abnormal_resolved BOOLEAN DEFAULT FALSE,   -- 是否已由管理者排除
    admin_approved_hours DECIMAL(5,2) DEFAULT NULL, -- 管理者核准工時
    employee_id INT,                              -- 員工編號
    schedule_id INT,                              -- 班表編號
    FOREIGN KEY (employee_id) REFERENCES Employees(employee_id),
    FOREIGN KEY (schedule_id) REFERENCES Schedules(schedule_id)
);

-- 8. 排班異動紀錄 (ScheduleChangeLogs)
CREATE TABLE ScheduleChangeLogs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,      -- 異動編號
    operation_time DATETIME NOT NULL,           -- 操作時間
    change_date DATE,                           -- 異動日期
    reason TEXT,                                -- 異動原因
    action_type VARCHAR(50),                    -- 異動類型 (發布後清空, 單筆修改, 單筆新增, 單筆刪除)
    original_employee_id INT,                   -- 異動前員工編號
    new_employee_id INT,                        -- 異動後員工編號
    schedule_id INT,                            -- 班表編號
    operator_id INT,                            -- 操作管理者編號
    FOREIGN KEY (original_employee_id) REFERENCES Employees(employee_id),
    FOREIGN KEY (new_employee_id) REFERENCES Employees(employee_id),
    FOREIGN KEY (schedule_id) REFERENCES Schedules(schedule_id),
    FOREIGN KEY (operator_id) REFERENCES Employees(employee_id)
);
