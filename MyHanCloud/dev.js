const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const port = 3001;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'view', ''))
})