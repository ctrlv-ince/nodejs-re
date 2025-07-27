const connection = require('../config/database');

exports.getAllItems = (req, res) => {
    const sql = 'SELECT * FROM items i INNER JOIN inventories s ON i.item_id = s.item_id';

    try {
        connection.query(sql, (err, rows, fields) => {
            if (err instanceof Error) {
                console.log(err);
                return;
            }
            console.log(rows);
            return res.status(200).json({
                rows,
            })
        });
    } catch (error) {
        console.log(error)
    }
}

exports.getSingleItem = (req, res) => {
    //http://localhost:4000/api/v1/items/id
    const sql = 'SELECT * FROM items i INNER JOIN inventories s ON i.item_id = s.item_id WHERE i.item_id = ?'
    const values = [parseInt(req.params.id)];
    try {
        connection.execute(sql, values, (err, result, fields) => {
            if (err instanceof Error) {
                console.log(err);
                return;
            }

            return res.status(200).json({
                success: true,
                result
            })
        });
    } catch (error) {
        console.log(error)
    }
}

exports.createItem = (req, res) => {
    const { item_name, item_description, price, quantity } = req.body;
    if (!item_name || !item_description || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const sql = 'INSERT INTO items (item_name, item_description, price) VALUES (?, ?, ?)';
    const values = [item_name, item_description, price];
    connection.execute(sql, values, (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error inserting item', details: err });
        }
        const itemId = result.insertId;
        const stockSql = 'INSERT INTO inventories (item_id, quantity) VALUES (?, ?)';
        const stockValues = [itemId, quantity];
        connection.execute(stockSql, stockValues, (err, result) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: 'Error inserting item', details: err });
            }
            // Save images
            if (req.files && req.files.length > 0) {
                req.files.forEach((file, idx) => {
                    const imagePath = file.path.replace(/\\/g, "/");
                    const isPrimary = idx === 0 ? 1 : 0;
                    const imgSql = 'INSERT INTO item_images (item_id, image_path, is_primary) VALUES (?, ?, ?)';
                    connection.execute(imgSql, [itemId, imagePath, isPrimary], (imgErr) => {
                        if (imgErr) console.log(imgErr);
                    });
                });
            }
            return res.status(201).json({
                success: true,
                itemId,
                quantity
            });
        });
    });
};

exports.updateItem = (req, res) => {

    console.log(req.file)
    const item = req.body
    const image = req.file
    const id = req.params.id

    const { description, cost_price, sell_price, quantity } = req.body;
    if (req.file) {
        imagePath = req.file.path.replace(/\\/g, "/");
    }

    if (!description || !cost_price || !sell_price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = 'UPDATE items SET description = ?, cost_price = ?, sell_price = ?, image = ? WHERE item_id = ?';
    const values = [description, cost_price, sell_price, imagePath, id];

    connection.execute(sql, values, (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error inserting item', details: err });
        }
    });

    const stockSql = 'UPDATE inventories SET quantity = ? WHERE item_id = ?';
    const stockValues = [quantity, id];

    connection.execute(stockSql, stockValues, (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error updating item', details: err });
        }


    });

    return res.status(201).json({
        success: true,
    });
}

exports.deleteItem = (req, res) => {

    const id = req.params.id
    const sql = 'DELETE FROM items WHERE item_id = ?';
    const values = [id];

    connection.execute(sql, values, (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error deleting item', details: err });
        }
    });

    return res.status(201).json({
        success: true,
        message: 'item deleted'
    });
}

