const mysql = require('mysql2');

require('dotenv').config();

/**
 * Export both callback and promise interfaces.
 * - connection: legacy callback API (existing controllers)
 * - poolPromise: mysql2 promise pool for async/await flows
 */
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Promise pool for controllers that want async/await without mixing styles
const poolPromise = mysql
  .createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  })
  .promise();

module.exports = connection;
module.exports.poolPromise = poolPromise;