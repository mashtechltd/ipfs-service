const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const schema = new Schema({
    EXTUID: { type : String },
    XD: { type : String },
    ArtistWallet: { type : String, required: true },
    ArtistName: { type : String },
    NSYSUID: { type : String },
    IPFSMetadataCID: { type : String, required: true },
    ImageCID: { type : String, required: true },
    AWS_UID: { type : String, required: true, unique: true },
    MediaName: { type : String, required: true },
    MediaType: { type : String, required: true },
    AssetSizeInBytes: { type : Number, required: true },
    Format: { type : String, required: true },
    MediaDescription: { type : String },
    ExternalURL: { type : String },
    Theme: { type : String },
    Scarcity: { type : String },
    ProductionYear: { type : Number },
    MintStatus: { type : Boolean, default: false },
    Tags: { type : Array },

    // Added fields
    BNBPrice: { type : Number },
    SellingMethod: { type: String, enum: ['TimedAuction', 'FixedPrice'], default: 'FixedPrice' },
    TimedAuctionEndDate: { type : Date, default: null },
    Likes: { type : Number, default: 0 },
}, { timestamps : true });
schema.index({ ArtistWallet: 1, IPFSMetadataCID: 1, AWS_UID: 1 });
module.exports = mongoose.model('asset', schema);