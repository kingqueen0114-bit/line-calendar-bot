const Jimp = require('jimp');

async function extractColors() {
    const image = await Jimp.read('/Users/yuiyane/Downloads/最新の写真を表示.png');
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    console.log('Image size:', width, 'x', height);
    
    // ボタン領域の中央付近からサンプリング（6等分）
    const buttonWidth = width / 6;
    const sampleY = Math.floor(height * 0.5);
    
    const colors = [];
    for (let i = 0; i < 6; i++) {
        const sampleX = Math.floor(buttonWidth * i + buttonWidth / 2);
        const pixel = Jimp.intToRGBA(image.getPixelColor(sampleX, sampleY));
        const hex = '#' + [pixel.r, pixel.g, pixel.b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
        colors.push(hex);
        console.log('Button ' + (i+1) + ': ' + hex + ' (R:' + pixel.r + ' G:' + pixel.g + ' B:' + pixel.b + ')');
    }
}

extractColors().catch(console.error);
