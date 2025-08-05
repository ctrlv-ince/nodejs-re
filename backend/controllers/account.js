const connection = require('../config/database');

// Get all accounts with joined user details
exports.getAllAccounts = (req, res) => {
    const sql = `
        SELECT
            a.account_id,
            a.user_id,
            a.username,
            a.role,
            a.profile_img,
            a.account_status,
            a.created_at,
            a.updated_at,
            u.first_name,
            u.last_name,
            u.email,
            u.phone_number
        FROM accounts a
        INNER JOIN users u ON u.user_id = a.user_id
        ORDER BY a.account_id DESC
    `;
    connection.query(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows);
    });
};

// Get single account with joined user details
exports.getAccount = (req, res) => {
    const sql = `
        SELECT
            a.account_id,
            a.user_id,
            a.username,
            a.role,
            a.profile_img,
            a.account_status,
            a.created_at,
            a.updated_at,
            u.first_name,
            u.last_name,
            u.email,
            u.phone_number
        FROM accounts a
        INNER JOIN users u ON u.user_id = a.user_id
        WHERE a.account_id = ?
        LIMIT 1
    `;
    connection.execute(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows[0] || null);
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
    try {
        const accountId = req.params.id;
        if (!accountId) {
            return res.status(400).json({ success: false, message: 'Account ID is required' });
        }
        // Allow updating username, role, account_status from admin UI. Ignore profile_img unless explicitly provided.
        const allowed = ['username', 'role', 'account_status', 'profile_img'];
        const updates = [];
        const params = [];

        allowed.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                const val = req.body[key];
                // Use null for empty strings
                const normalized = (val === undefined || val === null || String(val).trim() === '') ? null : val;
                updates.push(`${key} = ?`);
                params.push(normalized);
            }
        });

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        const sql = `UPDATE accounts SET ${updates.join(', ')}, updated_at = NOW() WHERE account_id = ?`;
        params.push(accountId);

        connection.execute(sql, params, (err, result) => {
            if (err) {
                // Return structured error to help the frontend
                return res.status(500).json({ success: false, message: 'Failed to update account', error: err.code || String(err) });
            }
            return res.json({ success: true });
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Server error updating account', error: e.message });
    }
};

// Delete account
exports.deleteAccount = (req, res) => {
    const sql = 'DELETE FROM accounts WHERE account_id = ?';
    connection.execute(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
};