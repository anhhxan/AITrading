const {Client} = require('pg');
const fs = require('fs');

const dbPass = 'Dung6789@123'; // wait, I shouldn't hardcode it if I can read it, but I don't know the source DB password easily. 
// Let's check .env.local or source_inventory.js
