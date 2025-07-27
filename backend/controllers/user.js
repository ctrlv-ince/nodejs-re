const connection = require('../config/database');
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")

const registerUser = async (req, res) => {
    const { first_name, last_name, username, phone_number, password, email, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    let profileImgPath = 'default.jpg';
    if (req.file) {
        profileImgPath = req.file.path.replace(/\\/g, '/');
    }
    const userSql = 'INSERT INTO users (first_name, last_name, phone_number, password, email) VALUES (?, ?, ?, ?, ?)';
    try {
        connection.execute(userSql, [first_name, last_name, phone_number, hashedPassword, email], (err, result) => {
            if (err instanceof Error) {
                console.log(err);
                return res.status(401).json({ error: err });
            }
            const user_id = result.insertId;
            // Create account for the user
            const accountSql = 'INSERT INTO accounts (user_id, username, password, role, profile_img, account_status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())';
            connection.execute(accountSql, [user_id, username, hashedPassword, role || 'user', profileImgPath, 'active'], (accErr, accResult) => {
                if (accErr instanceof Error) {
                    console.log(accErr);
                    return res.status(401).json({ error: accErr });
                }
                return res.status(200).json({ success: true, user_id, account_id: accResult.insertId });
            });
        });
    } catch (error) {
        console.log(error)
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT user_id, first_name, last_name, email, password FROM users WHERE email = ?';
    connection.execute(sql, [email], async (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: 'Error logging in', details: err });
        }
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        const user = results[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        delete user.password;
        const token = jwt.sign({ id: user.user_id }, process.env.JWT_SECRET);
        return res.status(200).json({ success: "welcome back", user, token });
    });
};

const updateUser = (req, res) => {
    // {
    //   "name": "steve",
    //   "email": "steve@gmail.com",
    //   "password": "password"
    // }
    console.log(req.body, req.file)
    const { title, fname, lname, addressline, town, zipcode, phone, userId, } = req.body;

    if (req.file) {
        image = req.file.path.replace(/\\/g, "/");
    }
    //     INSERT INTO users(user_id, username, email)
    //   VALUES(1, 'john_doe', 'john@example.com')
    // ON DUPLICATE KEY UPDATE email = 'john@example.com';
    const userSql = `
  INSERT INTO customer 
    (title, fname, lname, addressline, town, zipcode, phone, image_path, user_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON DUPLICATE KEY UPDATE 
    title = VALUES(title),
    fname = VALUES(fname),
    lname = VALUES(lname),
    addressline = VALUES(addressline),
    town = VALUES(town),
    zipcode = VALUES(zipcode),
    phone = VALUES(phone),
    image_path = VALUES(image_path)`;
    const params = [title, fname, lname, addressline, town, zipcode, phone, image, userId];

    try {
        connection.execute(userSql, params, (err, result) => {
            if (err instanceof Error) {
                console.log(err);

                return res.status(401).json({
                    error: err
                });
            }

            return res.status(200).json({
                success: true,
                result
            })
        });
    } catch (error) {
        console.log(error)
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

module.exports = { registerUser, loginUser, updateUser, deactivateUser };