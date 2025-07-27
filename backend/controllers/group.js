const connection = require('../config/database');

// Groups CRUD
exports.getAllGroups = (req, res) => {
    connection.query('SELECT * FROM groups', (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows);
    });
};
exports.createGroup = (req, res) => {
    const { group_name, group_description } = req.body;
    connection.execute('INSERT INTO groups (group_name, group_description, created_at) VALUES (?, ?, NOW())', [group_name, group_description], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.status(201).json({ success: true, group_id: result.insertId });
    });
};
// ... (other CRUD for groups, item_groups, item_images) 