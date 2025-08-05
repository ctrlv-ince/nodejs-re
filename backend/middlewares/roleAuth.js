const jwt = require('jsonwebtoken');
const connection = require('../config/database');

// Middleware to check if user has required role
exports.requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            const authHeader = req.header('Authorization');
            if (!authHeader) {
                return res.status(401).json({ message: 'Access token required' });
            }

            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).json({ message: 'Access token required' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check token expiration
            if (decoded.exp && decoded.exp < Date.now() / 1000) {
                return res.status(401).json({ message: 'Token expired' });
            }

            // Get user role from database
            const sql = 'SELECT a.role, a.account_status FROM accounts a WHERE a.user_id = ?';
            connection.execute(sql, [decoded.id], (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ message: 'Database error' });
                }

                if (!results.length) {
                    return res.status(403).json({ message: 'User not found' });
                }

                const user = results[0];
                
                // Check if account is active
                if (user.account_status !== 'active') {
                    return res.status(403).json({ message: 'Account is inactive' });
                }

                // Check if user has required role
                if (!roles.includes(user.role)) {
                    return res.status(403).json({ 
                        message: `Access denied. Required role: ${roles.join(' or ')}` 
                    });
                }

                // Add user info to request
                req.user = { 
                    id: decoded.id, 
                    role: user.role,
                    status: user.account_status
                };
                next();
            });
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Invalid token' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Token expired' });
            }
            console.error('Auth error:', error);
            return res.status(500).json({ message: 'Authentication error' });
        }
    };
};

// Middleware to check if user is admin
exports.requireAdmin = exports.requireRole(['admin']);

// Middleware to check if user is admin or the resource owner
exports.requireAdminOrOwner = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'Access token required' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'Access token required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const sql = 'SELECT a.role, a.account_status FROM accounts a WHERE a.user_id = ?';
        connection.execute(sql, [decoded.id], (err, results) => {
            if (err || !results.length) {
                return res.status(403).json({ message: 'Access denied' });
            }

            const user = results[0];
            const safeBody = req.body || {};
            const resourceUserId = req.params.userId || safeBody.userId || req.params.id;

            // If admin, allow immediately
            if (user.role === 'admin') {
                req.user = {
                    id: decoded.id,
                    role: user.role,
                    status: user.account_status
                };
                return next();
            }

            // Special-case: deleting a review (/reviews/:review_id)
            if (req.params && req.params.review_id) {
                const reviewId = parseInt(req.params.review_id);
                if (!reviewId) {
                    return res.status(400).json({ message: 'Invalid review id' });
                }
                // Map token user -> account and compare to review's account_id
                const mapSql = 'SELECT account_id FROM accounts WHERE user_id = ?';
                connection.execute(mapSql, [decoded.id], (mErr, mRows) => {
                    if (mErr || !mRows || mRows.length === 0) {
                        return res.status(403).json({ message: 'Access denied' });
                    }
                    const accountId = mRows[0].account_id;
                    const revSql = 'SELECT account_id FROM reviews WHERE review_id = ?';
                    connection.execute(revSql, [reviewId], (rErr, rRows) => {
                        if (rErr || !rRows || rRows.length === 0) {
                            return res.status(404).json({ message: 'Review not found' });
                        }
                        const reviewAccountId = rRows[0].account_id;
                        if (String(reviewAccountId) === String(accountId)) {
                            req.user = {
                                id: decoded.id,
                                role: user.role,
                                status: user.account_status
                            };
                            return next();
                        }
                        return res.status(403).json({ message: 'Access denied' });
                    });
                });
                return;
            }
            if (resourceUserId && String(decoded.id) === String(resourceUserId)) {
                req.user = {
                    id: decoded.id,
                    role: user.role,
                    status: user.account_status
                };
                return next();
            }

            return res.status(403).json({ message: 'Access denied' });
        });
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};