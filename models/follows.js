const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const schema = new Schema({
    WalletUID: { type : String, required: true },
    ToWalletUID: { type : String, required: true }
}, { timestamps : true });
schema.index({ FromWalletUID: 1, ToWalletUID: 1 });
module.exports = mongoose.model('follow', schema);