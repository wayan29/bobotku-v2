const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk } = require('../services/keyboard');
const { createTrx, getRefId } = require('../services/http_toko');
const TokoV = require('../models/tov');

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
        const ref_id = await getRefId();
        const NomorTujuan = ctx.session.nomorTujuan;
        const codeList = ctx.session.codeList;
        const server_id = pesan !== "🚫 Kosong" ? pesan : "";
       
        const trx_id = await createTrx(ref_id, codeList, NomorTujuan, server_id);
         
        if (trx_id.status === 'sukses' || trx_id.status === 'pending') {
          const newTokoV = new TokoV({
            status: trx_id.status,
            message: trx_id.message,
            sn: trx_id.sn,
            ref_id: trx_id.ref_id,
            trx_id: trx_id.trx_id,
            produk: trx_id.produk,
            sisa_saldo: trx_id.sisa_saldo,
            price: trx_id.price,
          });
          await newTokoV.save();
        }
        let message;
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

        // Format price and balance with shorter notation for mobile
        const formatPrice = (price) => {
            if (!price) return 'N/A';
            price = Number(price);
            if (price >= 1000000) {
                return `${(price/1000000).toFixed(1)}M`;
            } else if (price >= 1000) {
                return `${(price/1000).toFixed(0)}K`;
            }
            return price.toString();
        };

        message = `━ ${statusEmoji} <b>TRANSAKSI</b> ${statusEmoji} ━

${statusEmoji} <b>Status:</b> ${statusText}

📋 <b>Detail:</b>
• <b>Produk:</b>
  <code>${ctx.session.codeList || 'N/A'}</code>
• <b>Tujuan:</b> <code>${ctx.session.nomorTujuan || 'N/A'}</code>${server_id ? `
• <b>Server:</b> <code>${server_id}</code>` : ''}

💰 <b>Pembayaran:</b>
• Harga: Rp ${formatPrice(trx_id.price)}
• Saldo: Rp ${formatPrice(trx_id.sisa_saldo)}

🔖 <b>ID Transaksi:</b>
• Ref: <code>${trx_id.ref_id || 'N/A'}</code>
• Trx: <code>${trx_id.trx_id || 'N/A'}</code>${trx_id.sn ? `

🎮 <b>Serial Number:</b>
<code>${trx_id.sn}</code>` : ''}

ℹ️ <b>Pesan:</b> ${trx_id.message || 'Tidak ada pesan'}

━━━━━━━━━━━━━━`;
        
        await ctx.replyWithHTML(message);
          ctx.session = {};
          ctx.session.selectedBot = 'TokoVoucher';
          ctx.scene.enter(SCENE_KEYS.CATEGORY);
    }
});

module.exports = botMenu;