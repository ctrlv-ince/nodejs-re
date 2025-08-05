const connection = require('../config/database');
const sendEmail = require('../utils/sendEmail');
const { generateOrderReceipt } = require('../utils/generatePDF');


/**
 * POST /api/v1/create-order
 * Creates an order and sends email with PDF receipt (Mailtrap via sendEmail util)
 */
exports.createOrder = (req, res, next) => {
    const { cart } = req.body;

    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userId = parseInt(req.user.id);
    const dateOrdered = new Date();
    const dateShipped = new Date();

    if (!Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    connection.beginTransaction(err => {
        if (err) {
            console.log(err);
            return res.status(500).json({ success: false, error: 'Transaction error', details: err });
        }

        // Map user_id -> account_id for header order
        const userSql = `
            SELECT u.user_id, u.first_name, u.last_name, u.email, a.account_id
            FROM users u
            LEFT JOIN accounts a ON a.user_id = u.user_id
            WHERE u.user_id = ?
        `;
        connection.execute(userSql, [userId], (err, results) => {
            if (err || results.length === 0) {
                return connection.rollback(() => {
                    if (!res.headersSent) {
                        res.status(404).json({ success: false, error: 'User not found' });
                    }
                });
            }

            const { user_id, first_name, last_name, email, account_id } = results[0];

            if (!account_id) {
                return connection.rollback(() => {
                    if (!res.headersSent) {
                        res.status(400).json({ success: false, error: 'Account not found for user. Please ensure account exists.' });
                    }
                });
            }

            // Normalize date to MySQL DATETIME string
            const pad2 = (n) => String(n).padStart(2, '0');
            const d = new Date(dateOrdered);
            const formattedDate = `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

            // Insert order header into orders table
            // Some schemas may not have total_amount or status. Try a robust insertion path.

            // Define proceedAfterHeaderInsert BEFORE any callback uses it to avoid TDZ/hoisting issues
            const proceedAfterHeaderInsert = (oid) => {
                const order_id = oid;

                // Insert lines into orderinfos (schema holds lines here)
                const orderLineSql = 'INSERT INTO orderinfos (order_id, item_id, quantity, created) VALUES (?, ?, ?, NOW())';
                let errorOccurred = false;
                let completed = 0;

                let computedTotal = 0;

                cart.forEach((item) => {
                    const itemId = parseInt(item.item_id);
                    const qty = parseInt(item.quantity);
                    if (!itemId || !qty || qty <= 0) {
                        errorOccurred = true;
                        return connection.rollback(() => {
                            if (!res.headersSent) {
                                res.status(400).json({ success: false, error: 'Invalid cart item' });
                            }
                        });
                    }

                    // Accumulate total from items table price if provided in payload fallback to 0
                    if (!isNaN(item.price)) {
                        computedTotal += Number(item.price) * qty;
                    }

                    connection.execute(orderLineSql, [order_id, itemId, qty], (err) => {
                        if (err && !errorOccurred) {
                            errorOccurred = true;
                            return connection.rollback(() => {
                                if (!res.headersSent) {
                                    res.status(500).json({ success: false, error: 'Error inserting order line', details: err });
                                }
                            });
                        }

                        completed++;
                        if (completed === cart.length && !errorOccurred) {
                            // If computedTotal is 0 (no prices in payload), compute from DB
                            const computeSql = `
                                SELECT SUM(i.price * oi.quantity) AS total
                                FROM orderinfos oi
                                INNER JOIN items i ON i.item_id = oi.item_id
                                WHERE oi.order_id = ?
                            `;
                            connection.execute(computeSql, [order_id], (sumErr, sumRows) => {
                                if (!sumErr && sumRows && sumRows.length) {
                                    computedTotal = Number(sumRows[0].total || 0);
                                }
                                const updSql = 'UPDATE orders SET total_amount = ? WHERE order_id = ?';
                                connection.execute(updSql, [computedTotal, order_id], () => {
                                    // proceed commit after updating header total
                                    connection.commit(async err => {
                                        if (err) {
                                            return connection.rollback(() => {
                                                if (!res.headersSent) {
                                                    res.status(500).json({ success: false, error: 'Commit error', details: err });
                                                }
                                            });
                                        }

                                        try {
                                            // Recompute lines from DB to ensure trusted pricing for receipt
                                            const [dbLines] = await new Promise((resolve) => {
                                                const sql = `
                                                    SELECT
                                                        oi.item_id,
                                                        oi.quantity,
                                                        i.item_name,
                                                        i.item_description,
                                                        i.price
                                                    FROM orderinfos oi
                                                    INNER JOIN items i ON i.item_id = oi.item_id
                                                    WHERE oi.order_id = ?
                                                `;
                                                connection.execute(sql, [order_id], (e, rows) => resolve([rows || []]));
                                            });

                                            const lineItems = dbLines.map(r => ({
                                                item_id: r.item_id,
                                                item_name: r.item_name,
                                                item_description: r.item_description,
                                                quantity: Number(r.quantity) || 0,
                                                price: Number(r.price) || 0,
                                                line_total: (Number(r.price) || 0) * (Number(r.quantity) || 0),
                                            }));
                                            const subtotal = lineItems.reduce((sum, li) => sum + li.line_total, 0);

                                            const orderDetails = {
                                                order_id,
                                                date_ordered: dateOrdered,
                                                customer_name: `${first_name || ''} ${last_name || ''}`.trim(),
                                                customer_email: email,
                                                status: 'pending',
                                                items: lineItems,
                                                subtotal
                                            };

                                            const pdfResult = await generateOrderReceipt(orderDetails);

                                            const message = `
                                                <h2>Order Confirmation</h2>
                                                <p>Dear ${first_name || 'Customer'},</p>
                                                <p>Thank you for your order! Your order #${order_id} is being processed.</p>
                                                <p><strong>Summary</strong></p>
                                                <ul>
                                                    ${lineItems.map(li => `<li>${li.item_name} &times; ${li.quantity} @ ₱${li.price} = ₱${li.line_total.toFixed(2)}</li>`).join('')}
                                                </ul>
                                                <p><strong>Total:</strong> ₱${subtotal.toFixed(2)}</p>
                                                ${pdfResult.success ? '<p>Please find your detailed receipt attached.</p>' : '<p>We were unable to attach the PDF receipt at this time.</p>'}
                                            `;

                                            const emailPayload = {
                                                email,
                                                subject: `Order Confirmation #${order_id} - Bit & Board`,
                                                message
                                            };
                                            
                                            if (pdfResult.success) {
                                                emailPayload.attachments = [{
                                                    filename: pdfResult.filename || `order_${order_id}.pdf`,
                                                    path: pdfResult.filepath
                                                }];
                                            }

                                            await sendEmail(emailPayload);
                                        } catch (emailErr) {
                                            console.log('Email/PDF error:', emailErr);
                                        }

                                        if (!res.headersSent) {
                                            res.status(201).json({
                                                success: true,
                                                order_id,
                                                dateOrdered,
                                                total_amount: computedTotal,
                                                message: 'Order placed successfully',
                                                items: cart.length
                                            });
                                        }
                                    });
                                });
                            });
                        }
                    });
                });
            };

            const tryInsertHeader = (withTotalAndStatus) => {
                if (withTotalAndStatus) {
                    const sql = 'INSERT INTO orders (account_id, date_ordered, total_amount, status, created_at) VALUES (?, ?, ?, ?, NOW())';
                    const params = [account_id, formattedDate, 0, 'pending'];
                    return { sql, params };
                }
                // Fallback: no total_amount and status columns
                const sql = 'INSERT INTO orders (account_id, date_ordered, created_at) VALUES (?, ?, NOW())';
                const params = [account_id, formattedDate];
                return { sql, params };
            };

            let { sql: orderHdrSql, params: hdrParams } = tryInsertHeader(true);
            connection.execute(orderHdrSql, hdrParams, (err, hdrResult) => {
                if (err) {
                    const msg = (err.message || '').toLowerCase();
                    // If unknown column for total_amount or status, fallback to minimal insert
                    if (msg.includes('unknown column') && (msg.includes('total_amount') || msg.includes('status'))) {
                        const fallback = tryInsertHeader(false);
                        return connection.execute(fallback.sql, fallback.params, (err2, hdrResult2) => {
                            if (err2) {
                                return connection.rollback(() => {
                                    if (!res.headersSent) {
                                        res.status(500).json({ success: false, error: 'Error inserting order header (fallback failed)', details: err2 });
                                    }
                                });
                            }
                            proceedAfterHeaderInsert(hdrResult2.insertId);
                        });
                    }

                    // If ENUM error for status value, attempt without status
                    if (msg.includes('incorrect') && msg.includes('value') && msg.includes('status')) {
                        const fallback = tryInsertHeader(false);
                        return connection.execute(fallback.sql, fallback.params, (err2, hdrResult2) => {
                            if (err2) {
                                return connection.rollback(() => {
                                    if (!res.headersSent) {
                                        res.status(500).json({ success: false, error: 'Error inserting order header (status fallback failed)', details: err2 });
                                    }
                                });
                            }
                            proceedAfterHeaderInsert(hdrResult2.insertId);
                        });
                    }

                    // Other errors
                    return connection.rollback(() => {
                        if (!res.headersSent) {
                            res.status(500).json({ success: false, error: 'Error inserting order header', details: err });
                        }
                    });
                }

                const order_id = hdrResult.insertId;
                // Use the outer proceedAfterHeaderInsert defined earlier to continue the flow
                proceedAfterHeaderInsert(order_id);
            });
        });
    });
};
 
/**
 * GET /api/v1/orders?limit=&offset=
 * Admin-only: List recent orders with basic info (order_id, user name, date_ordered, status, total_amount)
 */
exports.listOrders = (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // Prefer query with status; if column doesn't exist, fall back
    const sqlWithStatus = `
        SELECT
            o.order_id,
            o.date_ordered,
            o.status,
            o.total_amount,
            u.first_name,
            u.last_name
        FROM orders o
        INNER JOIN accounts a ON a.account_id = o.account_id
        INNER JOIN users u ON u.user_id = a.user_id
        ORDER BY o.order_id DESC
        LIMIT ? OFFSET ?
    `;

    const sqlNoStatus = `
        SELECT
            o.order_id,
            o.date_ordered,
            u.first_name,
            u.last_name
        FROM orders o
        INNER JOIN accounts a ON a.account_id = o.account_id
        INNER JOIN users u ON u.user_id = a.user_id
        ORDER BY o.order_id DESC
        LIMIT ? OFFSET ?
    `;

    connection.execute(sqlWithStatus, [limit, offset], (err, rows) => {
        if (!err) {
            return res.status(200).json({ success: true, data: rows, limit, offset });
        }
        const msg = (err && err.message) ? err.message.toLowerCase() : '';
        if (msg.includes('unknown column') && msg.includes('status')) {
            connection.execute(sqlNoStatus, [limit, offset], (err2, rows2) => {
                if (err2) {
                    console.error('Orders list error (fallback):', err2);
                    return res.status(500).json({ success: false, message: 'Failed to list orders' });
                }
                const normalized = rows2.map(r => ({ ...r, status: null }));
                return res.status(200).json({ success: true, data: normalized, limit, offset });
            });
        } else {
            console.error('Orders list error:', err);
            return res.status(500).json({ success: false, message: 'Failed to list orders' });
        }
    });
};
 
/**
 * GET /api/v1/orders?limit=&offset=
 * Admin-only: List recent orders with basic info (order_id, user name, date_ordered, status, total_amount)
 * Falls back to computed total when total_amount column is missing.
 */
exports.listOrders = (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // Primary query expects orders.total_amount to exist
    const sqlWithTotal = `
        SELECT
            o.order_id AS order_no,
            o.date_ordered,
            o.status,
            o.total_amount,
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS customer_name,
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS user
        FROM orders o
        INNER JOIN accounts a ON a.account_id = o.account_id
        INNER JOIN users u ON u.user_id = a.user_id
        ORDER BY o.order_id DESC
        LIMIT ? OFFSET ?
    `;

    // Fallback computes totals from orderinfos + items if total_amount column is missing
    const sqlComputedTotal = `
        SELECT
            o.order_id AS order_no,
            o.date_ordered,
            o.status,
            COALESCE(SUM(i.price * oi.quantity), 0) AS total_amount,
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS customer_name,
            CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS user
        FROM orders o
        INNER JOIN accounts a ON a.account_id = o.account_id
        INNER JOIN users u ON u.user_id = a.user_id
        LEFT JOIN orderinfos oi ON oi.order_id = o.order_id
        LEFT JOIN items i ON i.item_id = oi.item_id
        GROUP BY o.order_id, o.date_ordered, o.status, u.first_name, u.last_name
        ORDER BY o.order_id DESC
        LIMIT ? OFFSET ?
    `;

    connection.execute(sqlWithTotal, [limit, offset], (err, rows) => {
        if (!err) {
            return res.status(200).json({ success: true, data: rows, limit, offset });
        }

        const msg = (err && err.message) ? err.message.toLowerCase() : '';
        const isMissingTotal = msg.includes("unknown column") && msg.includes("total_amount");
        if (!isMissingTotal) {
            console.error('Orders list error:', err);
            return res.status(500).json({ success: false, message: 'Failed to list orders' });
        }

        // Retry using computed totals
        connection.execute(sqlComputedTotal, [limit, offset], (err2, rows2) => {
            if (err2) {
                console.error('Orders list error (computed total fallback):', err2);
                return res.status(500).json({ success: false, message: 'Failed to list orders' });
            }
            return res.status(200).json({ success: true, data: rows2, limit, offset });
        });
    });
};

/**
 * PUT /api/v1/orders/:id
 * Admin-only: Update order status and/or line quantities; regenerate PDF and send email (Mailtrap)
 * Body: { status?: 'processing'|'shipped'|'completed'|'cancelled', lines?: [{ item_id, quantity }] }
 */
exports.updateOrder = async (req, res) => {
    const orderinfo_id = parseInt(req.params.id);
    const { status, lines } = req.body;

    // Use promise pool for this controller
    const { poolPromise } = require('../config/database');
    const conn = await poolPromise.getConnection();
    try {
        await conn.beginTransaction();

        // Align with DB enum: pending, for_confirm, processing, shipped, completed, cancelled
        const validStatuses = ['pending', 'for_confirm', 'processing', 'shipped', 'completed', 'cancelled'];
        const hasStatus = typeof status === 'string';
        if (hasStatus && !validStatuses.includes(status)) {
            await conn.rollback();
            conn.release();
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }
        const hasLines = Array.isArray(lines) && lines.length > 0;

        // Update status on header if provided
        if (hasStatus) {
            // If moving to 'completed' and not already completed, enforce inventory decrement
            const newStatus = String(status).toLowerCase();
            if (newStatus === 'completed') {
                const [[cur]] = await conn.query('SELECT status FROM orders WHERE order_id = ? FOR UPDATE', [orderinfo_id]);
                const currentStatus = cur ? String(cur.status || '').toLowerCase() : '';
                if (currentStatus !== 'completed') {
                    // Load lines
                    const [linesForInv] = await conn.execute(
                        `SELECT oi.item_id, oi.quantity
                         FROM orderinfos oi
                         WHERE oi.order_id = ?`,
                        [orderinfo_id]
                    );
                    if (!Array.isArray(linesForInv) || linesForInv.length === 0) {
                        await conn.rollback();
                        conn.release();
                        return res.status(400).json({ success: false, message: 'No order lines to complete' });
                    }
                    // Check all inventories (lock)
                    for (const l of linesForInv) {
                        const iid = parseInt(l.item_id);
                        const qty = parseInt(l.quantity) || 0;
                        if (!iid || qty <= 0) {
                            await conn.rollback();
                            conn.release();
                            return res.status(400).json({ success: false, message: 'Invalid line item in order' });
                        }
                        const [invRows] = await conn.execute('SELECT quantity FROM inventories WHERE item_id = ? FOR UPDATE', [iid]);
                        const available = invRows.length ? parseInt(invRows[0].quantity) || 0 : 0;
                        if (available < qty) {
                            await conn.rollback();
                            conn.release();
                            return res.status(409).json({
                                success: false,
                                message: 'Insufficient inventory to complete order',
                                details: { item_id: iid, required: qty, available }
                            });
                        }
                    }
                    // Apply decrements
                    for (const l of linesForInv) {
                        const iid = parseInt(l.item_id);
                        const qty = parseInt(l.quantity) || 0;
                        await conn.execute('UPDATE inventories SET quantity = quantity - ?, updated_at = NOW() WHERE item_id = ?', [qty, iid]);
                    }
                }
            }
            await conn.execute('UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?', [status, orderinfo_id]);
        }

        // Update line quantities if provided
        if (hasLines) {
            for (const l of lines) {
                const qty = parseInt(l.quantity);
                const iid = parseInt(l.item_id);
                if (!iid || !qty || qty < 0) continue;
                await conn.execute('UPDATE orderinfos SET quantity = ? WHERE order_id = ? AND item_id = ?', [qty, orderinfo_id, iid]);
            }
        }

        // Fetch header and lines for PDF/email
        const [hdrRows] = await conn.execute(`
            SELECT
                o.order_id, o.account_id, o.date_ordered, o.status,
                u.first_name, u.last_name, u.email
            FROM orders o
            INNER JOIN accounts a ON a.account_id = o.account_id
            INNER JOIN users u ON u.user_id = a.user_id
            WHERE o.order_id = ?
        `, [orderinfo_id]);

        if (!hdrRows.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const header = hdrRows[0];

        const [lnRows] = await conn.execute(`
            SELECT
                oi.item_id,
                oi.quantity,
                i.item_name,
                i.item_description,
                i.price
            FROM orderinfos oi
            INNER JOIN items i ON i.item_id = oi.item_id
            WHERE oi.order_id = ?
        `, [orderinfo_id]);

        // Compute totals from items table price * quantity
        const lineItems = lnRows.map(r => ({
            item_id: r.item_id,
            item_name: r.item_name,
            item_description: r.item_description,
            quantity: Number(r.quantity) || 0,
            price: Number(r.price) || 0,
            line_total: (Number(r.price) || 0) * (Number(r.quantity) || 0),
        }));
        const subtotal = lineItems.reduce((sum, li) => sum + li.line_total, 0);

        const details = {
            order_id: orderinfo_id,
            date_ordered: header.date_ordered,
            customer_name: `${header.first_name || ''} ${header.last_name || ''}`.trim(),
            customer_email: header.email,
            status: hasStatus ? status : (header.status || 'updated'),
            items: lineItems,
            subtotal
        };

        // Generate receipt and try to send email (attach PDF)
        let pdfResult = { success: false };
        try {
            pdfResult = await generateOrderReceipt(details);
        } catch (e) {
            console.log('PDF generation error:', e);
        }

        try {
            const message = `
                <h2>Order Update</h2>
                <p>Dear ${header.first_name || 'Customer'},</p>
                <p>Your order #${orderinfo_id} has been updated.${hasStatus ? ' Status: ' + status : ''}</p>
                <p><strong>Summary</strong></p>
                <ul>
                    ${lineItems.map(li => `<li>${li.item_name} &times; ${li.quantity} @ ₱${li.price} = ₱${li.line_total.toFixed(2)}</li>`).join('')}
                </ul>
                <p><strong>Total:</strong> ₱${subtotal.toFixed(2)}</p>
                ${pdfResult.success ? '<p>The receipt PDF is attached.</p>' : '<p>We were unable to attach the PDF receipt at this time.</p>'}
            `;
            const emailPayload = {
                email: header.email,
                subject: `Order Update #${orderinfo_id} - Bit & Board`,
                message,
                attachments: pdfResult.success ? [{
                    filename: pdfResult.filename || `order_${orderinfo_id}.pdf`,
                    path: pdfResult.filepath
                }] : undefined
            };
            await sendEmail(emailPayload);
        } catch (e) {
            console.log('Email error:', e);
        }

        await conn.commit();
        conn.release();
        return res.status(200).json({ success: true, message: 'Order updated', order_id: orderinfo_id });
    } catch (err) {
        try { await conn.rollback(); } catch (_) {}
        conn.release();
        console.log('Update order error:', err);
        return res.status(500).json({ success: false, message: 'Update failed', error: err.message || err });
    }

    if (!orderinfo_id) {
        return res.status(400).json({ success: false, message: 'Invalid order id' });
    }

    // Validate inputs
    const validStatuses = ['pending', 'for_confirm', 'processing', 'shipped', 'completed', 'cancelled'];
    const hasStatus = typeof status === 'string';
    if (hasStatus && !validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const hasLines = Array.isArray(lines) && lines.length > 0;

    // Ensure table exists for status if schema lacks it (fallback)
    // connection.execute('ALTER TABLE orderinfos ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT "processing"', () => {});

    connection.beginTransaction(err => {
        if (err) {
            console.log(err);
            return res.status(500).json({ success: false, message: 'Transaction error', error: err });
        }

        const proceedToFetch = () => {
            // Fetch full order (header + lines + user) for PDF/email
            const fetchSql = `
                SELECT
                    o.order_id, o.account_id, o.date_ordered, o.total_amount, o.status,
                    u.first_name, u.last_name, u.email
                FROM orders o
                INNER JOIN accounts a ON a.account_id = o.account_id
                INNER JOIN users u ON u.user_id = a.user_id
                WHERE o.order_id = ?
            `;
            connection.execute(fetchSql, [orderinfo_id], async (hdrErr, hdrRows) => {
                if (hdrErr || hdrRows.length === 0) {
                    return connection.rollback(() => res.status(404).json({ success: false, message: 'Order not found' }));
                }

                const header = hdrRows[0];

                const linesSql = `
                    SELECT oi.item_id, oi.quantity, i.item_name, i.item_description, i.price
                    FROM orderinfos oi
                    INNER JOIN items i ON i.item_id = oi.item_id
                    WHERE oi.order_id = ?
                `;
                connection.execute(linesSql, [orderinfo_id], (lnErr, lnRows) => {
                    if (lnErr) {
                        return connection.rollback(() => res.status(500).json({ success: false, message: 'Failed to load order lines' }));
                    }
    
                    // Build details for PDF
                    const details = {
                        order_id: orderinfo_id,
                        date_ordered: header.date_ordered,
                        customer_name: `${header.first_name || ''} ${header.last_name || ''}`.trim(),
                        customer_email: header.email,
                        status: hasStatus ? status : (header.status || 'updated'),
                        items: lnRows.map(r => ({
                            item_name: r.item_name,
                            item_description: r.item_description,
                            quantity: r.quantity,
                            price: r.price
                        }))
                    };
    
                    // Do not await promise-like calls inside mysql2 callbacks; use plain callbacks
                    generateOrderReceipt(details)
                        .then(pdfResult => {
                            const message = `
                                <h2>Order Update</h2>
                                <p>Dear ${header.first_name || 'Customer'},</p>
                                <p>Your order #${orderinfo_id} has been updated.${hasStatus ? ' Status: ' + status : ''}</p>
                                ${pdfResult.success ? '<p>Updated receipt is attached.</p>' : ''}
                            `;
    
                            const emailPayload = {
                                email: header.email,
                                subject: `Order Update #${orderinfo_id} - Bit & Board`,
                                message
                            };
                            if (pdfResult.success) {
                                emailPayload.attachments = [{
                                    filename: pdfResult.filename,
                                    path: pdfResult.filepath
                                }];
                            }
    
                            // Wrap sendEmail completion into commit to avoid mixing async/await
                            sendEmail(emailPayload)
                                .then(() => {
                                    connection.commit(commitErr => {
                                        if (commitErr) {
                                            return connection.rollback(() => res.status(500).json({ success: false, message: 'Commit failed' }));
                                        }
                                        return res.status(200).json({ success: true, message: 'Order updated and email sent', order_id: orderinfo_id });
                                    });
                                })
                                .catch(() => {
                                    connection.commit(commitErr => {
                                        if (commitErr) {
                                            return connection.rollback(() => res.status(500).json({ success: false, message: 'Commit failed' }));
                                        }
                                        return res.status(200).json({ success: true, message: 'Order updated (email failed to send)', order_id: orderinfo_id });
                                    });
                                });
                        })
                        .catch(() => {
                            connection.commit(commitErr => {
                                if (commitErr) {
                                    return connection.rollback(() => res.status(500).json({ success: false, message: 'Commit failed' }));
                                }
                                return res.status(200).json({ success: true, message: 'Order updated (receipt failed)', order_id: orderinfo_id });
                            });
                        });
                });
            });
        };
        

        const updates = [];

        if (hasStatus) {
            // Update status on orders header table
            const statusSql = 'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?';
            updates.push(new Promise((resolve, reject) => {
                connection.execute(statusSql, [status, orderinfo_id], (e) => e ? reject(e) : resolve());
            }));
        }

        if (hasLines) {
            // Correct table name: update quantity in orderinfos (line items)
            const lineSql = 'UPDATE orderinfos SET quantity = ? WHERE order_id = ? AND item_id = ?';
            lines.forEach(l => {
                const qty = parseInt(l.quantity);
                const iid = parseInt(l.item_id);
                if (!iid || !qty || qty < 0) return; // skip invalid
                updates.push(new Promise((resolve, reject) => {
                    connection.execute(lineSql, [qty, orderinfo_id, iid], (e) => e ? reject(e) : resolve());
                }));
            });
        }

        Promise.all(updates)
            .then(() => proceedToFetch())
            .catch(e => {
                console.log(e);
                return connection.rollback(() => res.status(500).json({ success: false, message: 'Update failed', error: e }));
            });
    });
};

/**
 * PUT /api/v1/orders/:id/status (admin-only)
 * Body: { status: 'pending'|'shipped'|'for_confirm'|'completed'|'cancelled' }
 */
exports.updateOrderStatus = async (req, res) => {
    const orderId = parseInt(req.params.id);
    const { status } = req.body || {};
    const allowed = ['pending','for_confirm','processing','shipped','completed','cancelled'];
    const normalized = String(status || '').toLowerCase();

    if (!orderId || !allowed.includes(normalized)) {
        return res.status(400).json({ success: false, error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const { poolPromise } = require('../config/database');
    const conn = await poolPromise.getConnection();
    try {
        await conn.beginTransaction();

        // Get current status first
        const [curRows] = await conn.execute('SELECT status FROM orders WHERE order_id = ? FOR UPDATE', [orderId]);
        if (!curRows.length) {
            await conn.rollback();
            conn.release();
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        const currentStatus = String(curRows[0].status || '').toLowerCase();

        // If transitioning to completed and was not previously completed, enforce inventory decrement
        const willDecrement = (normalized === 'completed' && currentStatus !== 'completed');

        if (willDecrement) {
            // Load line items
            const [lines] = await conn.execute(
                `SELECT oi.item_id, oi.quantity
                 FROM orderinfos oi
                 WHERE oi.order_id = ?`,
                [orderId]
            );

            if (!lines.length) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({ success: false, error: 'No order lines to complete' });
            }

            // Check availability for all items (lock rows)
            for (const l of lines) {
                const iid = parseInt(l.item_id);
                const qty = parseInt(l.quantity) || 0;
                if (!iid || qty <= 0) {
                    await conn.rollback();
                    conn.release();
                    return res.status(400).json({ success: false, error: 'Invalid line item in order' });
                }
                const [invRows] = await conn.execute('SELECT quantity FROM inventories WHERE item_id = ? FOR UPDATE', [iid]);
                const available = invRows.length ? parseInt(invRows[0].quantity) || 0 : 0;
                if (available < qty) {
                    await conn.rollback();
                    conn.release();
                    return res.status(409).json({
                        success: false,
                        error: 'Insufficient inventory to complete order',
                        details: { item_id: iid, required: qty, available }
                    });
                }
            }

            // Decrement inventory for each item
            for (const l of lines) {
                const iid = parseInt(l.item_id);
                const qty = parseInt(l.quantity) || 0;
                // Ensure inventory row exists; if not, treat as 0 and block above already handled
                await conn.execute('UPDATE inventories SET quantity = quantity - ? , updated_at = NOW() WHERE item_id = ?', [qty, iid]);
            }
        }

        // Update status regardless (after successful decrement if needed)
        await conn.execute('UPDATE orders SET status = ?, updated_at = NOW() WHERE order_id = ?', [normalized, orderId]);

        await conn.commit();
        conn.release();
        return res.status(200).json({ success: true, order_id: orderId, status: normalized, inventory_decremented: !!willDecrement });
    } catch (err) {
        try { await conn.rollback(); } catch (_) {}
        conn.release();
        return res.status(500).json({ success: false, error: 'update order status error', details: err.message || err });
    }
};

/**
 * GET /api/v1/me/orders (auth)
 * Returns order history with line items and can_review flag for each line
 */
exports.getMyOrders = (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const userId = parseInt(req.user.id);

    // Try primary query with total_amount column present; if missing, fallback to computed total
    const sqlWithTotal = `
        SELECT
            o.order_id, o.status, o.date_ordered, o.total_amount,
            oi.item_id, oi.quantity,
            i.item_name, i.item_description,
            img.image_path,
            CASE
                WHEN o.status = 'completed'
                     AND NOT EXISTS (
                        SELECT 1 FROM reviews r
                        JOIN accounts a2 ON a2.account_id = o.account_id
                        WHERE r.account_id = a2.account_id AND r.item_id = oi.item_id
                     )
                THEN 1 ELSE 0
            END AS can_review
        FROM orders o
        JOIN accounts a ON o.account_id = a.account_id
        JOIN users u ON a.user_id = u.user_id
        JOIN orderinfos oi ON o.order_id = oi.order_id
        JOIN items i ON oi.item_id = i.item_id
        LEFT JOIN item_images img ON i.item_id = img.item_id AND img.is_primary = 1
        WHERE u.user_id = ?
        ORDER BY o.date_ordered DESC, o.order_id DESC
    `;

    const sqlComputedTotal = `
        SELECT
            o.order_id, o.status, o.date_ordered,
            COALESCE(SUM(i.price * oi.quantity), 0) AS total_amount,
            oi.item_id, oi.quantity,
            i.item_name, i.item_description,
            img.image_path,
            CASE
                WHEN o.status = 'completed'
                     AND NOT EXISTS (
                        SELECT 1 FROM reviews r
                        JOIN accounts a2 ON a2.account_id = o.account_id
                        WHERE r.account_id = a2.account_id AND r.item_id = oi.item_id
                     )
                THEN 1 ELSE 0
            END AS can_review
        FROM orders o
        JOIN accounts a ON o.account_id = a.account_id
        JOIN users u ON a.user_id = u.user_id
        JOIN orderinfos oi ON o.order_id = oi.order_id
        JOIN items i ON oi.item_id = i.item_id
        LEFT JOIN item_images img ON i.item_id = img.item_id AND img.is_primary = 1
        WHERE u.user_id = ?
        GROUP BY o.order_id, o.status, o.date_ordered, oi.item_id, oi.quantity, i.item_name, i.item_description, img.image_path
        ORDER BY o.date_ordered DESC, o.order_id DESC
    `;

    connection.execute(sqlWithTotal, [userId], (err, rows) => {
        if (!err) {
            return res.status(200).json({ success: true, rows });
        }
        const msg = (err && err.message ? err.message.toLowerCase() : '');
        const missingTotal = msg.includes('unknown column') && msg.includes('total_amount');
        if (!missingTotal) {
            return res.status(500).json({ success: false, error: 'get orders error', details: err });
        }
        // Retry with computed totals
        connection.execute(sqlComputedTotal, [userId], (err2, rows2) => {
            if (err2) {
                return res.status(500).json({ success: false, error: 'get orders error (computed total)', details: err2 });
            }
            return res.status(200).json({ success: true, rows: rows2 });
        });
    });
};

