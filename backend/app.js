const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');

const items = require('./routes/item');
const users = require('./routes/user')
const orders = require('./routes/order')
const dashboard = require('./routes/dashboard');
const accounts = require('./routes/account');
const carts = require('./routes/cart');
const groups = require('./routes/group');
const reviews = require('./routes/review');
const passwords = require('./routes/password');

app.use(cors())

// app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve uploaded assets (ensure this matches multer destination)
app.use('/uploads', express.static(path.join(__dirname, 'images')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/home.html'));
});

app.use('/api/v1', items);
app.use('/api/v1', users);
app.use('/api/v1', orders);
app.use('/api/v1', dashboard);
app.use('/api/v1', accounts);
app.use('/api/v1', carts);
app.use('/api/v1', groups);
app.use('/api/v1', reviews);
app.use('/api/v1', passwords);

module.exports = app