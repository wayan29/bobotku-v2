const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk, splitList } = require('../services/keyboard');
const { getProductList, numberWithCommas } = require('../services/http');
const { getJenis } = require('../services/http_toko');

let List;

const botMenu = new telegraf.Scenes.BaseScene(SCENE_KEYS.PRODUCT);
botMenu.enter(async (ctx) => {
    const category = ctx.session.selectedCategory;
    const brand = ctx.session.selectedBrand;
    const BOT = ctx.session.selectedBot;

    let listText;

    if (BOT === 'Digiflazz') {
        List = await getProductList(category, brand);
        
        const chunkSize = 8; // compact chunks for mobile
        const chunks = splitList(List, chunkSize);
        for (let i = 0; i < chunks.length; i++) {
            let block = `📦 <b>Produk ${brand.toUpperCase()}</b>\n\n`;
            chunks[i].forEach((item, idx) => {
                const num = (i * chunkSize + idx + 1).toString().padStart(2, '0');
                const stock = item.seller_product_status && item.buyer_product_status ? '✅' : '❌';
                block += `${num}. ${item.product_name}\n`;
                block += `   ${stock} Rp ${numberWithCommas(item.price)}\n`;
            });
            block += `\n📝 Ketik nomor untuk memilih`;
            await ctx.replyWithHTML(block, showKeyboardChunk(['⬅️ Kembali']));
        }
        return;
    } else if (BOT === 'TokoVoucher') {
        const id_operator = brand.id;
        ctx.session.id_operator = id_operator;
        const listJenis = await getJenis(id_operator);
        ctx.session.list = listJenis;
        const chunkSize = 10;
        const chunks = splitList(listJenis, chunkSize);
        for (let i = 0; i < chunks.length; i++) {
            let block = `📦 <b>Pilih Produk</b>\n\n`;
            chunks[i].forEach((item, idx) => {
                const num = (i * chunkSize + idx + 1).toString().padStart(2, '0');
                block += `${num}. ${item.nama}\n`;
            });
            block += `\n📝 Ketik nomor untuk memilih`;
            await ctx.replyWithHTML(block, showKeyboardChunk(['⬅️ Kembali']));
        }
        return;
    }
      // fallback
      await ctx.replyWithHTML(listText, showKeyboardChunk(['⬅️ Kembali']));
});

botMenu.on('text', (ctx) => {
    const text = ctx.message.text;
    if (text === "⬅️ Kembali") {
        ctx.scene.enter(SCENE_KEYS.BRAND);
        return;
    }

    const BOT = ctx.session.selectedBot;
    if (BOT === 'Digiflazz') {
        if (!isNaN(text)) {
            const selectedIndex = parseInt(text) - 1;
            if (List[selectedIndex]) {
                ctx.session.selectedProduct = List[selectedIndex];
                ctx.scene.enter(SCENE_KEYS.PRICE);
            } else {
                return ctx.replyWithMarkdown(`❌ *Maaf!*\nProduk yang Anda pilih tidak tersedia.\n\n💡 Silakan pilih nomor yang tertera pada daftar produk.`);
            }
        } else {
            return ctx.reply('Maaf, input harus berupa nomor. Silakan pilih nomor produk.');
        }
    }
    else if (BOT === 'TokoVoucher') {
         const listJenis = ctx.session.list;
        if (!isNaN(text)) {
            const selectedIndex = parseInt(text) - 1;
             if (listJenis[selectedIndex]) {
                ctx.session.selectedProduct = listJenis[selectedIndex];
                ctx.session.MenuPrice = listJenis[selectedIndex];
                ctx.scene.enter(SCENE_KEYS.PRICE);
            } else {
              return ctx.reply('Maaf, pilihan produk tidak tersedia. Silakan pilih nomor yang valid.');
           }
        }  else {
            return ctx.reply('Maaf, input harus berupa nomor. Silakan pilih nomor produk.');
        }
    }
});

module.exports = botMenu;
