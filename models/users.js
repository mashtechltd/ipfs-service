const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const schema = new Schema({
    WalletUID: { type : String, required: true, unique: true },
    Username: { type : String, required: true, unique: true },
    Bio: { type : String },
    Email: { type : String, required: true, unique: true },
    EmailVerified: { type : Boolean, default: false },
    Website: { type : String },
    TwitterHandle: { type : String },
    TwitterHandleVerified: { type : Boolean, default: false },
    InstagramHandle: { type : String },
    InstagramHandleVerified: { type : Boolean, default: false },
    Location: { type : String },
    BackgroundImage: { type : String },
    ProfileImage: { type : String },
    Amount: { type : Number, default: 0 },
    Followers: { type : Number, default: 0 },
    Following: { type : Number, default: 0 },
    Nonce: { type : Number, default: ()=>{ return Math.floor(Math.random() * 1000000) } },
}, { timestamps : true });
schema.index({ ArtistWallet: 1, NSYSUID: 1, IPFSMetadataCID: 1, AWS_UID: 1 });
module.exports = mongoose.model('user', schema);