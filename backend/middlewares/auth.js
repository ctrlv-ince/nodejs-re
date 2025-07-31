const jwt = require("jsonwebtoken");

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

