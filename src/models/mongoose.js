const mongoose = require('mongoose');
require('dotenv').config()

const userSchema = new mongoose.Schema({
    chatId: { type: String, required: true, unique: true },
    username: { type: String },
    isPremium: { type: Boolean, default: false },
}, {
    collection: 'white_id'
});


const User = mongoose.model('User', userSchema);

module.exports = User;
