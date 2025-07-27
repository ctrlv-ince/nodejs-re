const connection = require('../config/database');

// Get all accounts
exports.getAllAccounts = (req, res) => {
    const sql = 'SELECT * FROM accounts';
    connection.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows);
    });
};

// Get single account
exports.getAccount = (req, res) => {
    const sql = 'SELECT * FROM accounts WHERE account_id = ?';
    connection.execute(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows[0]);
    });
};

// Create account
exports.createAccount = (req, res) => {
    const { user_id, username, password, role, profile_img, account_status } = req.body;
    const sql = 'INSERT INTO accounts (user_id, username, password, role, profile_img, account_status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())';
    connection.execute(sql, [user_id, username, password, role, profile_img, account_status], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.status(201).json({ success: true, account_id: result.insertId });
    });
};

// Update account
exports.updateAccount = (req, res) => {
    const { username, role, profile_img, account_status } = req.body;
    const sql = 'UPDATE accounts SET username=?, role=?, profile_img=?, account_status=?, updated_at=NOW() WHERE account_id=?';
    connection.execute(sql, [username, role, profile_img, account_status, req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
};

// Delete account
exports.deleteAccount = (req, res) => {
    const sql = 'DELETE FROM accounts WHERE account_id = ?';
    connection.execute(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
}; 