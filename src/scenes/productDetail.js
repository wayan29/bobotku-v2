const telegraf = require('telegraf');
const SCENE_KEYS = require('../constants/sceneKeys');
const { handleDigiflazzEnter, handleDigiflazzMessage, handleDigiflazzPinAction } = require('./providers/digiflazz');
const { handleTokoVoucherEnter, handleTokoVoucherMessage } = require('./providers/tokovoucher');

const botMenu = new telegraf.Scenes.BaseScene(SCENE_KEYS.PRICE);

botMenu.enter(async (ctx) => {
    const selectedProduct = ctx.session.selectedBot === 'TokoVoucher' 
        ? ctx.session.MenuPrice 
        : ctx.session.selectedProduct;
    const BOT = ctx.session.selectedBot;

    if (BOT === 'Digiflazz') {
        await handleDigiflazzEnter(ctx, selectedProduct);
    } else if (BOT === 'TokoVoucher') {
        await handleTokoVoucherEnter(ctx, selectedProduct);
    }
});

botMenu.on('text', async (ctx) => {
    const pesan = ctx.message.text;
    if (pesan === "⬅️ Kembali") {
        ctx.scene.enter(SCENE_KEYS.PRODUCT);
        return;
    }

    const BOT = ctx.session.selectedBot;
    if (BOT === 'Digiflazz') {
        await handleDigiflazzMessage(ctx, pesan);
    } else if (BOT === 'TokoVoucher') {
        await handleTokoVoucherMessage(ctx, pesan);
    }
});

// Handle inline keypad callbacks for PIN (Digiflazz)
botMenu.action(/^pin:(.+)$/, async (ctx) => {
    const data = ctx.match[1];
    const BOT = ctx.session.selectedBot;
    if (BOT === 'Digiflazz') {
        await handleDigiflazzPinAction(ctx, data);
    } else {
        await ctx.answerCbQuery();
    }
});

module.exports = botMenu;
