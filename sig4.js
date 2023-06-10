const aws4 = require('aws4');
const axios = require('axios');
let options = {
    service: 'ec2',
    region: 'eu-west-2',
    method: "POST",
    path: "/sig4",
    hostname: 'nsys.inf4mation.com',
    headers: {
        'x-amz-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
        Host: 'nsys.inf4mation.com'
    }
};
let sign = aws4.sign(options, { accessKeyId: "AKIAYL6VP5R5UI7D356I", secretAccessKey: "ABBg9IcbnxcC5bsextZ1qqtkgS7elFz2IwZDA2KT" });
axios.post('https://' + options.hostname + options.path, {}, {
    headers: sign.headers
}).then(function (response) {
    console.log(response.data);
}).catch(function (error) {
    console.log(error);
});

// add this file to empty folder
// open terminal in folder
// run : npm init --force
// run : npm i aws4 axios
// run : node sig4.js