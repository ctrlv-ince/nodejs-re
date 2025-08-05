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

/**
 * Partial update for a group
 */
exports.updateGroup = (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { group_name, group_description } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, message: 'Invalid group id' });
    }

    const fields = [];
    const values = [];

    if (typeof group_name === 'string') {
        fields.push('group_name = ?');
        values.push(group_name);
    }
    if (typeof group_description === 'string') {
        fields.push('group_description = ?');
        values.push(group_description);
    }

    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'No fields provided to update' });
    }

    const sql = `UPDATE groups SET ${fields.join(', ')}, updated_at = NOW() WHERE group_id = ?`;
    values.push(id);

    connection.execute(sql, values, (err, result) => {
        if (err) {
            console.error('Update group error:', err);
            return res.status(500).json({ success: false, message: 'Update failed' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Group not found' });
        }
        return res.status(200).json({ success: true });
    });
};

/**
 * DELETE /api/v1/groups/:id
 */
exports.deleteGroup = (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
        return res.status(400).json({ success: false, message: 'Invalid group id' });
    }

    // If there is a linking table (item_groups) referencing this group, we should remove those rows first
    const deleteItemGroupsSql = 'DELETE FROM item_groups WHERE group_id = ?';
    connection.execute(deleteItemGroupsSql, [id], (dgErr) => {
        if (dgErr && dgErr.code !== 'ER_NO_REFERENCED_ROW_2') {
            // Continue even if no referencing table; but if error, report
            console.warn('Warning deleting item_groups for group:', id, dgErr);
        }
        const deleteGroupSql = 'DELETE FROM groups WHERE group_id = ?';
        connection.execute(deleteGroupSql, [id], (err, result) => {
            if (err) {
                console.error('Delete group error:', err);
                return res.status(500).json({ success: false, message: 'Delete failed', error: err.code || err.message });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Group not found' });
            }
            return res.status(200).json({ success: true, message: 'Group deleted', group_id: id });
        });
    });
};