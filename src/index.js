const { Telegraf, session, Scenes } = require('telegraf');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Environment variables loaded silently
const botMenu = require('./scenes/botMenu');
const selectCategory = require('./scenes/selectCategory');
const selectBrand = require('./scenes/selectBrand');
const selectProduct = require('./scenes/selectProduct');
const productDetail = require('./scenes/productDetail');
const enterDestinationNumber = require('./scenes/enterDestinationNumber');
const enterServerId = require('./scenes/enterServerId');
const SCENE_KEYS = require('./constants/sceneKeys');
const pln = require('./services/plncuy');
const checkOperator = require('./middleware/Checkop');
const User = require("./models/mongoose");
const mongoose = require('mongoose');
const { checkStatus, GetAll } = require('./middleware/CheckTOV');
const { getAllDigiflazz, checkDigiflazz } = require('./middleware/Digiflazz');


const dbURL = process.env.MONGO_URL;
mongoose.connect(dbURL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

const listStage = [
    botMenu,
    selectCategory,
    selectBrand,
    selectProduct,
    productDetail,
    enterDestinationNumber,
    enterServerId
]

const bot = new Telegraf(process.env.TOKEN);
const stage = new Scenes.Stage(listStage);



bot.use(async (ctx, next) => {
    const chatId = ctx.message.chat.id;

    try {
        const user = await User.findOne({ chatId });
        if (user && user.isPremium) {
            
            return next();
        } else {
            
            if (!user) {
                const newUser = new User({
                    chatId,
                    username: ctx.message.from.username
                });
                await newUser.save();
            }
            
            ctx.reply('Anda Tidak punya Hak pada Bot ini');
        }
    } catch (err) {
        console.error('Error checking premium status:', err);
        ctx.reply('Terjadi kesalahan saat memeriksa status premium Anda.');
    }
});

const checkPln = async (ctx, next) => {
    if (ctx.message.text.startsWith('/pln ')) {
        const noPelanggan = ctx.message.text.slice(5).trim();
        try {
            const data = await pln(noPelanggan);

            // Jika token valid (sukses)
            if (data && data.status === "Sukses") {
                const message = `✅ *Validasi Nama Berhasil*\n\n` +
                    `*Nama*: ${data.name}\n` +
                    `*No Meter*: ${data.meter_no}\n` +
                    `*ID Pelanggan*: ${data.subscriber_id}\n` +
                    `*Daya*: ${data.segment_power}\n\n` +
                    `_Terima kasih telah menggunakan layanan kami._`;
                ctx.reply(message, { parse_mode: 'Markdown' });
            } 
            // Jika token tidak valid (gagal)
            else if (data && data.status === "Gagal") {
                const message = `❌ *Validasi Nama Gagal*\n\n` +
                    `*Code*: ${data.message || "Kesalahan tidak diketahui"}\n` +
                    `*Status*: ${data.status}\n` +
                    `*No Pelanggan*: ${data.customer_no}\n\n` +
                    `_Periksa kembali nomor pelanggan Anda atau coba beberapa saat lagi._`;
                ctx.reply(message, { parse_mode: 'Markdown' });
            } 
            // Jika respons tidak lengkap
            else {
                ctx.reply("❗ Respons data tidak valid. Silakan coba lagi.");
            }
        } catch (error) {
            ctx.reply('⚠️ Terjadi kesalahan saat mengambil data. Silakan coba lagi nanti.');
            console.error("Error:", error.message);
        }
    } 
    else if (ctx.message.text === '/pln') {
        ctx.reply('❓ *Mohon masukkan nomor pelanggan setelah perintah /pln*', { parse_mode: 'Markdown' });
    } 
    else {
        next();
    }
};

bot.use(checkStatus);
bot.use(checkDigiflazz);
bot.use(GetAll);
bot.use(getAllDigiflazz);
bot.use(checkPln);
bot.use(checkOperator);


bot.use(session());
bot.use(stage.middleware());

bot.command('start', (ctx) => ctx.scene.enter(SCENE_KEYS.BOT));

bot.on('text', (ctx) => {
    ctx.scene.enter(SCENE_KEYS.BOT);

    
});



if (process.env.NODE_ENV === 'production') {
    bot.launch({
        webhook: {
            domain: process.env.HEROKU_URL,
            port: process.env.PORT
        }
    });
} else {
    bot.launch();
}
