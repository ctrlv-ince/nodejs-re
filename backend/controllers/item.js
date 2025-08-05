const connection = require('../config/database');

exports.getAllItems = (req, res) => {
    const sql = `
        SELECT
            i.item_id, i.item_name, i.item_description, i.price,
            s.quantity,
            img.image_path,
            g.group_name
        FROM items i
        LEFT JOIN inventories s ON i.item_id = s.item_id
        LEFT JOIN item_images img ON i.item_id = img.item_id AND img.is_primary = 1
        LEFT JOIN item_groups ig ON i.item_id = ig.item_id
        LEFT JOIN groups g ON ig.group_id = g.group_id
        WHERE i.deleted_at IS NULL
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
        console.log(error)
        return res.status(500).json({ error: 'items list error' });
    }
}

exports.getSingleItem = (req, res) => {
    const sql = `
        SELECT
            i.item_id, i.item_name, i.item_description, i.price,
            s.quantity,
            img.image_path,
            ig.group_id,
            g.group_name
        FROM items i
        LEFT JOIN inventories s ON i.item_id = s.item_id
        LEFT JOIN item_images img ON i.item_id = img.item_id AND img.is_primary = 1
        LEFT JOIN item_groups ig ON i.item_id = ig.item_id
        LEFT JOIN groups g ON ig.group_id = g.group_id
        WHERE i.item_id = ?
    `;
    const values = [parseInt(req.params.id)];
    try {
        connection.execute(sql, values, (err, result) => {
            if (err instanceof Error) {
                console.error('getSingleItem error:', err);
                return res.status(500).json({ error: 'single item query error', details: err.sqlMessage || err.message || err.code });
            }
            return res.status(200).json({ success: true, result });
        });
    } catch (error) {
        console.error('getSingleItem exception:', error);
        return res.status(500).json({ error: 'single item error', details: error.message });
    }
}

exports.createItem = (req, res) => {
    const { item_name, item_description, price, quantity, group_id } = req.body;
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
        const stockValues = [itemId, quantity ?? 0];
        connection.execute(stockSql, stockValues, (err2) => {
            if (err2) {
                console.log(err2);
                return res.status(500).json({ error: 'Error inserting item', details: err2 });
            }
            // Optional: assign group via join table
            const gid = parseInt(group_id);
            if (gid) {
                const grpSql = `
                    INSERT INTO item_groups (item_id, group_id)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE group_id = VALUES(group_id)
                `;
                connection.execute(grpSql, [itemId, gid], (gErr) => {
                    if (gErr) console.log('Group assign error:', gErr);
                });
            }
            // Save images
            if (req.files && req.files.length > 0) {
                req.files.forEach((file, idx) => {
                    const diskPath = file.path.replace(/\\/g, "/");
                    const afterImages = diskPath.split('/images/')[1];
                    const imagePath = afterImages ? `uploads/${afterImages}` : diskPath.replace(/^images/, 'uploads');
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
                quantity: quantity ?? 0,
                group_id: gid || null
            });
        });
    });
};

exports.updateItem = (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) {
        return res.status(400).json({ success: false, error: 'Invalid item id' });
    }

    const { item_name, item_description, price, quantity, group_id } = req.body;

    const fields = [];
    const params = [];

    if (typeof item_name !== 'undefined' && item_name !== null && item_name !== '') {
        fields.push('item_name = ?');
        params.push(item_name);
    }
    if (typeof item_description !== 'undefined' && item_description !== null && item_description !== '') {
        fields.push('item_description = ?');
        params.push(item_description);
    }
    if (typeof price !== 'undefined' && price !== null && price !== '') {
        fields.push('price = ?');
        params.push(price);
    }

    // Support both single file (req.file) and multiple files (req.files as set by upload.array('images', 10))
    let normalizedImagePath = null;
    let normalizedImagePaths = [];
    if (Array.isArray(req.files) && req.files.length > 0) {
        normalizedImagePaths = req.files.map(f => {
            const diskPath = f.path.replace(/\\/g, "/");
            const afterImages = diskPath.split('/images/')[1];
            return afterImages ? `uploads/${afterImages}` : diskPath.replace(/^images/, 'uploads');
        });
        normalizedImagePath = normalizedImagePaths[0];
    } else if (req.file) {
        const diskPath = req.file.path.replace(/\\/g, "/");
        const afterImages = diskPath.split('/images/')[1];
        normalizedImagePath = afterImages ? `uploads/${afterImages}` : diskPath.replace(/^images/, 'uploads');
        normalizedImagePaths = normalizedImagePath ? [normalizedImagePath] : [];
    }

    const upsertGroup = (cb) => {
        const gid = parseInt(group_id);
        if (!gid) return cb();
        const grpSql = `
            INSERT INTO item_groups (item_id, group_id)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE group_id = VALUES(group_id)
        `;
        connection.execute(grpSql, [id, gid], (gErr) => {
            if (gErr) console.log('Group upsert error:', gErr);
            cb();
        });
    };

    const doInventoryUpdate = (cb) => {
        if (typeof quantity !== 'undefined' && quantity !== null && String(quantity).trim() !== '') {
            const stockSql = 'UPDATE inventories SET quantity = ? WHERE item_id = ?';
            connection.execute(stockSql, [quantity, id], (stockErr) => {
                if (stockErr) {
                    console.log(stockErr);
                    return res.status(500).json({ success: false, error: 'Error updating inventory', details: stockErr });
                }
                return cb();
            });
        } else {
            return cb();
        }
    };

    const finalizeWithImage = (done) => {
        if ((!normalizedImagePath) && (!normalizedImagePaths || normalizedImagePaths.length === 0)) {
            return done();
        }

        const doInsertMany = (paths) => {
            if (!paths || paths.length === 0) return done();

            // First image becomes primary, others are non-primary
            const first = paths[0];
            const rest = paths.slice(1);

            const insertPrimarySql = `
                INSERT INTO item_images (item_id, image_path, is_primary)
                VALUES (?, ?, 1)
            `;
            connection.execute(insertPrimarySql, [id, first], (imgErr) => {
                if (imgErr) {
                    console.error('Primary image insert error:', imgErr);
                    // Still attempt to insert the rest as non-primary
                }
                if (!rest.length) return done();

                const insertNonPrimarySql = `
                    INSERT INTO item_images (item_id, image_path, is_primary)
                    VALUES (?, ?, 0)
                `;
                let pending = rest.length;
                rest.forEach(p => {
                    connection.execute(insertNonPrimarySql, [id, p], (npErr) => {
                        if (npErr) console.error('Non-primary image insert error:', npErr);
                        pending -= 1;
                        if (pending === 0) return done();
                    });
                });
            });
        };

        // Always clear existing primary to ensure a single primary after update
        const unsetPrimarySql = 'UPDATE item_images SET is_primary = 0 WHERE item_id = ? AND is_primary = 1';
        connection.execute(unsetPrimarySql, [id], (unsetErr) => {
            if (unsetErr) console.log('Unset primary error:', unsetErr);
            if (normalizedImagePaths && normalizedImagePaths.length > 0) {
                return doInsertMany(normalizedImagePaths);
            }
            // Fallback: single legacy path
            return doInsertMany([normalizedImagePath]);
        });
    };

    const afterItemUpdate = () => {
        upsertGroup(() => {
            doInventoryUpdate(() => {
                finalizeWithImage(() => res.status(200).json({ success: true }));
            });
        });
    };

    if (fields.length > 0) {
        const itemSql = `UPDATE items SET ${fields.join(', ')} WHERE item_id = ?`;
        params.push(id);
        connection.execute(itemSql, params, (err) => {
            if (err) {
                console.error('Error updating item:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Error updating item',
                    details: (err && (err.sqlMessage || err.message || err.code)) || err
                });
            }
            afterItemUpdate();
        });
    } else if (
        (typeof quantity !== 'undefined' && quantity !== null && String(quantity).trim() !== '') ||
        normalizedImagePath ||
        (group_id && String(group_id).trim() !== '')
    ) {
        // No core field changes; still process group/inventory/image updates
        afterItemUpdate();
    } else {
        return res.status(400).json({ success: false, error: 'No fields to update. Provide at least one of: item_name, item_description, price, quantity, image, group_id' });
    }
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

/**
 * Delete a single image for an item and promote a new primary if necessary
 * Body: { image_path: 'uploads/filename.jpg' }
 */
exports.deleteItemImage = (req, res) => {
    const itemId = parseInt(req.params.id);
    const { image_path } = req.body || {};

    if (!itemId || !image_path) {
        return res.status(400).json({ success: false, error: 'item_id and image_path are required' });
    }

    // Check if the image to delete is currently primary
    const selectSql = 'SELECT image_id, is_primary FROM item_images WHERE item_id = ? AND image_path = ?';
    connection.execute(selectSql, [itemId, image_path], (selErr, selRows) => {
        if (selErr) {
            console.error('Select image error:', selErr);
            return res.status(500).json({ success: false, error: 'Select image error', details: selErr.sqlMessage || selErr.message || selErr.code });
        }
        if (!selRows || selRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Image not found for item' });
        }

        const wasPrimary = selRows[0].is_primary === 1;

        // Delete the image
        const delSql = 'DELETE FROM item_images WHERE item_id = ? AND image_path = ?';
        connection.execute(delSql, [itemId, image_path], (delErr, delRes) => {
            if (delErr) {
                console.error('Delete image error:', delErr);
                return res.status(500).json({ success: false, error: 'Delete image error', details: delErr.sqlMessage || delErr.message || delErr.code });
            }

            if (!wasPrimary) {
                return res.status(200).json({ success: true });
            }

            // If it was primary, promote the most recent remaining image to primary (if any remain)
            const findAnySql = 'SELECT image_id FROM item_images WHERE item_id = ? ORDER BY image_id DESC LIMIT 1';
            connection.execute(findAnySql, [itemId], (findErr, findRows) => {
                if (findErr) {
                    console.error('Find remaining image error:', findErr);
                    return res.status(500).json({ success: false, error: 'Find remaining image error', details: findErr.sqlMessage || findErr.message || findErr.code });
                }

                if (!findRows || findRows.length === 0) {
                    // No images remain; nothing to promote
                    return res.status(200).json({ success: true });
                }

                const newPrimaryId = findRows[0].image_id;
                const unsetSql = 'UPDATE item_images SET is_primary = 0 WHERE item_id = ?';
                connection.execute(unsetSql, [itemId], (unsetErr) => {
                    if (unsetErr) {
                        console.error('Unset primary error:', unsetErr);
                        return res.status(500).json({ success: false, error: 'Unset primary error', details: unsetErr.sqlMessage || unsetErr.message || unsetErr.code });
                    }
                    const setSql = 'UPDATE item_images SET is_primary = 1 WHERE image_id = ?';
                    connection.execute(setSql, [newPrimaryId], (setErr) => {
                        if (setErr) {
                            console.error('Set new primary error:', setErr);
                            return res.status(500).json({ success: false, error: 'Set new primary error', details: setErr.sqlMessage || setErr.message || setErr.code });
                        }
                        return res.status(200).json({ success: true });
                    });
                });
            });
        });
    });
}

exports.getItemImages = (req, res) => {
    const itemId = parseInt(req.params.id);
    if (!itemId) {
        return res.status(400).json({ success: false, error: 'Invalid item id' });
    }
    const sql = `SELECT image_id, item_id, image_path, is_primary, uploaded_at
                 FROM item_images
                 WHERE item_id = ?`;
    connection.execute(sql, [itemId], (err, rows) => {
        if (err) {
            console.error('getItemImages error:', err);
            return res.status(500).json({ success: false, error: 'getItemImages error', details: err.sqlMessage || err.message || err.code });
        }
        return res.status(200).json({ success: true, rows });
    });
}

exports.searchItems = (req, res) => {
    const { term } = req.query;
    if (!term) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    const sql = `SELECT i.item_id, i.item_name, i.item_description, i.price, img.image_path
                 FROM items i
                 LEFT JOIN item_images img ON i.item_id = img.item_id AND img.is_primary = 1
                 WHERE (i.item_name LIKE ? OR i.item_description LIKE ?)
                 AND (i.deleted_at IS NULL)
                 ORDER BY i.item_name
                 LIMIT 10`;
    
    const searchTerm = `%${term}%`;
    
    try {
        connection.execute(sql, [searchTerm, searchTerm], (err, rows) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ error: 'Search error', details: err });
            }
            
            return res.status(200).json({
                success: true,
                rows: rows
            });
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Search error' });
    }
};

// Return all images for an item (for edit modal preview)
exports.getItemImages = (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) {
        return res.status(400).json({ error: 'Invalid item id' });
    }
    const sql = `
        SELECT image_path, is_primary, uploaded_at
        FROM item_images
        WHERE item_id = ?
          AND (deleted_at IS NULL)
        ORDER BY is_primary DESC, uploaded_at DESC
    `;
    connection.execute(sql, [id], (err, rows) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error fetching item images', details: err });
        }
        return res.status(200).json({ rows });
    });
};

