const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    try {
        // Create transporter with fallback configuration
        // Use correct Nodemailer API: createTransport (not createTransporter)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
            port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 2525,
            secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true', // true only for 465
            auth: {
                user: process.env.SMTP_USER || process.env.SMTP_EMAIL,
                pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD
            },
            tls: { rejectUnauthorized: false }
        });

        // Prepare message object
        const message = {
            from: `${process.env.SMTP_FROM_NAME || 'Bit & Board'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_EMAIL}>`,
            to: options.email,
            subject: options.subject,
            html: options.message // Already formatted as HTML
        };

        // Add attachments if provided
        if (options.attachments && options.attachments.length > 0) {
            message.attachments = options.attachments;
        }

        // Send email
        const info = await transporter.sendMail(message);
        
        console.log('Email sent successfully:', info.messageId);
        return {
            success: true,
            messageId: info.messageId,
            message: 'Email sent successfully'
        };
        
    } catch (error) {
        console.error('Email sending failed:', error);
        throw {
            success: false,
            error: error.message,
            message: 'Failed to send email'
        };
    }
};

module.exports = sendEmail;
