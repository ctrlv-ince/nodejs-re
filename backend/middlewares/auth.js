const jwt = require("jsonwebtoken");
const connection = require("../config/database");

exports.isAuthenticatedUser = (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: 'Access token required. Please login first.'
            });
        }

        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token format. Please login again.'
            });
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check token expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }

        // Add user info to request object (not body)
        req.user = {
            id: decoded.id,
            iat: decoded.iat,
            exp: decoded.exp
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please login again.'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: 'Authentication error. Please try again.'
        });
    }
};

// Require that the authenticated user's account is active
exports.requireActive = (req, res, next) => {
    try {
        const user = req.user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const sql = 'SELECT account_status FROM accounts WHERE user_id = ? LIMIT 1';
        connection.execute(sql, [user.id], (err, rows) => {
            if (err) {
                console.error('Account status check error:', err);
                return res.status(500).json({ success: false, message: 'Database error checking account status' });
            }
            if (!rows || rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Account not found' });
            }
            if (rows[0].account_status !== 'active') {
                return res.status(403).json({ success: false, message: 'Account is inactive' });
            }
            next();
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Error verifying account status' });
    }
};

