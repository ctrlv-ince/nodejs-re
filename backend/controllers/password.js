const connection = require('../config/database');
const crypto = require('crypto');

// Request password reset
exports.requestReset = (req, res) => {
    const { email } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const sql = 'INSERT INTO password_reset_tokens (email, token, created_at) VALUES (?, ?, NOW())';
    connection.execute(sql, [email, token], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        // TODO: Send email with token
        res.json({ success: true, token });
    });
};

// Verify token
exports.verifyToken = (req, res) => {
    const { token } = req.body;
    const sql = 'SELECT * FROM password_reset_tokens WHERE token = ?';
    connection.execute(sql, [token], (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        if (rows.length === 0) return res.status(400).json({ error: 'Invalid token' });
        res.json({ success: true });
    });
};

// Reset password
exports.resetPassword = (req, res) => {
    const { email, token, newPassword } = req.body;
    const sql = 'SELECT * FROM password_reset_tokens WHERE email = ? AND token = ?';
    connection.execute(sql, [email, token], (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        if (rows.length === 0) return res.status(400).json({ error: 'Invalid token' });
        // TODO: Hash password
        const updateSql = 'UPDATE users SET password = ? WHERE email = ?';
        connection.execute(updateSql, [newPassword, email], (err2, result) => {
            if (err2) return res.status(500).json({ error: err2 });
            res.json({ success: true });
        });
    });
}; 