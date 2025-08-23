const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk } = require('../services/keyboard');

const botMenu = new telegraf.Scenes.BaseScene(SCENE_KEYS.OPSI1);
botMenu.enter(async (ctx) => {
    const selectedJenis = ctx.session.selectedProduct;
    const BOT = ctx.session.selectedBot;

    if (BOT === 'TokoVoucher') {
        ctx.session.codeList = ctx.session.selectedProduct.code;
        const keyboardaja = showKeyboardChunk(["⬅️ Kembali"]);

        const statusText = selectedJenis.status ? '✅ <b>Tersedia</b>' : '❌ <b>Gangguan !!</b>';

       const message = `
        ✨ *Detail Produk:* ✨\n\n
        🏷️ Kode: <code>${ctx.session.codeList}</code>\n
        📦 Produk: <b>${ctx.session.selectedProduct.nama_produk}</b>\n
        💰 Harga: Rp ${Number(ctx.session.selectedProduct.price).toLocaleString('en-US')}\n
        📊 Status: ${statusText}
        `;


        await ctx.replyWithHTML(message);
        await ctx.reply('Silakan Masukkan Nomor Tujuan', keyboardaja);
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