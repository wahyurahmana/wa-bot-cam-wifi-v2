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

client.on('message', async (msg) => {
  try {
    await knex.transaction(async (trx) => {
      try {
        const mobilePhoneHash = createHmac('sha256', process.env.HASH_KEY).update(msg.from.split('@')[0]).digest('hex');
        // Cek Apakah User Dengan Nomor WA Sudah Terdaftar?
        const employee = await trx('employee').where({
          mobile_phone : mobilePhoneHash
        })
      
        if(employee.length <= 0){
          // Proses Pendaftaran Akun
          const insert = {
            badge : ''
          };
          const data = msg.body.toLocaleLowerCase().split('\n');
          data.forEach((e) => {
            if(e.includes('badge') && e.split(':').length > 1){
              insert['badge'] = e.split(':')[1].trim();
            }
            if(e.includes('fullname') && e.split(':').length > 1){
              insert['fullname'] = e.split(':')[1].trim();
            }
            if(e.includes('department') && e.split(':').length > 1){
              insert['department'] = e.split(':')[1].trim();
            }
            if(e.includes('company') && e.split(':').length > 1){
              insert['company'] = e.split(':')[1].trim();
            }
            if(e.includes('camp') && e.split(':').length > 1){
              insert['camp'] = e.split(':')[1].trim();
            }
          })
          const availableVoucher = await trx('vouchers').where({available : true});
          if (availableVoucher.length <= 0) {
            msg.reply('Maaf Voucher Lagi Habis, Kami Akan Generate Dulu Ya Kak, Kami Akan Balas Secepatnya. Terima Kasih Kak')
          } else {
            insert['voucher_id'] = availableVoucher[0].voucher_id;
            insert['mobile_phone'] = mobilePhoneHash;
            insert['timestamp'] = msg.timestamp;
            if(!insert['badge'] || isNaN(insert['badge'])){
              msg.reply('badge:\nfullname:\ndepartment:\ncompany:\ncamp:\n');
            }else{
              insert['badge'] = createHmac('sha256', process.env.HASH_KEY).update(insert['badge']).digest('hex');
              await trx('vouchers').where({voucher_id : availableVoucher[0].voucher_id}).update({available : false});
              await trx('employee').insert(insert);
              const wifi = await trx('vouchers').where({voucher_id : availableVoucher[0].voucher_id});
              msg.reply(`username ${wifi[0].id_login} password ${wifi[0].password}\nAkun Berlaku 5jam/hari dengan sinyal WiFi 'Camp WiFi', Jika melebihi batas waktu yang telah ditentukan maka akan muncul pesan pada saat login 'no valid profile found'.`);
              console.log('sukses daftar');
              await trx.commit();
            }
          }
        }else{
          const ready = await trx('vouchers').where({voucher_id : employee[0].voucher_id});
          msg.reply(`Anda Telah Terdaftar Dengan Username ${ready[0].id_login} Dan Password ${ready[0].password}\nAkun Berlaku 5jam/hari dengan sinyal WiFi 'Camp WiFi', Jika melebihi batas waktu yang telah ditentukan maka akan muncul pesan pada saat login 'no valid profile found'.`);
        }
      } catch (error) {
        console.log(error, '<<< Error Didalam Transaction');
        await trx.rollback();
      }
    })
  } catch (error) {
      console.log(error, '<<< error');
  }
})

client.on('qr', qr => {
  qrcode.generate(qr, {small : true});
});

client.initialize();
