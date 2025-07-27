const connection = require('../config/database');

// Get cart for account
exports.getCart = (req, res) => {
    const sql = 'SELECT * FROM carts WHERE account_id = ?';
    connection.execute(sql, [req.params.account_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err });
        res.json(rows);
    });
};

// Add item to cart
exports.addToCart = (req, res) => {
    const { account_id, item_id, quantity } = req.body;
    const sql = 'INSERT INTO carts (account_id, item_id, quantity, date_placed, created_at) VALUES (?, ?, ?, NOW(), NOW())';
    connection.execute(sql, [account_id, item_id, quantity], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.status(201).json({ success: true, cart_id: result.insertId });
    });
};

// Update item quantity in cart
exports.updateCartItem = (req, res) => {
    const { quantity } = req.body;
    const sql = 'UPDATE carts SET quantity = ?, updated_at = NOW() WHERE cart_id = ?';
    connection.execute(sql, [quantity, req.params.cart_id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
};

// Remove item from cart
exports.removeFromCart = (req, res) => {
    const sql = 'DELETE FROM carts WHERE cart_id = ?';
    connection.execute(sql, [req.params.cart_id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
};

// Clear cart
exports.clearCart = (req, res) => {
    const sql = 'DELETE FROM carts WHERE account_id = ?';
    connection.execute(sql, [req.params.account_id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ success: true });
    });
}; 