import https from 'https';
// test raw request
const testRaw = () => {
    const req = https.request(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST' }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => console.log('Raw Cloudinary response:', res.statusCode, data));
    });
    req.end();
};
testRaw();
//# sourceMappingURL=test-cloud.js.map