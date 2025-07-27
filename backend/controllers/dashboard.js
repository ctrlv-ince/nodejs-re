const connection = require('../config/database');

exports.addressChart = (req, res) => {
    const sql = 'SELECT count(addressline) as total, addressline FROM users GROUP BY addressline ORDER BY total DESC';
    try {
        connection.query(sql, (err, rows, fields) => {
            if (err instanceof Error) {
                console.log(err);
                return;
            }
            return res.status(200).json({
                rows,
            })
        });
    } catch (error) {
        console.log(error)
    }


};

exports.salesChart = (req, res) => {
    const sql = 'SELECT monthname(oi.date_placed) as month, sum(ol.quantity * i.sell_price) as total FROM orderinfos oi INNER JOIN orders ol ON oi.orderinfo_id = ol.orderinfo_id INNER JOIN items i ON i.item_id = ol.item_id GROUP BY month(oi.date_placed)';
    try {
        connection.query(sql, (err, rows, fields) => {
            if (err instanceof Error) {
                console.log(err);
                return;
            }
            return res.status(200).json({
                rows,
            })
        });
    } catch (error) {
        console.log(error)
    }


};

exports.itemsChart = (req, res) => {
    const sql = 'SELECT i.description as items, sum(ol.quantity) as total FROM items i INNER JOIN orders ol ON i.item_id = ol.item_id GROUP BY i.description';
    try {
        connection.query(sql, (err, rows, fields) => {
            if (err instanceof Error) {
                console.log(err);
                return;
            }
            return res.status(200).json({
                rows,
            })
        });
    } catch (error) {
        console.log(error)
    }


};

exports.topSelling = (req, res) => {
    const sql = `SELECT i.item_id, i.item_name, i.item_description, img.image_path, SUM(oi.quantity) as total_sold
                 FROM items i
                 INNER JOIN orderinfos oi ON i.item_id = oi.item_id
                 LEFT JOIN item_images img ON i.item_id = img.item_id AND img.is_primary = 1
                 GROUP BY i.item_id, i.item_name, i.item_description, img.image_path
                 ORDER BY total_sold DESC
                 LIMIT 4`;
    connection.query(sql, (err, rows) => {
        if (err instanceof Error) {
            console.log(err);
            return res.status(500).json({ error: err });
        }
        return res.status(200).json({ rows });
    });
};