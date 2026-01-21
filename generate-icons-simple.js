// 简单的图标生成脚本（使用 Node.js）
// 需要安装: npm install canvas 或使用浏览器版本

// 这是一个使用 Canvas API 的浏览器版本
// 在浏览器控制台中运行，或使用 Node.js + canvas

const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 绘制渐变背景
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // 绘制笔记本图标
  const margin = size * 0.2;
  const lineWidth = Math.max(1, size / 16);
  
  // 外框
  ctx.strokeStyle = 'white';
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(margin, margin, size - margin * 2, size - margin * 2);
  
  // 内部横线
  const lineSpacing = size * 0.15;
  for (let i = 1; i < 3; i++) {
    const y = margin + lineSpacing * i;
    ctx.beginPath();
    ctx.moveTo(margin * 2, y);
    ctx.lineTo(size - margin * 2, y);
    ctx.stroke();
  }
  
  return canvas.toBuffer('image/png');
}

// 生成图标
const sizes = [16, 48, 128];
const iconsDir = './icons';

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

sizes.forEach(size => {
  const buffer = createIcon(size);
  fs.writeFileSync(`${iconsDir}/icon${size}.png`, buffer);
  console.log(`生成图标: icons/icon${size}.png (${size}x${size})`);
});

console.log('✅ 图标生成完成！');

