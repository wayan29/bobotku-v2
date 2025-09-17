const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { showKeyboardChunk } = require('../services/keyboard');
const { getListBrand } = require('../services/http');
const { getOperatorByCategory } = require('../services/http_toko');

let listBrand;

const botMenu = new telegraf.Scenes.BaseScene(SCENE_KEYS.BRAND);
botMenu.enter(async (ctx) => {
    const selectedCategory = ctx.session.selectedCategory;
    const BOT = ctx.session.selectedBot;

    if (BOT === 'Digiflazz') {
        listBrand = await getListBrand(selectedCategory);
        
        const listText = `🏷️ <b>Pilih Brand</b>\n\n` + listBrand
            .map((item, index) => `${(index + 1).toString().padStart(2,'0')}. ${item}`)
            .join('\n');
        
        await ctx.replyWithHTML(listText, showKeyboardChunk(['⬅️ Kembali']));

    } else if (BOT === 'TokoVoucher') {
        const id_category = selectedCategory.id;
        listBrand = await getOperatorByCategory(id_category);
       
        const listText = `🏷️ <b>Pilih Brand</b>\n\n` + listBrand
            .map((item, index) => `${(index + 1).toString().padStart(2,'0')}. ${item.nama}`)
            .join('\n');

        await ctx.replyWithHTML(listText, showKeyboardChunk(['⬅️ Kembali']));
    }
});

botMenu.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text === "⬅️ Kembali") {
        return ctx.scene.enter(SCENE_KEYS.CATEGORY);
    }

    const BOT = ctx.session.selectedBot;
    if (BOT === 'Digiflazz') {
        if (!isNaN(text)) {
            const selectedIndex = parseInt(text) - 1;
            if (listBrand[selectedIndex]) {
                ctx.session.selectedBrand = listBrand[selectedIndex];
                return ctx.scene.enter(SCENE_KEYS.PRODUCT);
            } else {
                return ctx.reply('Maaf, pilihan brand tidak tersedia. Silakan pilih nomor yang valid.');
            }
        } else {
            return ctx.reply('Maaf, input harus berupa nomor. Silakan pilih nomor brand.');
        }
    } else if (BOT === 'TokoVoucher') {
        if (!isNaN(text)) {
             const selectedIndex = parseInt(text) - 1;
            if (listBrand[selectedIndex]) {
                ctx.session.selectedBrand = listBrand[selectedIndex];
                return ctx.scene.enter(SCENE_KEYS.PRODUCT);
            } else {
                return ctx.reply('Maaf, pilihan brand tidak tersedia. Silakan pilih nomor yang valid.');
            }
        } else {
            return ctx.reply('Maaf, input harus berupa nomor. Silakan pilih nomor brand.');
        }
    }
});

module.exports = botMenu;
