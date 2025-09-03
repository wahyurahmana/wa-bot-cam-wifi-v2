require('@dotenvx/dotenvx').config()
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createHmac } = require('node:crypto');
const knex = require('knex')(require('./knexfile').development)

const client = new Client({
  puppeteer: {
    headless: true,
    args : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
  }
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message_create', async (msg) => {
  const mobilePhoneHash = createHmac('sha256', process.env.HASH_KEY).update(msg.from.split('@')[0]).digest('hex');

  // Cek Apakah User Dengan Nomor WA Sudah Terdaftar?
  const employee = await knex('employee').where({
    mobile_phone : mobilePhoneHash
  })
  console.log(employee);
})

client.on('qr', qr => {
  qrcode.generate(qr, {small : true});
});

client.initialize();
