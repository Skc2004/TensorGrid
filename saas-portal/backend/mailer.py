import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_job_completion_email(to_email: str, job_id: str, status: str):
    """
    Sends a real-time email notification using Gmail SMTP.
    Requires SMTP_EMAIL and SMTP_PASSWORD to be set in environment variables.
    """
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")
    
    if not smtp_email or not smtp_password:
        print(f"[MAILER] WARNING: Cannot send email to {to_email}. SMTP credentials missing.")
        return False
        
    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_email
        msg['To'] = to_email
        msg['Subject'] = f"HTCondor Job {job_id} Completed"
        
        body = f"""
        Hello,
        
        Your HTCondor Grid Job ({job_id}) has finished executing with status: {status}.
        
        You can now log in to the Control Tower to view the live logs and download your result artifacts (.csv, .pt, etc).
        
        Thank you for using the Cycle-Scavenging Platform!
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(msg)
        server.quit()
        
        print(f"[MAILER] Success: Email sent to {to_email} for job {job_id}")
        return True
    except Exception as e:
        print(f"[MAILER] Error sending email: {str(e)}")
        return False
