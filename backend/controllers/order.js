const connection = require('../config/database');
const sendEmail = require('../utils/sendEmail');
const { generateOrderReceipt } = require('../utils/generatePDF');

exports.createOrder = (req, res, next) => {
    console.log(req.body,)
    const { cart, user } = req.body;
    console.log(cart, user.id)

    const dateOrdered = new Date();
    const dateShipped = new Date();

    connection.beginTransaction(err => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Transaction error', details: err });
        }

        // Get customer_id from userId
        // const sql = 'SELECT customer_id FROM users WHERE user_id = ?';
        const sql = 'SELECT u.id as user_id, u.email FROM users u WHERE u.id = ?';
        connection.execute(sql, [parseInt(user.id)], (err, results) => {
            if (err || results.length === 0) {
                return connection.rollback(() => {
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Customer not found', details: err });
                    }
                });
            }

            // const customer_id = results[0].customer_id;
            const { user_id, email } = results[0]

            // Insert into orderinfo
            const orderInfoSql = 'INSERT INTO orderinfos (user_id, date_placed, date_shipped) VALUES (?, ?, ?)';
            connection.execute(orderInfoSql, [user_id, dateOrdered, dateShipped], (err, result) => {
                if (err) {
                    return connection.rollback(() => {
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Error inserting orderinfo', details: err });
                        }
                    });
                }

                const order_id = result.insertId;

                // Insert each cart item into orderline
                const orderLineSql = 'INSERT INTO orders (orderinfo_id, item_id, quantity) VALUES (?, ?, ?)';
                let errorOccurred = false;
                let completed = 0;

                if (cart.length === 0) {
                    return connection.rollback(() => {
                        if (!res.headersSent) {
                            res.status(400).json({ error: 'Cart is empty' });
                        }
                    });
                }

                cart.forEach((item, idx) => {
                    connection.execute(orderLineSql, [order_id, item.item_id, item.quantity], (err) => {
                        if (err && !errorOccurred) {
                            errorOccurred = true;
                            return connection.rollback(() => {
                                if (!res.headersSent) {
                                    res.status(500).json({ error: 'Error inserting orderline', details: err });
                                }
                            });
                        }


                        completed++;

                        if (completed === cart.length && !errorOccurred) {
                            connection.commit(async err => {
                                if (err) {
                                    return connection.rollback(() => {
                                        if (!res.headersSent) {
                                            res.status(500).json({ error: 'Commit error', details: err });
                                        }
                                    });
                                }

                                // Generate PDF receipt
                                try {
                                    const orderDetails = {
                                        order_id: order_id,
                                        date_ordered: dateOrdered,
                                        customer_name: `${results[0].first_name || ''} ${results[0].last_name || ''}`.trim(),
                                        customer_email: email,
                                        status: 'pending',
                                        items: cart.map(item => ({
                                            item_name: item.item_name || 'Unknown Item',
                                            item_description: item.item_description || 'No description',
                                            quantity: item.quantity,
                                            price: item.price || 0
                                        }))
                                    };

                                    const pdfResult = await generateOrderReceipt(orderDetails);
                                    
                                    if (pdfResult.success) {
                                        // Send email with PDF attachment
                                        const message = `
                                            <h2>Order Confirmation</h2>
                                            <p>Dear Customer,</p>
                                            <p>Thank you for your order! Your order #${order_id} is being processed.</p>
                                            <p><strong>Order Details:</strong></p>
                                            <ul>
                                                <li>Order ID: #${order_id}</li>
                                                <li>Date: ${dateOrdered.toLocaleDateString()}</li>
                                                <li>Status: Processing</li>
                                            </ul>
                                            <p>Please find your detailed receipt attached to this email.</p>
                                            <p>We will notify you once your order is ready for shipping.</p>
                                            <br>
                                            <p>Best regards,<br>Bit & Board Team</p>
                                        `;

                                        await sendEmail({
                                            email,
                                            subject: `Order Confirmation #${order_id} - Bit & Board`,
                                            message,
                                            attachments: [{
                                                filename: pdfResult.filename,
                                                path: pdfResult.filepath
                                            }]
                                        });
                                    } else {
                                        // Send email without attachment if PDF generation fails
                                        const message = `
                                            <h2>Order Confirmation</h2>
                                            <p>Dear Customer,</p>
                                            <p>Thank you for your order! Your order #${order_id} is being processed.</p>
                                            <p>We will send you a detailed receipt shortly.</p>
                                            <br>
                                            <p>Best regards,<br>Bit & Board Team</p>
                                        `;

                                        await sendEmail({
                                            email,
                                            subject: `Order Confirmation #${order_id} - Bit & Board`,
                                            message
                                        });
                                    }
                                } catch (emailErr) {
                                    console.log('Email/PDF error:', emailErr);
                                    // Don't fail the order if email fails
                                }

                                if (!res.headersSent) {
                                    res.status(201).json({
                                        success: true,
                                        order_id,
                                        dateOrdered,
                                        message: 'transaction complete',

                                        cart
                                    });
                                }
                            });
                        }
                    });
                });
            });
        });
    });
}

