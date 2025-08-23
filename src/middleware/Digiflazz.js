// req models
const DigiModels = require("../models/trxdigi");
const axios = require('axios');
const crypto = require('crypto');

async function checkTransactionStatus(RefID) {
    const username = process.env.username;
    const kunci = process.env.apikey;
    const endpoint = 'https://api.digiflazz.com/v1/transaction';

    // find data by RefID from database
    const data = await DigiModels.findOne({ ref_id: RefID });
    if (!data) {
        throw new Error('Ref ID tidak ditemukan');
    }

    const ref_id_number = data.ref_id;
    const customer_no = data.customer_no;
    const buyer_sku_code = data.buyer_sku_code;

    const sign = crypto
        .createHash('md5')
        .update(username + kunci + ref_id_number)
        .digest('hex');

    const requestData = {
        username,
        buyer_sku_code,
        customer_no,
        ref_id: ref_id_number,
        sign,
    };

    try {
        const requestDataJSON = JSON.stringify(requestData);
        const response = await axios.post(endpoint, requestDataJSON, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const response_json = response.data;
        console.log(response_json);
        
        if (response_json.data.status === 'Sukses') {
            const result = {
                ref_id: response_json.data.ref_id,
                customer_no: response_json.data.customer_no,
                buyer_sku_code: response_json.data.buyer_sku_code,
                message: response_json.data.message,
                status: response_json.data.status,
                rc: response_json.data.rc,
                sn: response_json.data.sn,
                buyer_last_saldo: response_json.data.buyer_last_saldo,
                price: response_json.data.price,
                tele: response_json.data.tele,
                wa: response_json.data.wa,
            };
            return result;
        } else if (response_json.data.status === 'Pending') {
            const result = {
                ref_id: response_json.data.ref_id,
                customer_no: response_json.data.customer_no,
                buyer_sku_code: response_json.data.buyer_sku_code,
                message: response_json.data.message,
                status: response_json.data.status,
                rc: response_json.data.rc,
                sn: response_json.data.sn,
                buyer_last_saldo: response_json.data.buyer_last_saldo,
                price: response_json.data.price,
                tele: response_json.data.tele,
                wa: response_json.data.wa,
            };
            return result;
        } else if (response_json.data.status === 'Gagal') {
            const result = {
                message: response_json.data.message,
                status: response_json.data.status,
            };
            return result;
        } else {
            return "Gagal Terhubung Ke Server !";
        }
    } catch (error) {
        const response_json = error.response.data['data'];
        return response_json;
    }
}

const getAllDigiflazz = async (ctx, next) => {
    if (ctx.message.text.startsWith('/digi')) {
        const data = await DigiModels.find();
        
        if (data.length === 0) {
            const emptyMessage = `
🔍 <b>DAFTAR TRANSAKSI DIGIFLAZZ</b>

❌ <i>Tidak ada transaksi yang ditemukan</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <i>Gunakan /digicheck [ref_id] untuk cek status</i>
            `;
            ctx.replyWithHTML(emptyMessage);
            return;
        }

        let no = 1;
        let messages = [];

        // Header message
        const headerMessage = `
🔍 <b>DAFTAR TRANSAKSI DIGIFLAZZ</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 <i>Total: ${data.length} transaksi</i>

`;
        messages.push(headerMessage);

        data.forEach((item) => {
            const statusEmoji = item.status === 'Sukses' ? '✅' : 
                               item.status === 'Pending' ? '⏳' : 
                               item.status === 'Gagal' ? '❌' : '❓';
            
            messages.push(`${statusEmoji} <b>${no}.</b> <code>${item.ref_id}</code>`);
            no++;
        });

        // Footer message
        const footerMessage = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <i>Gunakan /digicheck [ref_id] untuk cek detail</i>
        `;

        // Bagikan pesan menjadi beberapa bagian jika terlalu panjang
        const chunkSize = 25;
        for (let i = 0; i < messages.length; i += chunkSize) {
            let chunk;
            if (i === 0) {
                // Pesan pertama dengan header
                chunk = messages.slice(i, i + chunkSize).join('\n');
            } else {
                chunk = messages.slice(i, i + chunkSize).join('\n');
            }
            
            // Tambahkan footer di pesan terakhir
            if (i + chunkSize >= messages.length) {
                chunk += footerMessage;
            }
            
            ctx.replyWithHTML(chunk);
        }
    } else {
        next();
    }
}

// check digi
const checkDigiflazz = async (ctx, next) => {
    if (ctx.message.text.startsWith('/digicheck ')) {
        // Ambil nomor pelanggan setelah /digicheck
        const refIdNumber = ctx.message.text.slice(11).trim();
        
        if (!refIdNumber) {
            const errorMessage = `
❌ <b>FORMAT SALAH</b>

📝 <b>Cara penggunaan:</b>
<code>/digicheck [ref_id]</code>

💡 <b>Contoh:</b>
<code>/digicheck 123456789</code>
            `;
            ctx.replyWithHTML(errorMessage);
            return;
        }

        try {
            // Kirim pesan loading
            const loadingMsg = await ctx.replyWithHTML(`
⏳ <b>MENGECEK STATUS TRANSAKSI</b>

🔍 <i>Sedang memproses Ref ID: <code>${refIdNumber}</code></i>
📡 <i>Menghubungi server...</i>
            `);

            const data = await checkTransactionStatus(refIdNumber);
            
            // Hapus pesan loading
            ctx.deleteMessage(loadingMsg.message_id);

            // jika data gagal maka kirim pesan error
            if (data.status === "Gagal") {
                const errorMessage = `
❌ <b>TRANSAKSI GAGAL</b>

🆔 <b>Ref ID:</b> <code>${refIdNumber}</code>
📝 <b>Pesan Error:</b> <i>${data.message}</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ <i>Silahkan hubungi admin jika diperlukan</i>
                `;
                ctx.replyWithHTML(errorMessage);
            } else {
                const statusEmoji = data.status === 'Sukses' ? '✅' : 
                                   data.status === 'Pending' ? '⏳' : '❓';
                
                let message = `
${statusEmoji} <b>STATUS TRANSAKSI</b>

🆔 <b>Ref ID:</b> <code>${refIdNumber}</code>
📊 <b>Status:</b> <b>${data.status}</b>
`;

                if (data.customer_no) {
                    message += `📱 <b>No. Pelanggan:</b> <code>${data.customer_no}</code>\n`;
                }

                if (data.buyer_sku_code) {
                    message += `🏷️ <b>Kode Produk:</b> <code>${data.buyer_sku_code}</code>\n`;
                }

                if (data.sn && data.sn !== '-') {
                    message += `🎫 <b>Serial Number:</b> <code>${data.sn}</code>\n`;
                }

                if (data.price) {
                    message += `💰 <b>Harga:</b> Rp ${data.price.toLocaleString('id-ID')}\n`;
                }

                if (data.buyer_last_saldo) {
                    message += `💳 <b>Saldo Terakhir:</b> Rp ${data.buyer_last_saldo.toLocaleString('id-ID')}\n`;
                }

                if (data.message) {
                    message += `📝 <b>Pesan:</b> <i>${data.message}</i>\n`;
                }

                message += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ <i>Dicek pada: ${new Date().toLocaleString('id-ID')}</i>
                `;

                ctx.replyWithHTML(message);

                // update database
                await DigiModels.findOneAndUpdate({ ref_id: refIdNumber }, {
                    status: data.status,
                    sn: data.sn,
                }, { new: true });
            }

        } catch (error) {
            // jika data.error ada maka kirim pesan error
            if (error.response) {
                const response_json = error.response.data['data'];
                const errorMessage = `
❌ <b>TERJADI KESALAHAN</b>

🆔 <b>Ref ID:</b> <code>${refIdNumber}</code>
📝 <b>Error:</b> <i>${response_json.message || 'Kesalahan tidak diketahui'}</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <i>Silahkan coba lagi atau hubungi admin</i>
                `;
                ctx.replyWithHTML(errorMessage);
            } else {
                const errorMessage = `
❌ <b>FORMAT TIDAK VALID</b>

🆔 <b>Ref ID:</b> <code>${refIdNumber}</code>
📝 <b>Error:</b> <i>${error.message}</i>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>Format yang benar:</b>
<code>/digicheck [ref_id]</code>

💡 <b>Contoh:</b>
<code>/digicheck 123456789</code>
                `;
                ctx.replyWithHTML(errorMessage);
            }
        }
    } else {
        next();
    }
}

module.exports = {
    getAllDigiflazz,
    checkDigiflazz
}
