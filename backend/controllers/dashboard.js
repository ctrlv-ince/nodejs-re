const connection = require('../config/database');

exports.addressChart = (req, res) => {
    // Users table has no 'addressline' column in schema; show distribution by sex instead
    const sql = `
        SELECT sex AS label, COUNT(*) AS total
        FROM users
        WHERE sex IS NOT NULL
        GROUP BY sex
        ORDER BY total DESC
    `;
    try {
        connection.query(sql, (err, rows) => {
            if (err instanceof Error) {
                console.log(err);
                return res.status(500).json({ error: err.message });
            }
            return res.status(200).json({ rows });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'address chart error' });
    }
};

exports.salesChart = (req, res) => {
    // orderinfos has 'created' datetime; items has 'price'. Aggregate monthly sales from orderinfos lines.
    const sql = `
        SELECT
            MONTHNAME(oi.created) AS month,
            SUM(oi.quantity * i.price) AS total
        FROM orderinfos oi
        INNER JOIN items i ON i.item_id = oi.item_id
        GROUP BY YEAR(oi.created), MONTH(oi.created)
        ORDER BY YEAR(oi.created), MONTH(oi.created)
    `;
    try {
        connection.query(sql, (err, rows) => {
            if (err instanceof Error) {
                console.log(err);
                return res.status(500).json({ error: err.message });
            }
            return res.status(200).json({ rows });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'sales chart error' });
    }
};

exports.itemsChart = (req, res) => {
    // Sum items sold by item_name using orderinfos (line items)
    const sql = `
        SELECT
            i.item_name AS items,
            SUM(oi.quantity) AS total
        FROM items i
        INNER JOIN orderinfos oi ON i.item_id = oi.item_id
        GROUP BY i.item_id, i.item_name
        ORDER BY total DESC
    `;
    try {
        connection.query(sql, (err, rows) => {
            if (err instanceof Error) {
                console.log(err);
                return res.status(500).json({ error: err.message });
            }
            return res.status(200).json({ rows });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'items chart error' });
    }
};

exports.topSelling = (req, res) => {
    // Align with actual DB schema:
    // - orders table is order header (no item_id).
    // - orderinfos table contains line items: (order_id, item_id, quantity).
    // We aggregate popularity by summing quantities from orderinfos.
    const sql = `
        SELECT
            i.item_id,
            i.item_name,
            i.item_description,
            img.image_path,
            COALESCE(SUM(oi.quantity), 0) AS total_sold
        FROM items i
        LEFT JOIN orderinfos oi ON i.item_id = oi.item_id
        LEFT JOIN item_images img
            ON i.item_id = img.item_id
            AND img.is_primary = 1
        GROUP BY i.item_id, i.item_name, i.item_description, img.image_path
        ORDER BY total_sold DESC
        LIMIT 4
    `;
    connection.query(sql, (err, rows) => {
        if (err instanceof Error) {
            console.log(err);
            return res.status(500).json({ error: err });
        }
        return res.status(200).json({ rows });
    });
};

/**
 * New endpoints for dashboard charts used by frontend:
 * 1) top-products-revenue (all time)
 * 2) top-products-quantity (all time)
 * 3) revenue-by-category (all time)
 */

// 1) Bar: Top 10 products by revenue (all time)
exports.topProductsRevenue = (req, res) => {
    const sql = `
        SELECT
            i.item_id,
            i.item_name,
            SUM(oi.quantity * i.price) AS revenue
        FROM orderinfos oi
        INNER JOIN items i ON i.item_id = oi.item_id
        GROUP BY i.item_id, i.item_name
        ORDER BY revenue DESC
        LIMIT 10
    `;
    connection.query(sql, (err, rows) => {
        if (err instanceof Error) {
            console.error('topProductsRevenue error:', err);
            return res.status(500).json({ error: 'topProductsRevenue error', details: err.message || err.code });
        }
        return res.status(200).json({ rows });
    });
};

// 2) Line: Top 10 products by total quantity sold (all time)
exports.topProductsQuantity = (req, res) => {
    const sql = `
        SELECT
            i.item_id,
            i.item_name,
            SUM(oi.quantity) AS total_qty
        FROM orderinfos oi
        INNER JOIN items i ON i.item_id = oi.item_id
        GROUP BY i.item_id, i.item_name
        ORDER BY total_qty DESC
        LIMIT 10
    `;
    connection.query(sql, (err, rows) => {
        if (err instanceof Error) {
            console.error('topProductsQuantity error:', err);
            return res.status(500).json({ error: 'topProductsQuantity error', details: err.message || err.code });
        }
        return res.status(200).json({ rows });
    });
};

// 3) Pie: Revenue by categories (all time)
// Assumes groups/categories via item_groups -> groups
exports.revenueByCategory = (req, res) => {
    const sql = `
        SELECT
            COALESCE(g.group_name, 'Uncategorized') AS category_name,
            SUM(oi.quantity * i.price) AS revenue
        FROM orderinfos oi
        INNER JOIN items i ON i.item_id = oi.item_id
        LEFT JOIN item_groups ig ON i.item_id = ig.item_id
        LEFT JOIN groups g ON ig.group_id = g.group_id
        GROUP BY COALESCE(g.group_name, 'Uncategorized')
        ORDER BY revenue DESC
    `;
    connection.query(sql, (err, rows) => {
        if (err instanceof Error) {
            console.error('revenueByCategory error:', err);
            return res.status(500).json({ error: 'revenueByCategory error', details: err.message || err.code });
        }
        return res.status(200).json({ rows });
    });
};