const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk } = require('../services/keyboard');
const { buildPinKeyboard, promptText } = require('../services/pinpad');
const { Markup } = require('telegraf');
const { createTrx, getRefId, numberWithCommas } = require('../services/http_toko');
const { inquireFFNickname } = require('../services/ffNickname');
const TokoV = require('../models/tov');
const TransactionLog = require('../models/transactionLog');

const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const formatCurrency = (amount) => {
    if (!hasValue(amount)) return 'N/A';
    const numeric = Number(amount);
    if (Number.isNaN(numeric)) return 'N/A';
    return numberWithCommas(numeric);
};

// Function to create transaction log in new format
async function createTransactionLog(transactionData, user, source = "bot", ctx = null) {
    try {
        // Parse timestamp
        const timestamp = new Date();
        
        // Extract data from transaction
        const {
            status,
            message,
            sn,
            ref_id,
            trx_id,
            produk,
            sisa_saldo,
            price
        } = transactionData;
        
        // Create transaction log in new format
        const logData = {
            id: ref_id,
            productName: produk || "Unknown Product",
            details: `${ref_id} (${message})`,
            costPrice: price || 0, // TOV doesn't provide cost price, using selling price
            sellingPrice: price || 0,
            status: status,
            timestamp: timestamp,
            buyerSkuCode: produk || "Unknown Product",
            originalCustomerNo: ref_id,
            productCategoryFromProvider: (ctx?.session?.selectedCategory?.nama) || "Unknown Category",
            productBrandFromProvider: (ctx?.session?.selectedBrand?.nama) || "Unknown Brand",
            provider: "tokovoucher",
            transactedBy: user,
            source: source,
            categoryKey: (ctx?.session?.selectedCategory?.nama) || "Unknown Category",
            iconName: (ctx?.session?.selectedBrand?.nama) || "Unknown Brand",
            providerTransactionId: trx_id,
            transactionYear: timestamp.getFullYear(),
            transactionMonth: timestamp.getMonth() + 1,
            transactionDayOfMonth: timestamp.getDate(),
            transactionDayOfWeek: timestamp.getDay(),
            transactionHour: timestamp.getHours(),
            failureReason: status === "gagal" ? message : null,
            serialNumber: sn || null
        };
        
        // Save to new transaction log collection
        const transactionLog = new TransactionLog(logData);
        await transactionLog.save();
        
        return transactionLog;
    } catch (error) {
        console.error("Error creating transaction log:", error);
        // Don't throw error to avoid breaking main flow
        return null;
    }
}

const botMenu = new telegraf.Scenes.BaseScene(SCENE_KEYS.OPSI2);
botMenu.enter(async (ctx) => {
    const BOT = ctx.session.selectedBot;

    if (BOT === 'TokoVoucher') {
        const keyboardaja = showKeyboardChunk(["🚫 Kosong", "⬅️ Kembali"], 1);
        const message = `━ 🎮 *SERVER ID* 🎮 ━

📝 *Masukkan Server ID:*
• Khusus game tertentu
• Tekan 🚫 jika tidak perlu

━━━━━━━━━━`;
        await ctx.replyWithMarkdown(message, keyboardaja);
        ctx.session.tovStep = 'awaiting_serverid';
    }
});

botMenu.on('text', async (ctx) => {
    const pesan = ctx.message.text;

    if (pesan === "⬅️ Kembali") {
        ctx.scene.enter(SCENE_KEYS.PRICE);
        return;
    }

    const BOT = ctx.session.selectedBot;
    if (BOT === 'TokoVoucher') {
        const step = ctx.session.tovStep || 'awaiting_serverid';

        if (step === 'awaiting_serverid') {
            ctx.session.serverId = pesan !== "🚫 Kosong" ? pesan.trim() : "";

            // Clean, mobile-friendly confirmation + optional Free Fire nickname validation
            const produk = ctx.session.selectedProduct || {};
            const harga = produk.price || 0;
            let detail = `✅ <b>KONFIRMASI PESANAN</b>\n\n`;
            detail += `📦 <b>Produk:</b> ${produk.nama_produk || '-'}\n`;
            detail += `💰 <b>Harga:</b> Rp ${numberWithCommas(Number(harga))}\n`;
            detail += `👤 <b>Tujuan:</b> <code>${ctx.session.nomorTujuan}</code>\n`;
            if (ctx.session.serverId) {
                detail += `🎮 <b>Server ID:</b> <code>${ctx.session.serverId}</code>\n`;
            }
            if (!ctx.session.refId) {
                try { ctx.session.refId = await getRefId(); } catch (e) { ctx.session.refId = null; }
            }
            if (ctx.session.refId) {
                detail += `🆔 <b>Ref ID:</b> <code>${ctx.session.refId}</code>\n`;
            }

            // Free Fire nickname verification (based on product name)
            const name = (produk.nama_produk || '').toString().toLowerCase();
            if (name.includes('free fire')) {
                try {
                    const res = await inquireFFNickname(ctx.session.nomorTujuan);
                    if (res?.isSuccess && res?.nickname) {
                        ctx.session.ffNickname = res.nickname;
                        detail += `\n🕹️ <b>Verifikasi Free Fire</b>\n`;
                        detail += `• Nickname: <b>${res.nickname}</b>\n`;
                    } else {
                        ctx.session.ffNickname = null;
                        detail += `\n⚠️ <b>Verifikasi Free Fire</b>\n`;
                        detail += `• Status: <i>${res?.message || 'Tidak tervalidasi'}</i>\n`;
                        detail += `• Transaksi dapat dilanjutkan (server verifikasi mungkin gangguan)\n`;
                    }
                } catch (e) {
                    ctx.session.ffNickname = null;
                    detail += `\n⚠️ <b>Verifikasi Free Fire</b>\n`;
                    detail += `• Status: <i>Gangguan</i>\n`;
                    detail += `• Pesan: <i>${e.message}</i>\n`;
                    detail += `• Transaksi dapat dilanjutkan\n`;
                }
            }

            detail += `\nApakah data sudah sesuai?`;

            await ctx.replyWithHTML(detail, showKeyboardChunk(["✅ Setuju", "❌ Batal", "⬅️ Kembali"], 3));
            ctx.session.tovStep = 'awaiting_confirm';
            return;
        }

        if (step === 'awaiting_confirm') {
            if (/^✅ Setuju$/i.test(pesan) || /^ya$/i.test(pesan)) {
                // Langsung proses transaksi tanpa PIN
                const ref_id = ctx.session.refId || await getRefId();
                const NomorTujuan = ctx.session.nomorTujuan;
                const codeList = ctx.session.codeList;
                const server_id = ctx.session.serverId || "";

                const trx_id = await createTrx(ref_id, codeList, NomorTujuan, server_id);

                const username = ctx.message.from.username || ctx.message.from.id.toString();
                await createTransactionLog(trx_id, username, "bot", ctx);

                let statusEmoji;
                let statusText;
                switch (trx_id.status) {
                    case 'sukses':
                        statusEmoji = '✅';
                        statusText = 'Sukses';
                        break;
                    case 'pending':
                        statusEmoji = '⏳';
                        statusText = 'Pending';
                        break;
                    case 'gagal':
                        statusEmoji = '❌';
                        statusText = 'Gagal';
                        break;
                    default:
                        statusEmoji = '⚠️';
                        statusText = 'Error';
                        break;
                }

                const summaryLines = [];
                const produk = ctx.session.selectedProduct?.nama_produk;
                if (hasValue(produk)) {
                    summaryLines.push(`📦 <b>Produk:</b> ${escapeHtml(produk)}`);
                }

                summaryLines.push(`🆔 <b>Ref ID:</b> <code>${escapeHtml(trx_id.ref_id || ref_id || '-')}</code>`);
                summaryLines.push(`🧾 <b>Trx ID:</b> <code>${escapeHtml(trx_id.trx_id || '-')}</code>`);
                summaryLines.push(`📱 <b>Tujuan:</b> <code>${escapeHtml(ctx.session.nomorTujuan || '-')}</code>`);
                if (hasValue(server_id)) {
                    summaryLines.push(`🎮 <b>Server:</b> <code>${escapeHtml(server_id)}</code>`);
                }
                summaryLines.push(`💰 <b>Harga:</b> Rp ${formatCurrency(trx_id.price)}`);
                if (hasValue(trx_id.sisa_saldo)) {
                    summaryLines.push(`💼 <b>Saldo Akhir:</b> Rp ${formatCurrency(trx_id.sisa_saldo)}`);
                }
                if (hasValue(trx_id.sn)) {
                    summaryLines.push(`🎯 <b>Serial Number:</b> <code>${escapeHtml(trx_id.sn)}</code>`);
                }
                summaryLines.push(`ℹ️ <b>Pesan:</b> ${escapeHtml(hasValue(trx_id.message) ? trx_id.message : 'Tidak ada pesan')}`);

                const message = `${statusEmoji} <b>Transaksi ${statusText}</b>\n\n${summaryLines.join('\n')}`;

                await ctx.replyWithHTML(message);

                if (trx_id.status === 'sukses' || trx_id.status === 'gagal') {
                    await createTransactionLog(trx_id, username, "web", ctx);
                }

                ctx.session = {};
                ctx.session.selectedBot = 'TokoVoucher';
                ctx.scene.enter(SCENE_KEYS.CATEGORY);
                return;
            }

            // Cancel flow
            await ctx.reply('Transaksi dibatalkan. Kembali ke kategori.');
            ctx.session = {};
            ctx.session.selectedBot = 'TokoVoucher';
            ctx.scene.enter(SCENE_KEYS.CATEGORY);
            return;
        }

        // Tidak ada langkah PIN lagi
    }
});

// Tidak ada keypad PIN lagi untuk TokoVoucher

module.exports = botMenu;
