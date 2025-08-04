const connection = require('../config/database');
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")

const registerUser = async (req, res) => {
    // Accept optional age and sex in addition to required fields
    let { first_name, last_name, username, phone_number, password, email, age, sex } = req.body;

    // Normalize optional fields
    // Convert empty strings to null, trim strings, coerce age to integer if present
    const toNullIfEmpty = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());
    first_name = toNullIfEmpty(first_name);
    last_name  = toNullIfEmpty(last_name);
    username   = toNullIfEmpty(username);
    phone_number = toNullIfEmpty(phone_number);
    email      = toNullIfEmpty(email);
    sex        = toNullIfEmpty(sex);
    age        = age !== undefined && age !== null && String(age).trim() !== '' ? parseInt(age, 10) : null;

    // Basic backend validation to prevent empty inserts
    if (!first_name || !last_name || !username || !phone_number || !password || !email) {
        return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    // Uniqueness checks for email and username
    try {
        const checkEmailSql = 'SELECT user_id FROM users WHERE email = ? LIMIT 1';
        const checkUsernameSql = 'SELECT account_id FROM accounts WHERE username = ? LIMIT 1';
        // Check email
        await new Promise((resolve, reject) => {
            connection.execute(checkEmailSql, [email], (eErr, eRows) => {
                if (eErr) return reject(eErr);
                if (eRows && eRows.length > 0) {
                    return res.status(409).json({ success: false, field: 'email', message: 'Email is already taken' });
                }
                resolve();
            });
        });
        // Check username
        await new Promise((resolve, reject) => {
            connection.execute(checkUsernameSql, [username], (uErr, uRows) => {
                if (uErr) return reject(uErr);
                if (uRows && uRows.length > 0) {
                    return res.status(409).json({ success: false, field: 'username', message: 'Username is already taken' });
                }
                resolve();
            });
        });
    } catch (precheckErr) {
        console.error(precheckErr);
        // If response already sent due to taken field, return
        if (res.headersSent) return;
        return res.status(500).json({ success: false, message: 'Error during uniqueness checks' });
    }

    const path = require('path');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store a WEB-RELATIVE path (portable) instead of absolute filesystem path
    // Express serves physical storage dir at `/uploads` (see app.js). DB should store without leading slash: "uploads/filename.ext"
    let profileImgPath = 'uploads/default.jpg';
    if (req.file) {
        // Normalize slashes for cross-platform
        const abs = String(req.file.path || '').replace(/\\/g, '/');
        let relPath = null;

        // If multer saved under .../uploads/... or .../images/... map to uploads/...
        const uploadsIdx = abs.lastIndexOf('/uploads/');
        const imagesIdx = abs.lastIndexOf('/images/');
        if (uploadsIdx !== -1) {
            relPath = abs.substring(uploadsIdx + 1); // drop leading slash → uploads/filename.png
        } else if (imagesIdx !== -1) {
            // Map images/* -> uploads/*
            relPath = 'uploads' + abs.substring(imagesIdx + '/images'.length);
            // Ensure no double slashes at join
            relPath = relPath.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
        } else {
            // Fallback: use filename under uploads
            const filename = path.basename(abs || (req.file.originalname || 'file'));
            relPath = 'uploads/' + filename;
        }
        // Final normalize: ensure no leading slash
        profileImgPath = String(relPath).replace(/^\/+/, '');
    }

    const userSql = 'INSERT INTO users (first_name, last_name, phone_number, password, email, age, sex, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())';
    try {
        connection.execute(userSql, [first_name, last_name, phone_number, hashedPassword, email, age, sex], (err, result) => {
            if (err instanceof Error) {
                console.log(err);
                // Handle duplicate email at DB level too (support composite unique names as well)
                if (err.code === 'ER_DUP_ENTRY') {
                    const msg = 'Email is already taken';
                    // Best-effort detection: if dup key references users.email or a key containing 'email'
                    const isEmailDup = /users.*email|email/i.test(err.sqlMessage || '') || /email/i.test(err.message || '');
                    const payload = { success: false, message: msg };
                    if (isEmailDup) payload.field = 'email';
                    return res.status(409).json(payload);
                }
                return res.status(401).json({ success: false, message: 'Registration failed', error: err.message || String(err) });
            }
            const user_id = result.insertId;
            // Always create a standard user account (role is forced to 'user')
            const accountSql = 'INSERT INTO accounts (user_id, username, password, role, profile_img, account_status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())';
            connection.execute(accountSql, [user_id, username, hashedPassword, 'user', profileImgPath, 'active'], (accErr, accResult) => {
                if (accErr instanceof Error) {
                    console.log(accErr);
                    // Handle duplicate username at DB level too
                    if (accErr.code === 'ER_DUP_ENTRY') {
                        const msg = 'Username is already taken';
                        const isUserDup = /accounts.*username|username/i.test(accErr.sqlMessage || '') || /username/i.test(accErr.message || '');
                        const payload = { success: false, message: msg };
                        if (isUserDup) payload.field = 'username';
                        return res.status(409).json(payload);
                    }
                    return res.status(401).json({ success: false, message: 'Registration failed', error: accErr.message || String(accErr) });
                }
                return res.status(200).json({ success: true, user_id, account_id: accResult.insertId });
            });
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({ success: false, message: 'Server error during registration' });
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    const sql = 'SELECT user_id, first_name, last_name, email, password FROM users WHERE email = ?';
    connection.execute(sql, [email], async (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({
                success: false,
                message: 'Database error during login'
            });
        }
        
        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        
        if (!match) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }
        
        // Generate short-lived access JWT
        const tokenPayload = {
            id: user.user_id,
            email: user.email
        };
        const accessToken = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
        );

        // Generate long-lived refresh token
        const crypto = require('crypto');
        const rawRefresh = crypto.randomBytes(32).toString('base64url'); // raw token returned to client
        const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
        const refreshHash = await bcrypt.hash(rawRefresh, bcryptRounds);
        const refreshTtlDays = parseInt(process.env.REFRESH_TOKEN_DAYS || '30', 10);

        // Log generation 
        try {
            const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || 'unknown';
            const userAgent = req.headers['user-agent'] || 'unknown';
            console.log('[Auth] Refresh token GENERATED at login', {
                user_id: user.user_id,
                email: user.email,
                ip,
                userAgent,
                refresh_token: rawRefresh
            });
        } catch (logErr) {
            // Never break login flow due to logging issues
            console.error('Failed to log refresh token generation (login):', logErr);
        }

        const updateTokenSql = 'UPDATE users SET remember_token = ?, updated_at = NOW() WHERE user_id = ?';
        connection.execute(updateTokenSql, [refreshHash, user.user_id], (tokenErr) => {
            if (tokenErr) {
                console.error('Error storing remember_token hash:', tokenErr);
                // proceed; login can still work but refresh will fail until hash is stored
            }
        });

        // Remove password from response
        delete user.password;

        // Return both tokens
        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email
            },
            token: accessToken,
            refresh_token: rawRefresh,
            refresh_expires_in_days: refreshTtlDays
        });
    });
};

// POST /api/v1/auth/refresh
// Body: { refresh_token } 
// Returns: new short-lived access token
const refreshToken = async (req, res) => {
    try {
        const { refresh_token } = req.body || {};
        if (!refresh_token) {
            return res.status(400).json({ success: false, message: 'refresh_token is required' });
        }
        const crypto = require('crypto');
        const provided = String(refresh_token);

        // Find user row first (we need hashed remember_token to compare)
        const sql = 'SELECT user_id, email, remember_token FROM users WHERE remember_token IS NOT NULL';
        connection.execute(sql, [], async (err, rows) => {
            if (err) {
                console.error('DB error on refresh select:', err);
                return res.status(500).json({ success: false, message: 'Database error' });
            }

            // Since remember_token is a hash, we need to compare against all candidates.
            let matchedUser = null;
            for (const row of rows) {
                const ok = await bcrypt.compare(provided, row.remember_token);
                if (ok) {
                    matchedUser = row;
                    break;
                }
            }

            if (!matchedUser) {
                return res.status(401).json({ success: false, message: 'Invalid refresh token' });
            }

            // Issue new short-lived access token
            const accessPayload = { id: matchedUser.user_id, email: matchedUser.email };
            const accessToken = jwt.sign(
                accessPayload,
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
            );

            // Rotate refresh token (recommended): issue a new random token and replace hash
            const rawRefresh = crypto.randomBytes(32).toString('base64url');
            const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
            const newHash = await bcrypt.hash(rawRefresh, bcryptRounds);

            // Log rotation with context (includes raw token as requested)
            try {
                const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || 'unknown';
                const userAgent = req.headers['user-agent'] || 'unknown';
                console.log('[Auth] Refresh token ROTATED at refresh', {
                    user_id: matchedUser.user_id,
                    email: matchedUser.email,
                    ip,
                    userAgent,
                    refresh_token: rawRefresh
                });
            } catch (logErr) {
                console.error('Failed to log refresh token rotation:', logErr);
            }

            const upd = 'UPDATE users SET remember_token = ?, updated_at = NOW() WHERE user_id = ?';
            connection.execute(upd, [newHash, matchedUser.user_id], (uErr) => {
                if (uErr) {
                    console.error('Failed to rotate remember_token:', uErr);
                    // Still return access token; client can attempt refresh again with old token until rotation succeeds
                }
                return res.status(200).json({
                    success: true,
                    token: accessToken,
                    refresh_token: rawRefresh
                });
            });
        });
    } catch (e) {
        console.error('refreshToken error:', e);
        return res.status(500).json({ success: false, message: 'Failed to refresh token' });
    }
};

// POST /api/v1/logout
// Requires Authorization: Bearer <access> and clears users.remember_token to revoke refresh capability
const logoutUser = (req, res) => {
    try {
        const userId = (req.user && req.user.id) ? req.user.id : null;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const sql = 'UPDATE users SET remember_token = NULL, updated_at = NOW() WHERE user_id = ?';
        connection.execute(sql, [userId], (err) => {
            if (err) {
                console.error('Logout DB error:', err);
                return res.status(500).json({ success: false, message: 'Failed to logout' });
            }
            return res.status(200).json({ success: true, message: 'Logged out' });
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: 'Logout failed' });
    }
};

const updateUser = (req, res) => {
    // Align profile update with users + accounts tables and avoid undefined bind params
    try {
        // Prefer authenticated user id
        const authId = (req.user && req.user.id) ? parseInt(req.user.id) : null;
        const bodyUserId = req.body.userId ? parseInt(req.body.userId) : null;
        const userId = authId || bodyUserId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Map incoming fields from profile form (joined users + accounts)
        const first_name = req.body.first_name ?? null;
        const last_name = req.body.last_name ?? null;
        const phone_number = req.body.phone_number ?? null;
        const age = req.body.age ?? null;
        const sex = req.body.sex ?? null;

        // Optional image path for accounts.profile_img
        const imagePath = req.file ? req.file.path.replace(/\\/g, "/") : null;

        // Update users table (null-safe bindings)
        const userUpdateSql = `
            UPDATE users
            SET first_name = ?, last_name = ?, phone_number = ?, age = ?, sex = ?, updated_at = NOW()
            WHERE user_id = ?
        `;
        const userParams = [first_name, last_name, phone_number, age, sex, userId];

        connection.execute(userUpdateSql, userParams, (userErr) => {
            if (userErr) {
                console.log(userErr);
                return res.status(500).json({ success: false, message: 'Failed to update user', error: userErr });
            }

            // If an image was uploaded, update accounts.profile_img with a safe, web-served path.
            // Ensure we never pass undefined in bindings.
            if (typeof imagePath === 'string' && imagePath.length > 0) {
                // Normalize to forward slashes and strip absolute prefix to store relative path
                // Example: "C:\Users\Lance\Documents\nodejs\backend\images\file.png" -> "uploads/file.png"
                let normalized = imagePath.replace(/\\\\/g, '/').replace(/\\/g, '/');
                // If backend serves images from /uploads mapped to backend/images, convert path
                const imagesDirIndex = normalized.lastIndexOf('/images/');
                if (imagesDirIndex !== -1) {
                    normalized = 'uploads' + normalized.substring(imagesDirIndex + '/images'.length);
                }
                const safePath = normalized || null;

                const accountSql = `
                    UPDATE accounts
                    SET profile_img = ?, updated_at = NOW()
                    WHERE user_id = ?
                `;
                const accountParams = [safePath, userId];

                connection.execute(accountSql, accountParams, (accErr) => {
                    if (accErr) {
                        console.log(accErr);
                        // Return success for user fields; include warning for image
                        return res.status(200).json({ success: true, message: 'Profile updated (image not saved)', image_error: accErr.message || accErr.code });
                    }
                    return res.status(200).json({ success: true, message: 'Profile updated' });
                });
            } else {
                // No image provided; finish with user update only
                return res.status(200).json({ success: true, message: 'Profile updated' });
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Server error updating profile' });
    }
};

const deactivateUser = (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const sql = 'UPDATE users SET deleted_at = ? WHERE email = ?';
    const timestamp = new Date();

    connection.execute(sql, [timestamp, email], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error deactivating user', details: err });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json({
            success: true,
            message: 'User deactivated successfully',
            email,
            deleted_at: timestamp
        });
    });
};

const getUserProfile = (req, res) => {
    const userId = req.user.id; // From auth middleware
    
    const sql = `
        SELECT
            u.user_id, u.first_name, u.last_name, u.email, u.phone_number, u.age, u.sex,
            a.account_id, a.username, a.role, a.profile_img, a.account_status
        FROM users u
        LEFT JOIN accounts a ON u.user_id = a.user_id
        WHERE u.user_id = ?
    `;
    
    connection.execute(sql, [userId], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({
                success: false,
                message: 'Database error'
            });
        }
        
        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const user = results[0];
        return res.status(200).json({
            success: true,
            user: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone_number: user.phone_number,
                age: user.age,
                sex: user.sex,
                account_id: user.account_id,
                username: user.username,
                role: user.role,
                profile_img: user.profile_img,
                account_status: user.account_status
            }
        });
    });
};

module.exports = { registerUser, loginUser, updateUser, deactivateUser, getUserProfile, refreshToken, logoutUser };