// db.createUser( { user: "ipfs-x-user", pwd: "oXvauxbZJZnDfyyH", roles: ["userAdminAnyDatabase","dbAdminAnyDatabase","readWriteAnyDatabase"] } )
// db.createUser( { user: "ipfs-db-user", pwd: "dboXvauxbZJZnDfyyH", roles: [ "readWrite", "dbAdmin" ] } )
const path = require('path');
const db = require('mongoose');
const assetModel = require('./models/assets');
const userModel = require('./models/users');
const likeModel = require('./models/likes');
const followModel = require('./models/follows');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const ipfsClient = require('ipfs-http-client');
const uuid = require('uuid');
const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");
const querystring = require('query-string');
const aws4 = require('aws4');
// eth
const ethUtil = require('ethereumjs-util');
const app = express();
app.use(bodyParser.urlencoded({ limit: '999mb', extended: true }));
app.use(bodyParser.json({ limit: '999mb', extended: true }));
app.use(cookieParser());
app.use(cors());
// Ipfs client
const ipfs = ipfsClient.create({ host: '127.0.0.1', port: 5001, protocol: 'http' });
// Keys
const accessKeyId = "AKIAYL6VP5R57W4UDVR5"; // Must be stored as environment variable
const secretAccessKey = "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"; // Must be stored as environment variable

// Init aws
AWS.config.update({ accessKeyId: "AKIAYL6VP5R5UI7D356I", secretAccessKey: "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" });
const s3 = new AWS.S3();
// Mongodb connection
db.connect('mongodb://ipfs-db-user:dboXvauxbZJZnDfyyH@localhost:27001/ipfs-new-db', { useNewUrlParser: true }, function(err) {
    if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
        console.log('Connection established to', db.connection.host);
    }
});
// Express routes
function headerCheck(req, res, next) {
    if(req.header('x-accessKeyId') !== accessKeyId) return res.status(401).send('Invalid Access Key or Secret Key');
    if(req.header('x-secretAccessKey') !== secretAccessKey) return res.status(401).send('Invalid Access Key or Secret Key');
    return next();
}
function sig4check(req,res,next){
    if(!req.headers['x-amz-date']) return res.status(401).send('Unauthorized Sig4');
    let options = {
        service: 'ec2',
        region: 'eu-west-2',
        method: req.method.toUpperCase(),
        path: req.path,
        hostname: 'nsys.inf4mation.com',
        headers: {
            'x-amz-date': req.headers['x-amz-date'],
            Host: 'nsys.inf4mation.com'
        }
    };
    if(req.query && Object.keys(req.query).length > 0) {
        options.path += '?' + querystring.stringify(req.query);
    }
    if(req.header('x-amz-content-sha256')) options.headers['x-amz-content-sha256'] = req.header('x-amz-content-sha256');
    // if(req.header('Content-Type')) options.headers['content-type'] = req.header('Content-Type');
    
    console.log(options);
    aws4.sign(options, { accessKeyId: "AKIAYL6VP5R5UI7D356I", secretAccessKey: "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" });
    if (options.headers.Authorization !== req.header('Authorization')) {
        console.log({
            serverAuthorization : options.headers.Authorization,
            clientAuthorization : req.header('Authorization')
        });
        return res.status(401).send('Unauthorized');
    }
    next();
}
app.post('/sig4', sig4check, async (req, res, next) => {
    return createAsset(req, res, next);
});
app.post('/api/upload', sig4check, createAsset);
app.post('/api/assets/create', headerCheck, createAsset);
app.get('/api/users/check', headerCheck, async (req, res) => {
    const user = await userModel.findOne({ WalletUID: req.query.WalletUID });
    if(!user) return res.status(404).send('user not found');
    return res.send({ Nonce: user.Nonce });
});
app.post('/api/users/connect', headerCheck, async (req, res) => {
    const user = await userModel.findOne({ WalletUID: req.body.WalletUID });
    if(!user) return res.status(404).send('user not found');

    const msg = `Sign : ${user.Nonce}`;
    const msgHex = ethUtil.bufferToHex(Buffer.from(msg));
    // Check if signature is valid
    const msgBuffer = ethUtil.toBuffer(msgHex);
    const msgHash = ethUtil.hashPersonalMessage(msgBuffer);
    const signatureBuffer = ethUtil.toBuffer(req.body.Signature);
    const signatureParams = ethUtil.fromRpcSig(signatureBuffer);
    const publicKey = ethUtil.ecrecover(
        msgHash,
        signatureParams.v,
        signatureParams.r,
        signatureParams.s
    );
    const addresBuffer = ethUtil.publicToAddress(publicKey);
    const address = ethUtil.bufferToHex(addresBuffer);
    if (address.toLowerCase() === req.body.WalletUID.toLowerCase()) {
        // Generate new nonce
        user.Nonce = Math.floor(Math.random() * 1000000);
        await user.save();
        // Jwt
        const token = jwt.sign({
            address: user.WalletUID,
        }, 'secretNotSecure', { expiresIn: '1h' });
        return res.send({ token });
    } else {
        return res.status(401).send('Unauthorized');
    }
});
app.get('/api/jwt/verify', headerCheck, async (req, res) => {
    const token = req.header('x-auth-token');
    try {
        const decoded = jwt.verify(token, 'secretNotSecure');
        return res.send(decoded);
    } catch (e) {
        return res.status(401).send('Unauthorized');
    }
});
app.get('/api/assets/get', headerCheck, getAsset);
app.get('/api/getAssets', sig4check, getAsset);
app.get('/api/assets/search', headerCheck, async (req, res) => {
    const query = req.query;
    // Get data from mongo
    const condition = {};
    const searchWhiteList = ['EXTUID', 'XD', 'NSYSUID', 'ArtistWallet', 'AWS_UID', 'MediaName', 'MediaType', 'MediaDescription', 'AssetSizeInBytes', 'ExternalURL', 'Format', 'Theme', 'Scarcity', 'ProductionYear', 'Tags'];
    for (const key in query) {
        if(searchWhiteList.includes(key)) condition[key] = query[key];
    }
    const page = query.page || 1;
    const limit = query.limit || 20;
    const assets = await assetModel.find(condition, '-_id -__v', { skip: (page-1)*limit, limit: limit, sort: { createdAt: -1 } });
    const total = await assetModel.countDocuments(condition);
    return res.status(200).send({results : assets, paginate: { page, limit, total }});
});
app.post('/api/users/create', headerCheck, async (req, res) => {
    const body = req.body;
    // validate email
    body.Email = body.Email.toLowerCase().trim();
    if(!body.Email) return res.status(400).send({ Email: 'Email is required' });
    const isEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(!isEmail.test(body.Email)) return res.status(400).send({ Email: 'Invalid email' });
    if(!body.WalletUID) return res.status(400).send({ WalletUID: 'WalletUID is required' });
    if(!body.Username) return res.status(400).send({ Username: 'Username is required' });

    for (const key of ['BackgroundImage', 'ProfileImage']) {
        if(body[key] && body[key].indexOf(';base64,')> 0){
            // upload to s3
            const base64 = body[key].split(';base64,').pop();
            const buffer = Buffer.from(base64, 'base64');
            const fileName = makeid(16);
            const fileType = body[key].split(';').shift().split('/').pop();
            const mimeType = body[key].split(';').shift().split(':').pop();
            const s3params = {
                Bucket: 'inf4mation-inf4-snft',
                Key: `${fileName}.${fileType}`,
                Body: buffer,
                ContentType: mimeType,
                ACL: 'public-read'
            };
            let uploaded = null;
            try {
                // Upload file to S3
                uploaded = await s3.upload(s3params).promise();
                body[key] = uploaded.Location;
            } catch (error) {
                console.log(`Error uploading ${key}`);
            }
        }
    }

    const item = {
        WalletUID: body.WalletUID.trim(),
        Username: body.Username.trim(),
        Bio: body.Bio,
        Email: body.Email,
        Website: body.Website,
        EmailVerified: false,
        TwitterHandle: body.TwitterHandle,
        TwitterHandleVerified: false,
        InstagramHandle: body.InstagramHandle,
        InstagramHandleVerified: false,
        Location: body.Location,
        ProfileImage: body.ProfileImage,
        BackgroundImage: body.BackgroundImage,
        Amount: body.Amount || 0,
    }
    try {
        // Store data in MongoDB
        const user = new userModel(item);
        const userResult = await user.save();
        return res.status(200).send(userResult);
    }catch (error) {
        console.error(error);
        const jsonError = {};
        if(error.code === 11000) jsonError[Object.keys(error.keyValue)[0]] = 'Duplicate key';
        else{
            for (const key in error.errors) {
                jsonError[error.errors[key].path] = error.errors[key].kind;
            }
        }
        return res.status(400).send(jsonError);
    }
});
app.post('/api/users/update', headerCheck, async (req, res) => {
    const body = req.body;
    // validate email
    if(body.Email){
        body.Emal = body.Email.toLowerCase().trim();
        const isEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        if(!isEmail.test(body.Email)) return res.status(400).send({ Email: 'Invalid email' });
    }
    if(!body.WalletUID) return res.status(400).send({ WalletUID: 'WalletUID is required' });
    const condition = { WalletUID: body.WalletUID };
    const whiteList = ["Bio","Website","Location","BackgroundImage","ProfileImage","Amount"];
    for (const key in body) {
        if(!whiteList.includes(key)) delete body[key];
    }
    const item = body;

    for (const key of ['BackgroundImage', 'ProfileImage']) {
        if(body[key] && body[key].indexOf(';base64,')> 0){
            // upload to s3
            const base64 = body[key].split(';base64,').pop();
            const buffer = Buffer.from(base64, 'base64');
            const fileName = makeid(16);
            const fileType = body[key].split(';').shift().split('/').pop();
            const mimeType = body[key].split(';').shift().split(':').pop();
            const s3params = {
                Bucket: 'inf4mation-inf4-snft',
                Key: `${fileName}.${fileType}`,
                Body: buffer,
                ContentType: mimeType
            };
            let uploaded = null;
            try {
                // Upload file to S3
                uploaded = await s3.upload(s3params).promise();
                body[key] = uploaded.Location;
            } catch (error) {
                console.log(`Error uploading ${key}`);
            }
        }
    }

    try {
        // Store data in MongoDB
        const user = await userModel.findOneAndUpdate(condition, item, { new: true });
        return res.status(200).send(user);
    }catch (error) {
        console.error(error);
        const jsonError = {};
        if(error.code === 11000) jsonError[Object.keys(error.keyValue)[0]] = 'Duplicate key';
        else{
            for (const key in error.errors) {
                jsonError[error.errors[key].path] = error.errors[key].kind;
            }
        }
        return res.status(400).send(jsonError);
    }
});
app.get('/api/users/get', headerCheck, async (req, res) => {
    const query = req.query;
    // Get data from mongo
    const condition = {};
    const searchWhiteList = ['WalletUID', 'Username', 'Email'];
    for (const key in query) {
        if(searchWhiteList.includes(key)) condition[key] = query[key];
    }
    const user = await userModel.findOne(condition);
    if(!user) return res.status(404).send('User not found');
    return res.status(200).send(user);
});
app.get('/api/users/search', headerCheck, async (req, res) => {
    const query = req.query;
    // Get data from mongo
    const condition = {};
    const searchWhiteList = ['WalletUID', 'Username', 'Email', 'Location'];
    for (const key in query) {
        if(searchWhiteList.includes(key)) condition[key] = query[key];
    }
    const page = query.page || 1;
    const limit = query.limit || 20;
    const users = await userModel.find(condition, '-_id -__v', { skip: (page-1)*limit, limit: limit, sort: { createdAt: -1 } });
    const total = await userModel.countDocuments(condition);
    return res.status(200).send({results : users, paginate: { page, limit, total }});
});
app.post('/api/users/follow', headerCheck, async (req, res) => {
    const body = req.body;
    if(!body.WalletUID) return res.status(400).send('WalletUID is required');

    const condition = { WalletUID: body.WalletUID, ToWalletUID: body.ToWalletUID };
    const followed = await followModel.findOne(condition);
    if(followed) return res.status(200).send({ followed: true });
    const follow = new followModel(condition);
    // inc followers
    const user = await userModel.findOne({ WalletUID: body.ToWalletUID });
    if(!user) return res.status(404).send('User not found');
    user.Followers = user.Followers || 0;
    user.Followers++;
    await user.save();
    // inc following
    const user2 = await userModel.findOne({ WalletUID: body.WalletUID });
    if(!user2) return res.status(404).send('User not found');
    user2.Following = user2.Following || 0;
    user2.Following++;
    await user2.save();
    const followResult = await follow.save();
    return res.status(200).send({ followed: true });
});
app.post('/api/users/unfollow', headerCheck, async (req, res) => {
    const body = req.body;
    if(!body.WalletUID) return res.status(400).send('WalletUID is required');

    const condition = { WalletUID: body.WalletUID, ToWalletUID: body.ToWalletUID };
    const followed = await followModel.findOneAndDelete(condition);
    if(!followed) return res.status(200).send({ followed: false });
    // dec followers
    const user = await userModel.findOne({ WalletUID: body.ToWalletUID });
    if(!user) return res.status(404).send('User not found');
    user.Followers = user.Followers || 0;
    user.Followers--;
    await user.save();
    // dec following
    const user2 = await userModel.findOne({ WalletUID: body.WalletUID });
    if(!user2) return res.status(404).send('User not found');
    user2.Following = user2.Following || 0;
    user2.Following--;
    await user2.save();
    return res.status(200).send({ followed: false });
});
app.post('/api/assets/mintStatus', headerCheck, async (req, res) => {
    const body = req.body;

    if(!body.AWS_UID) return res.status(400).send('AWS_UID is required');
    if(!body.ArtistWallet) return res.status(400).send('ArtistWallet is required');
    
    const condition = { AWS_UID: body.AWS_UID, ArtistWallet: body.ArtistWallet };
    const asset = await assetModel.findOne(condition);
    if(!asset) return res.status(404).send('Asset not found');
    asset.MintStatus = body.MintStatus || false;
    const assetResult = await asset.save();
    return res.status(200).send({ MintStatus: assetResult.MintStatus });
});
app.post('/api/assets/like', headerCheck, async (req, res) => {
    const body = req.body;
    if(!body.AWS_UID) return res.status(400).send('AWS_UID is required');
    if(!body.WalletUID) return res.status(400).send('WalletUID is required');

    const condition = { AWS_UID: body.AWS_UID, WalletUID: body.WalletUID };
    const liked = await likeModel.findOne(condition);
    if(liked) return res.status(200).send({ liked: true });
    const like = new likeModel(condition);
    const likeResult = await like.save();
    const asset = await assetModel.findOne({ AWS_UID: body.AWS_UID });
    if(!asset) return res.status(404).send('Asset not found');
    asset.Likes = asset.Likes + 1;
    const assetResult = await asset.save();
    return res.status(200).send({ liked: true, Likes: assetResult.Likes });
});
app.post('/api/assets/unlike', headerCheck, async (req, res) => {
    const body = req.body;
    if(!body.AWS_UID) return res.status(400).send('AWS_UID is required');
    if(!body.WalletUID) return res.status(400).send('WalletUID is required');

    const condition = { AWS_UID: body.AWS_UID, WalletUID: body.WalletUID };
    const liked = await likeModel.findOne(condition);
    if(!liked) return res.status(200).send({ liked: false });
    const likeResult = await likeModel.deleteOne(condition);
    const asset = await assetModel.findOne({ AWS_UID: body.AWS_UID });
    if(!asset) return res.status(404).send('Asset not found');
    asset.Likes = asset.Likes - 1;
    const assetResult = await asset.save();
    return res.status(200).send({ liked: false, Likes: assetResult.Likes });
});
app.get('/demo', async (req, res) => {
    // send html file
    res.sendFile(path.join(__dirname, './index.html'));
})

app.listen('4466');

// Generate random string
function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}
async function getAsset(req,res){
    const query = req.query;
    // Get data from mongo
    const condition = {};
    const searchWhiteList = ['EXTUID', 'XD', 'NSYSUID', 'ArtistWallet', 'AWS_UID', 'IPFSMetadataCID'];
    for (const key in query) {
        if(searchWhiteList.includes(key)) condition[key] = query[key];
    }
    let fields = '-_id -__v';
    if(req.query.only){
        let splited = req.query.only.split(',').map(item => item.trim());
        if(splited.length > 0) fields = splited.join(' ');
    }
    const asset = await assetModel.findOne(condition, fields);
    if(!asset) return res.status(404).send('Asset not found');
    return res.status(200).send(asset);
}
async function createAsset(req,res){
    const body = req.body;
    // Check for required fields
    if(!body.file) return res.status(400).send('No file');
    if(!body.ArtistWallet) return res.status(400).send('Wallet Address is required');
    // Validate file ( Base64 )
    if(body.file.indexOf(';base64,')<0) return res.status(400).send('File should be a base64 encoded string');

    // Get file data as buffer
    const base64 = body.file.split(';base64,').pop();
    const buffer = Buffer.from(base64, 'base64');

    // Generate file name and other data
    const fileName = makeid(16);
    const fileType = body.file.split(';').shift().split('/').pop();
    const mimeType = body.file.split(';').shift().split(':').pop();
    const s3params = {
        Bucket: 'inf4mation-inf4-snft',
        Key: `${fileName}.${fileType}`,
        Body: buffer,
        ContentType: mimeType
    };
    let uploaded = null;
    try {
        // Upload file to S3
        uploaded = await s3.upload(s3params).promise();
        console.log({uploaded});
    } catch (error) {
        console.log(error);
        return res.status(500).send('Error uploading file');
    }
    // Add file to ipfs
    const file = { content: buffer, path: `image.${fileType}` };
    const ipfsResult = await ipfs.add(file);
    const imageCid = ipfsResult.cid.toString();
    const imageSize = ipfsResult.size;
    const metadata = {
        MediaName: body.MediaName || `${fileName}.${fileType}`,
        MediaType: mimeType,
        ArtistName: body.ArtistName,
        MediaDescription: body.MediaDescription || '',
        AssetSizeInBytes: imageSize,
        ExternalURL: "https://snifty.io",
        Format: body.Format,
        Theme: body.Theme,
        Scarcity: body.Scarcity,
        ProductionYear: body.ProductionYear || (new Date()).getFullYear(),
        Tags: body.Tags,
        ImageCID: imageCid,
        XD: body.XD
    }
    const ipfsMetadata = {
        name: body.MediaName || `${fileName}.${fileType}`,
        description: body.MediaDescription,
        attributes: {
            artist: body.ArtistName,
            scarcity: body.Scarcity,
            format: body.Format,
            theme: body.Theme,
            tags: (typeof body.Tags === 'string') ? body.Tags.split(',') : body.Tags,
        },
        asset_type: mimeType,
        asset_size_in_bytes: imageSize,
        production_year: body.ProductionYear || (new Date()).getFullYear(),
        artist: body.ArtistWallet,
        external_uri: `https://snifty.io`,
        image: `https://cloud.inf4mation.com/ipfs/${imageCid}`,
        xd: body.XD || ''
    }
    // Add metadata to ipfs
    const json = { content: JSON.stringify(ipfsMetadata), path: `metadata.json` };
    const ipfsResult2 = await ipfs.add(json);
    const metadataCid = ipfsResult2.cid.toString();
    // Generate unique AWS_UID
    const AWS_UID = uuid.v4();
    const item = {
        ...metadata,
        AWS_UID,
        EXTUID: body.EXTUID,
        NSYSUID: body.NSYSUID,
        IPFSMetadataCID: metadataCid,
        ArtistWallet: body.ArtistWallet,
        BNBPrice: body.BNBPrice,
        SellingMethod: body.SellingMethod,
        TimedAuctionEndDate: body.TimedAuctionEndDate,
    };
    try {
        // Store data in MongoDB
        if(body.EXTUID){
            const asset = await assetModel.findOne({ EXTUID: body.EXTUID });
            if(asset) return res.status(200).send('EXTUID already exists');
        }
        if(body.XD){
            const asset = await assetModel.findOne({ XD: body.XD });
            if(asset) return res.status(200).send('XD already exists');
        }
        const asset = new assetModel(item);
        const assetResult = await asset.save();
        return res.status(200).send(assetResult);
    } catch (error) {
        console.error(error);
        const jsonError = {};
        if(error.code === 11000) jsonError[Object.keys(error.keyValue)[0]] = 'Duplicate key';
        else{
            for (const key in error.errors) {
                jsonError[error.errors[key].path] = error.errors[key].kind;
            }
        }

        return res.status(400).send(jsonError);
    }
};