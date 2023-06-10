const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const schema = new Schema({
    WalletUID: { type : String, required: true },
    AWS_UID: { type : String, required: true }
}, { timestamps : true });
schema.index({ WalletUID: 1, AWS_UID: 1 });
module.exports = mongoose.model('like', schema);