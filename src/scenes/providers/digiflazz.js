const { performTransaction } = require('../../services/http');
const DigiFlazz = require('../../models/trxdigi');
const TransactionLog = require('../../models/transactionLog');
const { showKeyboardChunk } = require('../../services/keyboard');
const { buildPinKeyboard, promptText } = require('../../services/pinpad');
const { Markup } = require('telegraf');
const { numberWithCommas } = require('../../utils/formatters');
const { inquireFFNickname } = require('../../services/ffNickname');
const { generateRefId } = require('../../utils/refid');
const SCENE_KEYS = require('../../constants/sceneKeys');
const pln = require('../../services/plncuy');

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

const buildTransactionSummary = (proses, ctx, statusEmoji, statusText) => {
    const productName = ctx.session.selectedProduct?.product_name;
    const lines = [];

    if (hasValue(productName)) {
        lines.push(`📦 <b>Produk:</b> ${escapeHtml(productName)}`);
    }

    lines.push(`🆔 <b>Ref ID:</b> <code>${escapeHtml(proses.ref_id || ctx.session.refId || '-')}</code>`);
    lines.push(`📱 <b>Nomor:</b> <code>${escapeHtml(proses.customer_no || ctx.session.customerNo || '-')}</code>`);
    if (hasValue(ctx.session.operatorInfo?.name)) {
        const operator = ctx.session.operatorInfo;
        const prefixText = hasValue(operator.prefix) ? ` (prefix ${escapeHtml(operator.prefix)})` : '';
        lines.push(`📡 <b>Operator:</b> ${operator.emoji || ''} <b>${escapeHtml(operator.name)}</b>${prefixText}`.trim());
    }
    lines.push(`🏷️ <b>SKU:</b> <code>${escapeHtml(proses.buyer_sku_code || ctx.session.sku || '-')}</code>`);
    lines.push(`💰 <b>Harga:</b> Rp ${formatCurrency(proses.price || ctx.session.selectedProduct?.price)}`);

    if (hasValue(proses.buyer_last_saldo)) {
        lines.push(`💼 <b>Saldo Akhir:</b> Rp ${formatCurrency(proses.buyer_last_saldo)}`);
    }

    if (hasValue(proses.sn)) {
        lines.push(`🎮 <b>Serial Number:</b> <code>${escapeHtml(proses.sn)}</code>`);
    }

    if (hasValue(proses.message)) {
        lines.push(`ℹ️ <b>Pesan:</b> ${escapeHtml(proses.message)}`);
    }

    return `${statusEmoji} <b>Transaksi ${statusText}</b>\n\n${lines.join('\n')}`;
};

const OPERATOR_DATA = [
    {
        name: 'Telkomsel',
        emoji: '🔴',
        prefixes: ['0811', '0812', '0813', '0821', '0822', '0823', '0852', '0853', '0851']
    },
    {
        name: 'Indosat Ooredoo',
        emoji: '🟡',
        prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858']
    },
    {
        name: 'XL Axiata',
        emoji: '🔵',
        prefixes: ['0859', '0877', '0878', '0817', '0818', '0819']
    },
    {
        name: '3 (Tri)',
        emoji: '⚫',
        prefixes: ['0898', '0899', '0895', '0896', '0897']
    },
    {
        name: 'Smartfren',
        emoji: '🟣',
        prefixes: ['0889', '0881', '0882', '0883', '0886', '0887', '0888', '0884', '0885']
    },
    {
        name: 'Axis',
        emoji: '🟢',
        prefixes: ['0832', '0833', '0838', '0831']
    },
];

const detectOperatorInfo = (normalizedNumber) => {
    if (!hasValue(normalizedNumber)) return null;
    const prefix = normalizedNumber.slice(0, 4);
    if (!prefix) return null;

    const match = OPERATOR_DATA.find((operator) => operator.prefixes.includes(prefix));
    if (!match) return null;

    return {
        name: match.name,
        emoji: match.emoji,
        prefix,
    };
};

const normalizeIndonesianPhoneNumber = (input) => {
    if (!hasValue(input)) {
        return { normalized: '', operator: null };
    }

    const digitsOnly = String(input).replace(/\D/g, '');
    if (!digitsOnly) {
        return { normalized: '', operator: null };
    }

    let normalized = digitsOnly;
    if (normalized.startsWith('62')) {
        normalized = normalized.slice(2);
    }
    if (!normalized.startsWith('0')) {
        normalized = `0${normalized}`;
    }

    const operator = detectOperatorInfo(normalized);
    return { normalized, operator };
};

const handleDigiflazzEnter = async (ctx, selectedProduct) => {
    const List = selectedProduct;
    const refId = await generateRefId('DF');
    ctx.session.sku = List.buyer_sku_code;
    ctx.session.refId = refId;
    ctx.session.selectedProduct = List;
    ctx.session.digiStep = 'awaiting_number';

    const statusPenjual = List.seller_product_status
        ? '✅ Penjual: <b>Aktif</b>'
        : '❌ Penjual: <b>Gangguan</b>';
    const statusPembeli = List.buyer_product_status
        ? '✅ Pembeli: <b>Aktif</b>'
        : '❌ Pembeli: <b>Gangguan</b>';

    let detail = `📦 <b>Detail Produk</b>\n\n`;
    detail += `🛒 <b>Nama:</b> ${escapeHtml(selectedProduct.product_name)}\n`;
    detail += `💰 <b>Harga:</b> Rp ${numberWithCommas(List.price)}\n`;
    detail += `🏷️ <b>SKU:</b> <code>${escapeHtml(List.buyer_sku_code)}</code>\n`;
    detail += `🏢 <b>Penjual:</b> ${escapeHtml(List.seller_name)}\n`;
    detail += `📊 <b>Status Produk</b>\n${statusPenjual}\n${statusPembeli}\n\n`;
    detail += `🆔 <b>Ref ID:</b> <code>${escapeHtml(refId)}</code>`;

    await ctx.replyWithHTML(detail);
    await ctx.reply('Masukkan nomor pelanggan:', showKeyboardChunk(["⬅️ Kembali"]));
};

// Function to create transaction log in new format
async function createTransactionLog(transactionData, user, source = "bot", productData = {}) {
    try {
        // Parse timestamp
        const timestamp = new Date();
        
        // Extract data from transaction
        const {
            ref_id,
            customer_no,
            buyer_sku_code,
            message,
            status,
            rc,
            sn,
            buyer_last_saldo,
            price,
            tele,
            wa
        } = transactionData;
        
        // Create transaction log in new format
        const logData = {
            id: ref_id,
            productName: productData.product_name || "Unknown Product",
            details: `${customer_no} (${message})`,
            costPrice: productData.price || 0,
            sellingPrice: price || 0,
            status: status,
            timestamp: timestamp,
            buyerSkuCode: buyer_sku_code,
            originalCustomerNo: customer_no,
            productCategoryFromProvider: productData.category || "Unknown Category",
            productBrandFromProvider: productData.brand || "Unknown Brand",
            provider: "digiflazz",
            transactedBy: user,
            source: source,
            categoryKey: productData.category || "Unknown Category",
            iconName: productData.brand || "Unknown Brand",
            providerTransactionId: null,
            transactionYear: timestamp.getFullYear(),
            transactionMonth: timestamp.getMonth() + 1,
            transactionDayOfMonth: timestamp.getDate(),
            transactionDayOfWeek: timestamp.getDay(),
            transactionHour: timestamp.getHours(),
            failureReason: status === "Gagal" ? message : null,
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

const handleDigiflazzMessage = async (ctx, message) => {
    // Allow user to go back
    if (message === "⬅️ Kembali") {
        ctx.scene.enter(SCENE_KEYS.PRODUCT);
        return;
    }

    const step = ctx.session.digiStep || 'awaiting_number';

    if (step === 'awaiting_number') {
        const rawInput = message.trim();
        const p = ctx.session.selectedProduct || {};
        const categoryText = (ctx.session.selectedCategory || p.category || '').toString().toLowerCase();
        const isPulsaData = categoryText.includes('pulsa') || categoryText.includes('data');

        let normalizedNumber = rawInput;
        let operatorInfo = null;
        if (isPulsaData) {
            const { normalized, operator } = normalizeIndonesianPhoneNumber(rawInput);
            if (hasValue(normalized)) {
                normalizedNumber = normalized;
            }
            operatorInfo = operator;
        }

        ctx.session.customerNoOriginal = rawInput;
        ctx.session.customerNo = normalizedNumber;
        ctx.session.operatorInfo = operatorInfo;

        const isPLN = categoryText.includes('pln');

        let verifyBlock = '';
        if (isPLN) {
            try {
                const v = await pln(ctx.session.customerNo);
                if (v && v.status === 'Sukses') {
                    ctx.session.plnVerification = {
                        name: v.name,
                        meter_no: v.meter_no,
                        subscriber_id: v.subscriber_id,
                        segment_power: v.segment_power,
                    };
                    verifyBlock += `🔌 <b>Verifikasi PLN</b>\n`;
                    verifyBlock += `• Nama: <b>${v.name}</b>\n`;
                    verifyBlock += `• No. Meter: <code>${v.meter_no}</code>\n`;
                    verifyBlock += `• ID Pelanggan: <code>${v.subscriber_id}</code>\n`;
                    verifyBlock += `• Daya: ${v.segment_power}\n`;
                } else {
                    // Lanjutkan transaksi dengan peringatan jika verifikasi gagal
                    ctx.session.plnVerification = null;
                    verifyBlock += `⚠️ <b>Verifikasi PLN</b>\n`;
                    verifyBlock += `• Status: <i>Gagal</i> — ${v?.message || 'Data tidak valid'}\n`;
                    verifyBlock += `• Transaksi dapat dilanjutkan, nomor belum tervalidasi\n`;
                }
            } catch (err) {
                // Lanjutkan transaksi dengan peringatan jika server verifikasi gangguan
                ctx.session.plnVerification = null;
                verifyBlock += `⚠️ <b>Verifikasi PLN</b>\n`;
                verifyBlock += `• Status: <i>Gangguan server</i>\n`;
                verifyBlock += `• Pesan: <i>${err.message || 'Tidak diketahui'}</i>\n`;
                verifyBlock += `• Transaksi dapat dilanjutkan, nomor belum tervalidasi\n`;
            }
        }

        // Free Fire nickname verification (based on product name)
        const name = (p.product_name || '').toString().toLowerCase();
        if (name.includes('free fire')) {
            try {
                const res = await inquireFFNickname(ctx.session.customerNo);
                if (res?.isSuccess && res?.nickname) {
                    ctx.session.ffNickname = res.nickname;
                    verifyBlock += `\n🕹️ <b>Verifikasi Free Fire</b>\n`;
                    verifyBlock += `• Nickname: <b>${res.nickname}</b>\n`;
                } else {
                    ctx.session.ffNickname = null;
                    verifyBlock += `\n⚠️ <b>Verifikasi Free Fire</b>\n`;
                    verifyBlock += `• Status: <i>${res?.message || 'Tidak tervalidasi'}</i>\n`;
                    verifyBlock += `• Transaksi dapat dilanjutkan (server verifikasi mungkin gangguan)\n`;
                }
            } catch (e) {
                ctx.session.ffNickname = null;
                verifyBlock += `\n⚠️ <b>Verifikasi Free Fire</b>\n`;
                verifyBlock += `• Status: <i>Gangguan</i>\n`;
                verifyBlock += `• Pesan: <i>${e.message}</i>\n`;
                verifyBlock += `• Transaksi dapat dilanjutkan\n`;
            }
        }

        // Clean, mobile-friendly confirmation block (HTML)
        let confirmText = `✅ <b>KONFIRMASI PESANAN</b>\n\n`;
        confirmText += `📦 <b>Produk:</b> ${p.product_name || '-'}\n`;
        confirmText += `💰 <b>Harga:</b> Rp ${numberWithCommas(p.price || 0)}\n`;
        confirmText += `👤 <b>Pelanggan:</b> <code>${escapeHtml(ctx.session.customerNo)}</code>\n`;
        if (hasValue(ctx.session.operatorInfo?.name)) {
            const operator = ctx.session.operatorInfo;
            const prefixText = hasValue(operator.prefix) ? ` (prefix ${escapeHtml(operator.prefix)})` : '';
            confirmText += `📡 <b>Operator:</b> ${operator.emoji || ''} <b>${escapeHtml(operator.name)}</b>${prefixText}\n`;
        }
        if (verifyBlock) confirmText += `\n${verifyBlock}`;
        confirmText += `\n🆔 <b>Ref ID:</b> <code>${ctx.session.refId}</code>\n\n`;
        confirmText += `Apakah data sudah sesuai?`;

        await ctx.replyWithHTML(confirmText, showKeyboardChunk(["✅ Setuju", "❌ Batal", "⬅️ Kembali"], 3));
        ctx.session.digiStep = 'awaiting_confirm';
        return;
    }

    if (step === 'awaiting_confirm') {
        if (/^✅ Setuju$/i.test(message) || /^ya$/i.test(message)) {
            // Proses langsung tanpa PIN
            const proses = await performTransaction(ctx.session.refId, ctx.session.sku, ctx.session.customerNo);

            let statusEmoji;
            let statusText;

            if (proses.status === "Gagal") {
                statusEmoji = '❌';
                statusText = 'Gagal';
            } else if (proses.status === "Sukses") {
                statusEmoji = '✅';
                statusText = 'Sukses';
            } else if (proses.status === "Pending") {
                statusEmoji = '⏳';
                statusText = 'Pending';
            } else {
                statusEmoji = '⚠️';
                statusText = 'Tidak Diketahui';
            }

            const text = buildTransactionSummary(proses, ctx, statusEmoji, statusText);

            const username = ctx.message.from.username || ctx.message.from.id.toString();
            await createTransactionLog(proses, username, "bot", ctx.session.selectedProduct);

            await ctx.replyWithHTML(text);
            ctx.session = {};
            ctx.session.selectedBot = `Digiflazz`;
            ctx.scene.enter(SCENE_KEYS.CATEGORY);
            return;
        }

        // Cancel flow
        await ctx.reply('Transaksi dibatalkan. Kembali ke kategori.');
        ctx.session = {};
        ctx.session.selectedBot = 'Digiflazz';
        ctx.scene.enter(SCENE_KEYS.CATEGORY);
        return;
    }

    // Tidak ada langkah 'awaiting_pin' lagi
};

module.exports = {
    handleDigiflazzEnter,
    handleDigiflazzMessage,
    // Handle inline PIN keypad actions while in PRICE scene for Digiflazz
    async handleDigiflazzPinAction(ctx, action) {
        if (ctx.session.digiStep !== 'awaiting_pin') {
            await ctx.answerCbQuery();
            return;
        }

        ctx.session.pinValue = ctx.session.pinValue || '';

        if (action.startsWith('add:')) {
            const digit = action.split(':')[1];
            if (/^\d$/.test(digit)) {
                // Limit to a sane length (e.g., 6)
                const maxLen = Number(process.env.PIN_MAXLEN || 6);
                if (ctx.session.pinValue.length >= maxLen) {
                    await ctx.answerCbQuery(`Maksimal PIN ${maxLen} digit`, { show_alert: false });
                    return;
                }
                ctx.session.pinValue += digit;
            }
            await ctx.editMessageText(promptText(ctx.session.pinValue), { parse_mode: 'HTML', ...buildPinKeyboard() });
            await ctx.answerCbQuery();
            return;
        }

        if (action === 'del') {
            if (!ctx.session.pinValue || ctx.session.pinValue.length === 0) {
                await ctx.answerCbQuery('Tidak ada yang dihapus');
                return;
            }
            ctx.session.pinValue = ctx.session.pinValue.slice(0, -1);
            await ctx.editMessageText(promptText(ctx.session.pinValue), { parse_mode: 'HTML', ...buildPinKeyboard() });
            await ctx.answerCbQuery();
            return;
        }

        if (action === 'cancel') {
            await ctx.answerCbQuery('Dibatalkan');
            try { await ctx.deleteMessage(); } catch (e) {}
            await ctx.reply('Transaksi dibatalkan. Kembali ke kategori.');
            ctx.session = {};
            ctx.session.selectedBot = 'Digiflazz';
            ctx.scene.enter(SCENE_KEYS.CATEGORY);
            return;
        }

        if (action === 'ok') {
            const expectedPin = process.env.PIN_TRANSAKSI || process.env.TX_PIN || process.env.PIN;
            if (!expectedPin) {
                await ctx.answerCbQuery('PIN belum dikonfigurasi', { show_alert: true });
                return;
            }
            if (String(ctx.session.pinValue).trim() !== String(expectedPin).trim()) {
                await ctx.answerCbQuery('PIN salah', { show_alert: true });
                return;
            }

            // Hide keypad message
            try { await ctx.deleteMessage(); } catch (e) {}

            // Proceed with transaction
            const proses = await performTransaction(ctx.session.refId, ctx.session.sku, ctx.session.customerNo);
            let statusEmoji;
            let statusText;

            if (proses.status === "Gagal") {
                statusEmoji = '❌';
                statusText = 'Gagal';
            } else if (proses.status === "Sukses") {
                statusEmoji = '✅';
                statusText = 'Sukses';
            } else if (proses.status === "Pending") {
                statusEmoji = '⏳';
                statusText = 'Pending';
            } else {
                statusEmoji = '⚠️';
                statusText = 'Tidak Diketahui';
            }

            const text = buildTransactionSummary(proses, ctx, statusEmoji, statusText);

            const username = ctx.callbackQuery.from.username || ctx.callbackQuery.from.id.toString();
            await createTransactionLog(proses, username, "bot", ctx.session.selectedProduct);

            await ctx.replyWithHTML(text);
            ctx.session = {};
            ctx.session.selectedBot = `Digiflazz`;
            ctx.scene.enter(SCENE_KEYS.CATEGORY);
            return;
        }

        await ctx.answerCbQuery();
    }
};
