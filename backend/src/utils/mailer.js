import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * 發布班表時的信件通知（只包含該員工要上班的日期）
 */
export const sendSchedulePublishEmail = async (email, employeeName, scheduledDates) => {
  if (!email) return; // 沒有信箱就不發
  const datesList = scheduledDates.map(d => `<li>${new Date(d).toLocaleDateString('zh-TW')}</li>`).join('');
  const mailOptions = {
    from: `"排班系統通知" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '您的新班表已發布',
    html: `
      <h3>親愛的 ${employeeName} 您好：</h3>
      <p>最新的班表已經發布。以下是您被安排的出勤日期：</p>
      <ul>
        ${datesList}
      </ul>
      <p>請登入系統查看詳細資訊。</p>
      <br/>
      <p>系統自動發送，請勿直接回覆。</p>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Successfully sent schedule publish email to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error.message);
  }
};

/**
 * 假單申請成功通知
 */
export const sendLeaveApplicationEmail = async (email, employeeName, leaveDetails) => {
  if (!email) return;
  const mailOptions = {
    from: `"排班系統通知" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '假單申請已送出',
    html: `
      <h3>親愛的 ${employeeName} 您好：</h3>
      <p>您已成功送出假單申請，目前正在等待審核：</p>
      <ul>
        <li>假別：${leaveDetails.leave_type}</li>
        <li>開始時間：${leaveDetails.start_time}</li>
        <li>結束時間：${leaveDetails.end_time}</li>
        <li>理由：${leaveDetails.reason}</li>
      </ul>
      <p>審核完成後系統會再次通知您。</p>
      <br/>
      <p>系統自動發送，請勿直接回覆。</p>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Successfully sent leave application email to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error.message);
  }
};

/**
 * 假單審核結果通知
 */
export const sendLeaveReviewEmail = async (email, employeeName, leaveDetails, status) => {
  if (!email) return;
  const mailOptions = {
    from: `"排班系統通知" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `您的假單已${status}`,
    html: `
      <h3>親愛的 ${employeeName} 您好：</h3>
      <p>您於 ${new Date(leaveDetails.application_time).toLocaleString('zh-TW')} 送出的假單申請，審核結果為：<strong>${status}</strong>。</p>
      <ul>
        <li>假別：${leaveDetails.leave_type}</li>
        <li>開始時間：${new Date(leaveDetails.start_time).toLocaleString('zh-TW')}</li>
        <li>結束時間：${new Date(leaveDetails.end_time).toLocaleString('zh-TW')}</li>
      </ul>
      <p>如有任何疑問請聯繫管理員。</p>
      <br/>
      <p>系統自動發送，請勿直接回覆。</p>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Successfully sent leave review email to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error.message);
  }
};

/**
 * 明日上班提醒
 */
export const sendTomorrowShiftReminder = async (email, employeeName, date) => {
  if (!email) return;
  const mailOptions = {
    from: `"排班系統通知" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '明日上班提醒',
    html: `
      <h3>親愛的 ${employeeName} 您好：</h3>
      <p>提醒您，您在明天（${new Date(date).toLocaleDateString('zh-TW')}）有排定班次，請記得準時出勤！</p>
      <p>祝您工作順心。</p>
      <br/>
      <p>系統自動發送，請勿直接回覆。</p>
    `
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Successfully sent tomorrow shift reminder email to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error.message);
  }
};
