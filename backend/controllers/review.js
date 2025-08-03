const connection = require('../config/database');

// Get the authenticated user's review for a specific item (for editing)
// GET /api/v1/reviews/me/:item_id
exports.getMyReviewForItem = (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const userId = parseInt(req.user.id);
    const itemId = parseInt(req.params.item_id);
    if (!itemId) {
        return res.status(400).json({ success: false, error: 'Invalid item_id' });
    }
    // Map user -> account
    const acctSql = 'SELECT account_id FROM accounts WHERE user_id = ?';
    connection.execute(acctSql, [userId], (acctErr, acctRows) => {
        if (acctErr || !acctRows || acctRows.length === 0) {
            return res.status(400).json({ success: false, error: 'Account not found for user' });
        }
        const accountId = acctRows[0].account_id;
        const sql = `
            SELECT review_id, item_id, rating, comment, create_at AS created_at, update_at AS updated_at
            FROM reviews
            WHERE account_id = ? AND item_id = ?
            LIMIT 1
        `;
        connection.execute(sql, [accountId, itemId], (err, rows) => {
            if (err) return res.status(500).json({ success: false, error: 'get my review error', details: err });
            if (!rows || rows.length === 0) {
                return res.status(200).json({ success: true, review: null });
            }
            return res.status(200).json({ success: true, review: rows[0] });
        });
    });
};

// Get all reviews for an item (with user/account info)
exports.getReviews = (req, res) => {
    const itemId = parseInt(req.params.item_id);
    if (!itemId) return res.status(400).json({ success: false, error: 'Invalid item_id' });

    const sql = `
        SELECT
            r.review_id, r.account_id, r.item_id, r.comment, r.rating, r.create_at as created_at,
            a.username, a.role, a.account_status
        FROM reviews r
        LEFT JOIN accounts a ON r.account_id = a.account_id
        WHERE r.item_id = ?
        ORDER BY r.create_at DESC
    `;
    connection.execute(sql, [itemId], (err, rows) => {
        if (err) return res.status(500).json({ success: false, error: 'reviews fetch error', details: err });
        return res.status(200).json({ success: true, rows });
    });
};

// Submit a review (auth required via middleware, derive account_id by user_id)
exports.createReview = (req, res) => {
    const { item_id, rating, comment, order_id } = req.body;
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const userId = parseInt(req.user.id);
    const itemId = parseInt(item_id);
    const rate = parseInt(rating);
    const orderId = parseInt(order_id);

    if (!itemId || !orderId || !rate || rate < 1 || rate > 5) {
        return res.status(400).json({ success: false, error: 'item_id, order_id, and rating (1..5) are required' });
    }

    // Map user -> account
    const acctSql = 'SELECT account_id FROM accounts WHERE user_id = ?';
    connection.execute(acctSql, [userId], (acctErr, acctRows) => {
        if (acctErr || !acctRows || acctRows.length === 0) {
            return res.status(400).json({ success: false, error: 'Account not found for user' });
        }
        const accountId = acctRows[0].account_id;

        // Verify the item is in the user's order and the order status is completed
        // Schema shows order lines are stored in orderinfos table, and orders table has status
        const verifySql = `
            SELECT o.order_id, o.status, oi.item_id
            FROM orders o
            INNER JOIN orderinfos oi ON o.order_id = oi.order_id
            WHERE o.account_id = ? AND o.order_id = ? AND oi.item_id = ?
            LIMIT 1
        `;
        connection.execute(verifySql, [accountId, orderId, itemId], (vErr, vRows) => {
            if (vErr) {
                return res.status(500).json({ success: false, error: 'verification error', details: vErr });
            }
            if (!vRows || vRows.length === 0) {
                return res.status(403).json({ success: false, error: 'Item not found in this order for this user' });
            }
            const status = (vRows[0].status || '').toLowerCase();
            if (status !== 'completed') {
                return res.status(403).json({ success: false, error: 'You can review only after the order is completed' });
            }

            // Optional: prevent duplicate review for same (order_id, item_id, account_id)
            const dupSql = `SELECT review_id FROM reviews WHERE account_id = ? AND item_id = ? AND create_at IS NOT NULL LIMIT 1`;
            connection.execute(dupSql, [accountId, itemId], (dErr, dRows) => {
                if (dErr) {
                    return res.status(500).json({ success: false, error: 'duplicate check error', details: dErr });
                }
                // Allow multiple reviews across different orders if needed; to restrict one per item per account, keep this guard:
                if (dRows && dRows.length > 0) {
                    return res.status(409).json({ success: false, error: 'You already reviewed this item' });
                }

                const sql = `INSERT INTO reviews (account_id, item_id, comment, rating, create_at, update_at)
                             VALUES (?, ?, ?, ?, NOW(), NOW())`;
                connection.execute(sql, [accountId, itemId, comment || '', rate], (err, result) => {
                    if (err) return res.status(500).json({ success: false, error: 'create review error', details: err });
                    return res.status(201).json({ success: true, review_id: result.insertId });
                });
            });
        });
    });
};

// Upsert (create or update) a review for the authenticated user
// PUT /api/v1/reviews  Body: { item_id, rating, comment }
exports.upsertReview = (req, res) => {
    const { item_id, rating, comment } = req.body || {};
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const userId = parseInt(req.user.id);
    const itemId = parseInt(item_id);
    const rate = parseInt(rating);
    if (!itemId || !rate || rate < 1 || rate > 5) {
        return res.status(400).json({ success: false, error: 'item_id and rating (1..5) are required' });
    }

    // Map user -> account
    const acctSql = 'SELECT account_id FROM accounts WHERE user_id = ?';
    connection.execute(acctSql, [userId], (acctErr, acctRows) => {
        if (acctErr || !acctRows || acctRows.length === 0) {
            return res.status(400).json({ success: false, error: 'Account not found for user' });
        }
        const accountId = acctRows[0].account_id;

        // Check existing review by this account for this item
        const selSql = 'SELECT review_id FROM reviews WHERE account_id = ? AND item_id = ? LIMIT 1';
        connection.execute(selSql, [accountId, itemId], (sErr, sRows) => {
            if (sErr) return res.status(500).json({ success: false, error: 'select review error', details: sErr });

            if (sRows && sRows.length > 0) {
                // Update existing
                const reviewId = sRows[0].review_id;
                const updSql = 'UPDATE reviews SET rating = ?, comment = ?, update_at = NOW() WHERE review_id = ? AND account_id = ?';
                connection.execute(updSql, [rate, comment || '', reviewId, accountId], (uErr, uRes) => {
                    if (uErr) return res.status(500).json({ success: false, error: 'update review error', details: uErr });
                    return res.status(200).json({ success: true, action: 'updated', review_id: reviewId });
                });
            } else {
                // Insert new
                const insSql = 'INSERT INTO reviews (account_id, item_id, comment, rating, create_at, update_at) VALUES (?, ?, ?, ?, NOW(), NOW())';
                connection.execute(insSql, [accountId, itemId, comment || '', rate], (iErr, iRes) => {
                    if (iErr) return res.status(500).json({ success: false, error: 'create review error', details: iErr });
                    return res.status(201).json({ success: true, action: 'created', review_id: iRes.insertId });
                });
            }
        });
    });
};

// Delete a review (admin or owner)
exports.deleteReview = (req, res) => {
    const reviewId = parseInt(req.params.review_id);
    if (!reviewId) return res.status(400).json({ success: false, error: 'Invalid review_id' });

    // If admin, allow; else require ownership by account_id
    const isAdmin = req.user && req.user.role === 'admin';
    if (isAdmin) {
        const sql = 'DELETE FROM reviews WHERE review_id = ?';
        return connection.execute(sql, [reviewId], (err) => {
            if (err) return res.status(500).json({ success: false, error: 'delete review error', details: err });
            return res.status(200).json({ success: true });
        });
    }

    // Owner path
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Map user_id -> account_id
    const mapSql = 'SELECT account_id FROM accounts WHERE user_id = ?';
    connection.execute(mapSql, [parseInt(req.user.id)], (mErr, mRows) => {
        if (mErr || !mRows || mRows.length === 0) {
            return res.status(400).json({ success: false, error: 'Account not found' });
        }
        const accountId = mRows[0].account_id;

        const sql = 'DELETE FROM reviews WHERE review_id = ? AND account_id = ?';
        connection.execute(sql, [reviewId, accountId], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: 'delete review error', details: err });
            if (result.affectedRows === 0) {
                return res.status(403).json({ success: false, error: 'Not allowed to delete this review' });
            }
            return res.status(200).json({ success: true });
        });
    });
};