const connection = require('../config/database');

// Get all reviews for an item
exports.getReviews = (req, res) => {
    const sql = 'SELECT * FROM reviews WHERE item_id = ?';
    connection.execute(sql, [req.params.item_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows);
    });
};

// Submit a review
exports.createReview = (req, res) => {
    const { item_id, user_id, rating, comment } = req.body;
    const sql = 'INSERT INTO reviews (item_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, NOW())';
    connection.execute(sql, [item_id, user_id, rating, comment], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.status(201).json({ success: true, review_id: result.insertId });
    });
};

// Delete a review
exports.deleteReview = (req, res) => {
    const sql = 'DELETE FROM reviews WHERE review_id = ?';
    connection.execute(sql, [req.params.review_id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
}; 