const { showKeyboardChunk, splitList } = require('../../services/keyboard');
const { numberWithCommas } = require('../../utils/formatters');
const { getListJenis } = require('../../services/http_toko');
const SCENE_KEYS = require('../../constants/sceneKeys');

const handleTokoVoucherEnter = async (ctx, selectedProduct) => {
    const id_jenis = selectedProduct.id;
    const listJenis = await getListJenis(id_jenis);
    ctx.session.listJenis = listJenis;

    const chunkSize = 10; // Reduced for better mobile display
    const chunks = splitList(listJenis, chunkSize);
    for (let i = 0; i < chunks.length; i++) {
        let listChunk = `╔══ 🛒 *DAFTAR PRODUK* 🛒 ══╗\n`;
        listChunk += `║\n`;
        
        chunks[i].forEach((item, index) => {
            const num = (i * chunkSize + index + 1).toString().padStart(2, '0');
            listChunk += `║ ${num}. ${item.nama_produk}\n`;
            listChunk += `║     💰 Rp ${numberWithCommas(item.price)}\n`;
            listChunk += `║\n`;
        });
        
        listChunk += `╚═════════════════════╝\n\n`;
        listChunk += `📝 *Ketik nomor untuk memilih produk*`;
        
        await ctx.replyWithMarkdown(listChunk, showKeyboardChunk(['⬅️ Kembali']));
    }
};

const handleTokoVoucherMessage = async (ctx, message) => {
    if (Number(message)) {
        if (ctx.session.listJenis[message - 1]) {
            ctx.session.selectedProduct = ctx.session.listJenis[message - 1];
            ctx.scene.enter(SCENE_KEYS.OPSI1);
        } else {
                                ctx.replyWithMarkdown(`❌ *Maaf!*
Pilihan yang Anda masukkan tidak tersedia.

💡 Silakan pilih nomor yang ada dalam daftar.`);
        }
    }
};

module.exports = {
    handleTokoVoucherEnter,
    handleTokoVoucherMessage
};
