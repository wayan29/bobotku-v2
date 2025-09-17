const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk } = require('../services/keyboard');
const { getRefId } = require('../services/http_toko');

const botMenu = new telegraf.Scenes.BaseScene(SCENE_KEYS.OPSI1);
botMenu.enter(async (ctx) => {
    const selectedJenis = ctx.session.selectedProduct;
    const BOT = ctx.session.selectedBot;

    if (BOT === 'TokoVoucher') {
        // Generate and store ref ID for TokoVoucher ahead of confirmation
        try {
            ctx.session.refId = await getRefId();
        } catch (e) {
            // fallback: keep undefined; will be regenerated on confirm
            ctx.session.refId = ctx.session.refId || null;
        }
        ctx.session.codeList = ctx.session.selectedProduct.code;
        const keyboardaja = showKeyboardChunk(["⬅️ Kembali"]);

        const statusText = selectedJenis.status ? '✅ <b>Tersedia</b>' : '❌ <b>Gangguan</b>';

        const message = `📦 <b>Detail Produk</b>\n\n`
        + `🏷️ Kode: <code>${ctx.session.codeList}</code>\n`
        + `📛 Nama: <b>${ctx.session.selectedProduct.nama_produk}</b>\n`
        + `💰 Harga: Rp ${Number(ctx.session.selectedProduct.price).toLocaleString('id-ID')}\n`
        + `📊 Status: ${statusText}\n\n`
        + (ctx.session.refId ? `🆔 Ref ID: <code>${ctx.session.refId}</code>\n\n` : '')
        + `📱 <b>Masukkan Nomor Tujuan</b>`;

        await ctx.replyWithHTML(message, keyboardaja);
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
        ctx.session.nomorTujuan = pesan;
        ctx.scene.enter(SCENE_KEYS.OPSI2);
    }
});

module.exports = botMenu;
