const { Markup } = require('telegraf');

function buildPinKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('1', 'pin:add:1'),
      Markup.button.callback('2', 'pin:add:2'),
      Markup.button.callback('3', 'pin:add:3'),
    ],
    [
      Markup.button.callback('4', 'pin:add:4'),
      Markup.button.callback('5', 'pin:add:5'),
      Markup.button.callback('6', 'pin:add:6'),
    ],
    [
      Markup.button.callback('7', 'pin:add:7'),
      Markup.button.callback('8', 'pin:add:8'),
      Markup.button.callback('9', 'pin:add:9'),
    ],
    [
      Markup.button.callback('❌ Batal', 'pin:cancel'),
      Markup.button.callback('0', 'pin:add:0'),
      Markup.button.callback('⌫ Hapus', 'pin:del'),
    ],
    [Markup.button.callback('✅ OK', 'pin:ok')],
  ]);
}

function maskedPin(len) {
  if (!len || len <= 0) return '';
  return '•'.repeat(len);
}

function promptText(current = '') {
  return `Masukkan PIN transaksi:\n<code>${maskedPin(current.length)}</code>`;
}

module.exports = {
  buildPinKeyboard,
  maskedPin,
  promptText,
};

