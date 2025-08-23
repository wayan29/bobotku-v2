const { performTransaction } = require('../../services/http');
const DigiFlazz = require('../../models/trxdigi');
const { showKeyboardChunk } = require('../../services/keyboard');
const { numberWithCommas } = require('../../utils/formatters');
const SCENE_KEYS = require('../../constants/sceneKeys');

const handleDigiflazzEnter = async (ctx, selectedProduct) => {
    const List = selectedProduct;
    const refId = "REF" + new Date().toISOString().replace(/[^0-9]/g, "").substring(0, 14) + "WAYAN";
    ctx.session.sku = List.buyer_sku_code;
    ctx.session.refId = refId;

    let text = `╔══ 📦 *DETAIL PRODUK* 📦 ══╗\n`;
    text += `║\n`;
    text += `║ 🎯 *${selectedProduct.product_name}*\n`;
    text += `║\n`;
    text += `╟────────────────────╢\n`;
    text += `║ 💰 *Harga*\n`;
    text += `║ Rp ${numberWithCommas(List.price)}\n`;
    text += `║\n`;
    text += `║ 🏷️ *SKU*\n`;
    text += `║ \`${List.buyer_sku_code}\`\n`;
    text += `║\n`;
    text += `║ 🏢 *Penjual*\n`;
    text += `║ ${List.seller_name}\n`;
    text += `║\n`;
    text += `║ 📊 *Status Produk*\n`;
    text += `║ ${List.seller_product_status ? '✅' : '❌'} Penjual: ${List.seller_product_status ? 'AKTIF' : 'TIDAK AKTIF'}\n`;
    text += `║ ${List.buyer_product_status ? '✅' : '❌'} Pembeli: ${List.buyer_product_status ? 'AKTIF' : 'TIDAK AKTIF'}\n`;
    text += `║\n`;
    text += `║ 🆔 *Ref ID*\n`;
    text += `║ \`${refId}\`\n`;
    text += `║\n`;
    text += `╚═════════════════════╝`;
    
    await ctx.replyWithMarkdown(text);
    await ctx.reply('Masukkan nomor pelanggan:', showKeyboardChunk(["⬅️ Kembali"]));
};

const handleDigiflazzMessage = async (ctx, message) => {
    const proses = await performTransaction(ctx.session.refId, ctx.session.sku, message);
    let text;
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

    text = `╔══ ${statusEmoji} *TRANSAKSI* ${statusEmoji} ══╗
║
║ 🎫 *Status Transaksi*
║ ${statusEmoji} ${statusText}
║
╟────────────────────╢
║ 📋 *Detail Pesanan*
║ 🔢 Ref ID: \`${proses.ref_id || 'N/A'}\`
║ 📱 Nomor: \`${proses.customer_no || 'N/A'}\`
║ 🏷️ SKU: \`${proses.buyer_sku_code || 'N/A'}\`
║
║ 💰 *Harga*
║ Rp ${proses.price ? Number(proses.price).toLocaleString('id-ID') : 'N/A'}
║
║ 🎮 *Serial Number*
║ \`${proses.sn || 'N/A'}\`
║
╚═════════════════════╝`;

    const newDigiFlazz = new DigiFlazz({
        ref_id: proses.ref_id,
        customer_no: proses.customer_no,
        buyer_sku_code: proses.buyer_sku_code,
        message: proses.message,
        status: proses.status,
        rc: proses.rc,
        buyer_last_saldo: proses.buyer_last_saldo,
        sn: proses.sn,
        price: proses.price,
        tele: proses.tele,
        wa: proses.wa,
    });
    await newDigiFlazz.save();
    await ctx.replyWithMarkdown(text);
    ctx.session = {};
    ctx.session.selectedBot = `Digiflazz`;
    ctx.scene.enter(SCENE_KEYS.CATEGORY);
};

module.exports = {
    handleDigiflazzEnter,
    handleDigiflazzMessage
};
