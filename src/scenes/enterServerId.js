const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk } = require('../services/keyboard');
const { buildPinKeyboard, promptText } = require('../services/pinpad');
const { Markup } = require('telegraf');
const { createTrx, getRefId, numberWithCommas } = require('../services/http_toko');
const { inquireFFNickname } = require('../services/ffNickname');
const checkOpMiddleware = require('../middleware/Checkop');
const detectOperator = checkOpMiddleware?.checkOperator;
const { inquireMobileLegendsNickname } = require('../services/mlNickname');
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

const TELEGRAM_SOURCE = 'telegram_bot';
const OPERATOR_CATEGORY_IDS = new Set(['4', '5', '18']);

const normalizeStatus = (rawStatus) => {
    const status = (rawStatus || '').toString().toLowerCase();
    if (status === 'sukses') return 'Sukses';
    if (status === 'pending') return 'Pending';
    if (status === 'gagal' || status === 'failed') return 'Gagal';
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Pending';
};

const toNumeric = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const buildTimestamp = () => {
    const now = new Date();
    return { date: now, iso: now.toISOString() };
};

// Function to create transaction log in new format
async function createTransactionLog(transactionData, user, source = TELEGRAM_SOURCE, ctx = null) {
    try {
        const { date: timestamp, iso: timestampIso } = buildTimestamp();
        
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
        
        const existing = await TransactionLog.findOne({ id: ref_id }).lean().exec();
        const normalizedStatus = normalizeStatus(status);
        const parsedPrice = toNumeric(price);
        const productName = produk || existing?.productName || "Unknown Product";
        const categoryName = (ctx?.session?.selectedCategory?.nama) || existing?.productCategoryFromProvider || "Unknown Category";
        const brandName = (ctx?.session?.selectedBrand?.nama) || existing?.productBrandFromProvider || productName;
        const customerTarget = (ctx?.session?.nomorTujuan && ctx.session.nomorTujuan.trim()) || existing?.originalCustomerNo || ref_id;
        const infoParts = [];

        const operatorInfo = ctx?.session?.operatorInfo;
        if (operatorInfo?.operator) {
            const operatorName = operatorInfo.operator.toString().toUpperCase();
            infoParts.push(operatorName);
        }

        if (ctx?.session?.ffNickname) {
            infoParts.push(`FF: ${ctx.session.ffNickname}`);
        }

        if (ctx?.session?.mlNickname) {
            const country = ctx?.session?.mlCountry ? ` (${ctx.session.mlCountry})` : '';
            infoParts.push(`ML: ${ctx.session.mlNickname}${country}`);
        }

        const combinedDetails = infoParts.length > 0
            ? `${customerTarget} (${infoParts.join(' | ')})`
            : customerTarget;

        const logData = {
            id: ref_id,
            productName,
            details: combinedDetails,
            costPrice: parsedPrice,
            sellingPrice: existing?.sellingPrice ?? parsedPrice,
            status: normalizedStatus,
            timestamp: timestampIso,
            buyerSkuCode: produk || existing?.buyerSkuCode || productName,
            originalCustomerNo: customerTarget,
            productCategoryFromProvider: categoryName,
            productBrandFromProvider: brandName,
            provider: "tokovoucher",
            transactedBy: user || existing?.transactedBy || 'telegram_user',
            source: source || existing?.source || TELEGRAM_SOURCE,
            categoryKey: existing?.categoryKey || categoryName,
            iconName: existing?.iconName || brandName,
            providerTransactionId: trx_id || existing?.providerTransactionId || null,
            transactionYear: timestamp.getFullYear(),
            transactionMonth: timestamp.getMonth() + 1,
            transactionDayOfMonth: timestamp.getDate(),
            transactionDayOfWeek: timestamp.getDay(),
            transactionHour: timestamp.getHours(),
            failureReason: normalizedStatus === "Gagal" ? (message || null) : null,
            serialNumber: sn ? sn.toString() : existing?.serialNumber || null
        };
        
        const updated = await TransactionLog.findOneAndUpdate(
            { id: ref_id },
            { $set: logData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        
        return updated;
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
            const selectedCategory = ctx.session.selectedCategory;
            const requiresOperatorInfo = OPERATOR_CATEGORY_IDS.has(String(selectedCategory?.id || ''));

            let normalizedDestination = (ctx.session.nomorTujuan || '').trim();
            let operatorResult = null;

            if (requiresOperatorInfo && typeof detectOperator === 'function') {
                try {
                    const detected = detectOperator(normalizedDestination);
                    if (detected?.phoneNumber) {
                        normalizedDestination = detected.phoneNumber;
                        ctx.session.nomorTujuan = normalizedDestination;
                    }
                    if (detected?.success) {
                        operatorResult = detected;
                    }
                } catch (error) {
                    console.warn('Operator detection failed:', error);
                }
            }

            ctx.session.operatorInfo = operatorResult;
            ctx.session.requiresOperatorInfo = requiresOperatorInfo;
            if (!requiresOperatorInfo) {
                ctx.session.operatorInfo = null;
            }

            let detail = `✅ <b>KONFIRMASI PESANAN</b>\n\n`;
            detail += `📦 <b>Produk:</b> ${produk.nama_produk || '-'}\n`;
            detail += `💰 <b>Harga:</b> Rp ${numberWithCommas(Number(harga))}\n`;
            detail += `👤 <b>Tujuan:</b> <code>${escapeHtml(normalizedDestination)}</code>\n`;
            if (operatorResult) {
                const operatorLabel = operatorResult.operator ? operatorResult.operator.toString().toUpperCase() : '';
                detail += `🏢 <b>Operator:</b> ${operatorResult.emoji} <b>${escapeHtml(operatorLabel)}</b> ${operatorResult.icon}\n`;
                detail += `🔢 <b>Prefix:</b> <code>${escapeHtml(operatorResult.prefix)}</code>\n`;
            } else if (requiresOperatorInfo) {
                detail += `⚠️ <b>Operator:</b> Tidak terdeteksi. Periksa kembali nomor tujuan.\n`;
            }
            if (ctx.session.serverId) {
                detail += `🎮 <b>Server ID:</b> <code>${escapeHtml(ctx.session.serverId)}</code>\n`;
            }
            if (!ctx.session.refId) {
                try { ctx.session.refId = await getRefId(); } catch (e) { ctx.session.refId = null; }
            }
            if (ctx.session.refId) {
                detail += `🆔 <b>Ref ID:</b> <code>${ctx.session.refId}</code>\n`;
            }

            // Nickname verifications based on product name / operator
            const name = (produk.nama_produk || '').toString().toLowerCase();
            const operatorId = ctx?.session?.selectedBrand?.id?.toString();
            const isMobileLegendsOperator = operatorId === '2';
            ctx.session.ffNickname = null;
            ctx.session.mlNickname = null;

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
            } else if (isMobileLegendsOperator || name.includes('mobile legends')) {
                if (!ctx.session.serverId) {
                    detail += `\n⚠️ <b>Verifikasi Mobile Legends</b>\n`;
                    detail += `• Status: <i>Lewati</i> (Zone ID tidak diisi)\n`;
                } else {
                    try {
                        const res = await inquireMobileLegendsNickname(ctx.session.nomorTujuan, ctx.session.serverId);
                        if (res?.isSuccess && res?.nickname) {
                            ctx.session.mlNickname = res.nickname;
                            ctx.session.mlCountry = res.country;
                            detail += `\n🕹️ <b>Verifikasi Mobile Legends</b>\n`;
                            detail += `• Nickname: <b>${escapeHtml(res.nickname)}</b>\n`;
                            if (res?.country) {
                                detail += `• Country: <b>${escapeHtml(res.country)}</b>\n`;
                            }
                        } else {
                            detail += `\n⚠️ <b>Verifikasi Mobile Legends</b>\n`;
                            detail += `• Status: <i>${escapeHtml(res?.message || 'Tidak tervalidasi')}</i>\n`;
                            detail += `• Transaksi dapat dilanjutkan\n`;
                            ctx.session.mlCountry = undefined;
                        }
                    } catch (e) {
                        detail += `\n⚠️ <b>Verifikasi Mobile Legends</b>\n`;
                        detail += `• Status: <i>Gangguan</i>\n`;
                        detail += `• Pesan: <i>${escapeHtml(e.message || 'Tidak diketahui')}</i>\n`;
                        detail += `• Transaksi dapat dilanjutkan\n`;
                        ctx.session.mlCountry = undefined;
                    }
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
                await createTransactionLog(trx_id, username, TELEGRAM_SOURCE, ctx);

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
                if (ctx.session.ffNickname) {
                    summaryLines.push(`🕹️ <b>Nickname FF:</b> <code>${escapeHtml(ctx.session.ffNickname)}</code>`);
                }
                if (ctx.session.mlNickname) {
                    summaryLines.push(`🕹️ <b>Nickname ML:</b> <code>${escapeHtml(ctx.session.mlNickname)}</code>`);
                    if (ctx.session.mlCountry) {
                        summaryLines.push(`🌍 <b>Country:</b> <code>${escapeHtml(ctx.session.mlCountry)}</code>`);
                    }
                }
                const operatorInfo = ctx.session.operatorInfo;
                if (operatorInfo) {
                const operatorLabel = operatorInfo.operator ? operatorInfo.operator.toString().toUpperCase() : '';
                summaryLines.push(`🏢 <b>Operator:</b> ${operatorInfo.emoji} <b>${escapeHtml(operatorLabel)}</b> ${operatorInfo.icon}`);
                    summaryLines.push(`🔢 <b>Prefix:</b> <code>${escapeHtml(operatorInfo.prefix)}</code>`);
                } else if (ctx.session.requiresOperatorInfo) {
                    summaryLines.push(`⚠️ <b>Operator:</b> Tidak terdeteksi`);
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
