const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk } = require('../services/keyboard');
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
        
        listText = `╔══ � *DAFTAR PRODUK* 📱 ══╗\n`;
        listText += `║ ${brand.toUpperCase()}\n`;
        listText += `╟────────────────────╢\n`;
        
        List.forEach((item, index) => {
            const num = (index + 1).toString().padStart(2, '0');
            listText += `║\n`;
            listText += `║ ${num}. ${item.product_name}\n`;
            listText += `║    💰 Rp ${numberWithCommas(item.price)}\n`;
            
            // Add stock status with emoji
            const stockStatus = item.seller_product_status && item.buyer_product_status;
            listText += `║    ${stockStatus ? '✅ Tersedia' : '❌ Tidak Tersedia'}\n`;
        });
        
        listText += `║\n`;
        listText += `╚═════════════════════╝\n\n`;
        listText += `📝 *Ketik nomor untuk memilih produk*`;
    } else if (BOT === 'TokoVoucher') {
        const id_operator = brand.id;
        ctx.session.id_operator = id_operator;
        const listJenis = await getJenis(id_operator);
        ctx.session.list = listJenis;
        listText = `📦 *Silakan Pilih Produk:*

` + listJenis.map((item, index) => `${index + 1}. ${item.nama}`).join('\n');
    }
      await ctx.replyWithMarkdown(listText, showKeyboardChunk(['⬅️ Kembali']));
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
