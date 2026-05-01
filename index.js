require('@dotenvx/dotenvx').config()
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createHmac } = require('node:crypto');

const REQUIRED_ENV_NAMES = ['DATABASE_NAME', 'DATABASE_USER', 'DATABASE_PASSWORD', 'HASH_KEY'];
const REGISTRATION_FORMAT = 'badge:\nfullname:\ndepartment:\ncompany:\ncamp:\n';
const VOUCHER_MESSAGE = "Akun Berlaku 5jam/hari dengan sinyal WiFi 'Camp WiFi', Jika melebihi batas waktu yang telah ditentukan maka akan muncul pesan pada saat login 'no valid profile found'.";

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} belum diatur di environment.`);
  }

  if (value.startsWith('encrypted:')) {
    throw new Error(`${name} masih terenkripsi. Jalankan dengan DOTENV_PRIVATE_KEY yang sesuai.`);
  }

  return value;
}

REQUIRED_ENV_NAMES.forEach(getRequiredEnv);

const HASH_KEY = getRequiredEnv('HASH_KEY');
const knex = require('knex')(require('./knexfile').development)

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args : [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--disable-crash-reporter',
      '--disable-crashpad',
      '--no-zygote'
    ]
  }
});

function hashValue(value) {
  return createHmac('sha256', HASH_KEY).update(String(value)).digest('hex');
}

function parseRegistrationMessage(body) {
  const data = {};
  body.split('\n').forEach((line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();

    if (['badge', 'fullname', 'department', 'company', 'camp'].includes(key)) {
      data[key] = value;
    }
  });

  return data;
}

function isValidRegistration(data) {
  return data.badge && !Number.isNaN(Number(data.badge));
}

function formatVoucherReply(voucher) {
  return `username ${voucher.id_login} password ${voucher.password}\n${VOUCHER_MESSAGE}`;
}

function shouldIgnoreMessage(msg) {
  if (!msg.from || typeof msg.from !== 'string') {
    return true;
  }

  return (
    msg.fromMe ||
    !msg.body ||
    msg.from === 'status@broadcast' ||
    msg.from.endsWith('@g.us') ||
    msg.from.endsWith('@broadcast')
  );
}

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('authenticated', () => {
  console.log('Client authenticated!');
});

client.on('auth_failure', (message) => {
  console.error('Authentication failed:', message);
});

client.on('disconnected', (reason) => {
  console.log('Client disconnected:', reason);
});

client.on('message', async (msg) => {
  try {
    if (shouldIgnoreMessage(msg)) {
      return;
    }

    await knex.transaction(async (trx) => {
      const mobilePhoneHash = hashValue(msg.from.split('@')[0]);
      // Cek apakah user dengan nomor WA sudah terdaftar.
      const employee = await trx('employee').where({ mobile_phone: mobilePhoneHash }).first();

      if (employee) {
        const ready = await trx('vouchers').where({ voucher_id: employee.voucher_id }).first();

        if (!ready) {
          await msg.reply('Data voucher Anda tidak ditemukan. Silakan hubungi admin.');
          return;
        }

        await msg.reply(`Anda Telah Terdaftar Dengan Username ${ready.id_login} Dan Password ${ready.password}\n${VOUCHER_MESSAGE}`);
        return;
      }

      // Proses pendaftaran akun.
      const registration = parseRegistrationMessage(msg.body);

      if (!isValidRegistration(registration)) {
        await msg.reply(REGISTRATION_FORMAT);
        return;
      }

      const availableVoucher = await trx('vouchers')
        .where({ available: true })
        .orderBy('voucher_id', 'asc')
        .forUpdate()
        .skipLocked()
        .first();

      if (!availableVoucher) {
        await msg.reply('Maaf Voucher Lagi Habis, Kami Akan Generate Dulu Ya Kak, Kami Akan Balas Secepatnya. Terima Kasih Kak');
        return;
      }

      const insert = {
        badge: hashValue(registration.badge),
        voucher_id: availableVoucher.voucher_id,
        fullname: registration.fullname,
        department: registration.department,
        company: registration.company,
        camp: registration.camp,
        mobile_phone: mobilePhoneHash,
        timestamp: msg.timestamp
      };

      await trx('vouchers').where({ voucher_id: availableVoucher.voucher_id }).update({ available: false });
      await trx('employee').insert(insert);
      await msg.reply(formatVoucherReply(availableVoucher));
      console.log('sukses daftar');
    })
  } catch (error) {
      console.log(error, '<<< error');

      if (error.code === '23505') {
        await msg.reply('Badge sudah terdaftar. Jika Anda belum menerima voucher, silakan hubungi admin.');
        return;
      }

      await msg.reply('Maaf, sedang ada gangguan pada sistem. Silakan coba lagi beberapa saat lagi atau hubungi admin.');
  }
})

client.on('qr', qr => {
  qrcode.generate(qr, {small : true});
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  await client.destroy();
  await knex.destroy();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    console.error('Failed to shutdown cleanly:', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    console.error('Failed to shutdown cleanly:', error);
    process.exit(1);
  });
});

client.initialize().catch((error) => {
  console.error('Failed to initialize WhatsApp client:', error);
  knex.destroy().finally(() => process.exit(1));
});
