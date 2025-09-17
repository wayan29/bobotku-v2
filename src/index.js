const { Telegraf, session, Scenes } = require('telegraf');
const axios = require('axios');
const crypto = require('crypto');
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
const { checkStatus, GetAll, checkTovStatus } = require('./middleware/CheckTOV');
const { getAllDigiflazz, checkDigiflazz, checkTransactionStatus: checkDigiStatus } = require('./middleware/Digiflazz');
const { createReceiptImage } = require('./services/receipt');
const DigiFlazz = require('./models/trxdigi');
const TokoV = require('./models/tov');
const TransactionLog = require('./models/transactionLog');
const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toNumeric = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const formatCurrency = (value) => toNumeric(value).toLocaleString('id-ID');

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



// Global help interceptor before scenes so it works anywhere
bot.use(async (ctx, next) => {
    const text = ctx.message?.text;
    if (typeof text === 'string' && text.startsWith('/help')) {
        const message = `
ℹ️ <b>BANTUAN PERINTAH</b>

<b>Umum</b>
• /start — mulai interaksi
• /help — tampilkan bantuan ini

<b>TokoVoucher</b>
• /tov — daftar transaksi terakhir
• /tov <i>&lt;ref_id&gt;</i> — cek status transaksi (alias: <code>/tovcheck</code>)

<b>Digiflazz</b>
• /dg — daftar transaksi
• /dg <i>&lt;ref_id&gt;</i> — cek status transaksi (alias: <code>/digicheck</code>, <code>/digi &lt;ref_id&gt;</code>)

<b>Utilitas</b>
• /pln <i>&lt;no_pelanggan&gt;</i> — validasi nama/ID PLN
• /op <i>&lt;nomor_hp&gt;</i> — deteksi operator seluler
• /transactions — 10 log transaksi terakhir

<i>Beberapa fitur hanya untuk pengguna yang di-whitelist.</i>`;
        try {
            await ctx.replyWithHTML(message);
        } catch (e) {
            console.error('Error sending help:', e);
        }
        return; // stop pipeline so scenes won't override
    }
    return next();
});

bot.use(async (ctx, next) => {
    // Support both message and callback_query updates
    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || ctx.message?.chat?.id;
    if (!chatId) return next();

    try {
        const user = await User.findOne({ chatId });
        if (user && user.isPremium) {
            return next();
        } else {
            if (!user) {
                const newUser = new User({
                    chatId,
                    username: ctx.from?.username,
                });
                await newUser.save();
            }
            // For callback queries, optionally acknowledge to stop spinner
            try { if (ctx.updateType === 'callback_query') await ctx.answerCbQuery('Tidak memiliki akses'); } catch (e) {}
            ctx.reply('Anda Tidak punya Hak pada Bot ini');
        }
    } catch (err) {
        console.error('Error checking premium status:', err);
        ctx.reply('Terjadi kesalahan saat memeriksa status premium Anda.');
    }
});

const checkPln = async (ctx, next) => {
    const text = ctx.message?.text;
    if (typeof text === 'string' && text.startsWith('/pln ')) {
        const noPelanggan = text.slice(5).trim();
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
    else if (text === '/pln') {
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

// Intercept /struk and price input before scenes so it works anywhere
bot.use(async (ctx, next) => {
    const text = ctx.message?.text || '';
    if (typeof text === 'string' && /^\/struk(\s+|$)/i.test(text)) {
        try {
            const parts = text.trim().split(/\s+/);
            if (parts.length === 1) {
                const logs = await TransactionLog.find().sort({ timestamp: -1 }).limit(15);
                if (logs.length === 0) return ctx.replyWithHTML('❌ <b>Tidak ada transaksi</b>');
                let msg = '🧾 <b>REF ID TERAKHIR</b>\n\n';
                logs.forEach((l) => {
                    const statusEmoji = l.status === 'Sukses' ? '✅' : l.status === 'Pending' ? '⏳' : l.status === 'Gagal' ? '❌' : '❓';
                    msg += `${statusEmoji} <code>${l.id}</code> — ${l.provider} — ${new Date(l.timestamp).toLocaleString('id-ID')}\n`;
                });
                msg += '\nKetik /struk &lt;ref_id&gt; untuk cetak struk';
                await ctx.replyWithHTML(msg);
                return; // stop pipeline
            }

            const refId = parts[1];
            // Prefer TransactionLog as the source of truth
            let tlog = await TransactionLog.findOne({ id: refId });
            let provider = tlog?.provider || (refId.startsWith('DF') ? 'digiflazz' : refId.startsWith('TV') ? 'tokovoucher' : null);

            // If no log, try provider collections as fallback
            if (!tlog) {
                const fallback = await DigiFlazz.findOne({ ref_id: refId }) || await TokoV.findOne({ ref_id: refId });
                if (!fallback) {
                    await ctx.replyWithHTML(`❌ <b>Ref ID tidak ditemukan:</b> <code>${refId}</code>`);
                    return;
                }
                provider = fallback.buyer_sku_code ? 'digiflazz' : 'tokovoucher';
            }

            // Auto refresh if pending and we can
            let status = String(tlog?.status || '').toLowerCase();
            if (status === 'pending') {
                await ctx.replyWithHTML(`⏳ <b>Mengecek status transaksi...</b>\n<code>${refId}</code>`);
                try {
                    if (provider === 'tokovoucher') {
                        // Hit TokoVoucher API via existing checker, then update our log
                        const res = await checkTovStatus(refId);
                        if (res && typeof res.status === 'string') {
                            await TransactionLog.updateOne(
                                { id: refId },
                                { $set: {
                                    status: res.status,
                                    serialNumber: res.sn || null,
                                    sellingPrice: typeof res.price === 'number' ? res.price : undefined,
                                    details: `${res.ref_id} (${res.message || '-'})`,
                                    providerTransactionId: res.trx_id || null,
                                    timestamp: new Date(),
                                }}
                            );
                            try { await TokoV.findOneAndUpdate({ ref_id: refId }, { status: res.status, sn: res.sn }, { new: true }); } catch {}
                        }
                    } else if (provider === 'digiflazz') {
                        // Call Digiflazz API directly using info from TransactionLog
                        if (tlog?.buyerSkuCode && tlog?.originalCustomerNo) {
                            const username = process.env.username;
                            const apikey = process.env.apikey;
                            const sign = crypto.createHash('md5').update(username + apikey + refId).digest('hex');
                            const payload = {
                                username,
                                buyer_sku_code: tlog.buyerSkuCode,
                                customer_no: tlog.originalCustomerNo,
                                ref_id: refId,
                                sign,
                            };
                            const { data } = await axios.post('https://api.digiflazz.com/v1/transaction', JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
                            const d = data?.data || {};
                            if (d && typeof d.status === 'string') {
                                await TransactionLog.updateOne(
                                    { id: refId },
                                    { $set: {
                                        status: d.status,
                                        serialNumber: d.sn || null,
                                        sellingPrice: typeof d.price === 'number' ? d.price : undefined,
                                        details: `${d.customer_no || '-'} (${d.message || '-'})`,
                                        providerTransactionId: d.rc || null,
                                        timestamp: new Date(),
                                    }}
                                );
                                try { await DigiFlazz.findOneAndUpdate({ ref_id: refId }, { status: d.status, sn: d.sn }, { new: true }); } catch {}
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Auto status check failed:', e.message);
                }
                tlog = await TransactionLog.findOne({ id: refId });
                status = String(tlog?.status || '').toLowerCase();
            }

            if (status !== 'sukses') {
                const emoji = status === 'pending' ? '⏳' : status === 'gagal' ? '❌' : '❓';
                await ctx.replyWithHTML(`${emoji} <b>Struk hanya untuk transaksi sukses.</b>\nStatus sekarang: <b>${(tlog?.status || '-').toUpperCase()}</b>`);
                return;
            }

            if (!ctx.session) ctx.session = {};
            const productName = tlog?.productName || '-';
            const costPrice = tlog?.costPrice ?? tlog?.sellingPrice ?? 0;
            const costText = formatCurrency(costPrice);

            ctx.session.pendingReceipt = { refId, provider };

            const promptMessage = `💰 <b>Masukkan Harga Jual</b>\n🆔 Ref: <code>${escapeHtml(refId)}</code>\n\n` +
                `📦 <b>Produk:</b> ${escapeHtml(productName)}\n` +
                `💸 <b>Harga Beli:</b> Rp ${costText}\n\n` +
                `Contoh: 12000`;

            await ctx.replyWithHTML(promptMessage);
            return; // stop pipeline
        } catch (err) {
            console.error('struk error:', err);
            await ctx.replyWithHTML(`❌ <b>Error:</b> <code>${err.message}</code>`);
            return;
        }
    }
    // Capture selling price immediately after /struk <refid>
    if (ctx.session?.pendingReceipt) {
        const digits = (text || '').trim().replace(/[^0-9]/g, '');
        if (!digits) {
            await ctx.reply('Masukkan angka harga jual, contoh: 12000');
            return; // stop pipeline
        }
        const sellingPrice = Number(digits);
        const { refId, provider } = ctx.session.pendingReceipt;
        try {
            let tlog = await TransactionLog.findOne({ id: refId });
            if (!tlog) {
                ctx.session.pendingReceipt = null;
                await ctx.reply('Transaksi tidak ditemukan di log');
                return;
            }
            const status = String(tlog.status || '').toLowerCase();
            if (status !== 'sukses') {
                ctx.session.pendingReceipt = null;
                await ctx.reply(`Struk hanya untuk transaksi sukses. Status: ${tlog.status}`);
                return;
            }

            const timeText = new Date().toLocaleString('id-ID', { timeZone: process.env.TZ || 'Asia/Makassar' });
            const tz = (process.env.TZ || 'Asia/Makassar').includes('Makassar') ? 'WITA' : 'WIB';
            const productName = tlog.productName || '-';
            const customerNo = tlog.originalCustomerNo || '-';
            const serialNumber = tlog.serialNumber || '';
            const category = tlog.productCategoryFromProvider || tlog.categoryKey || '-';
            const brand = tlog.productBrandFromProvider || tlog.iconName || '-';

        const buffer = await createReceiptImage({
            provider: provider === 'digiflazz' ? 'Digiflazz' : 'TokoVoucher',
            status: 'Sukses',
            refId,
            timeText,
            tzLabel: tz,
            productName,
            customerNo,
            category,
            brand,
            serialNumber,
            sellingPrice,
        });

            await ctx.replyWithPhoto({ source: buffer }, { caption: `🧾 Struk transaksi\nRef: ${refId}` });
        } catch (e) {
            await ctx.replyWithHTML(`❌ <b>Gagal membuat struk:</b> <code>${e.message}</code>`);
        } finally {
            ctx.session.pendingReceipt = null;
        }
        return; // stop pipeline
    }
    return next();
});

bot.use(stage.middleware());

bot.command('start', (ctx) => ctx.scene.enter(SCENE_KEYS.BOT));

// Command to view transaction logs
bot.command('transactions', async (ctx) => {
    try {
        const logs = await TransactionLog.find().sort({ timestamp: -1 }).limit(10);
        
        if (logs.length === 0) {
            return ctx.replyWithHTML(`📊 <b>LOG TRANSAKSI</b>

❌ <i>Tidak ada log transaksi yang ditemukan</i>`);
        }

        let message = `📊 <b>LOG TRANSAKSI TERAKHIR</b>\n\n`;

        logs.forEach((log, index) => {
            const statusEmoji = log.status === 'Sukses' ? '✅' : 
                               log.status === 'Pending' ? '⏳' : 
                               log.status === 'Gagal' ? '❌' : '❓';
            
            message += `${statusEmoji} <b>${log.status}</b>\n`;
            message += `🆔 ID: <code>${log.id}</code>\n`;
            message += `📦 Produk: ${log.productName}\n`;
            message += `💰 Harga: Rp ${log.sellingPrice.toLocaleString('id-ID')}\n`;
            message += `🏪 Provider: ${log.provider}\n`;
            message += `📅 ${new Date(log.timestamp).toLocaleString('id-ID')}\n\n`;
        });

        message += `📝 Menampilkan 10 transaksi terakhir`;

        await ctx.replyWithHTML(message);
    } catch (error) {
        console.error('Error fetching transaction logs:', error);
        await ctx.replyWithHTML(`❌ <b>ERROR</b>\n\n<code>${error.message}</code>`);
    }
});


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
