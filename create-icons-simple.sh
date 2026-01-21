#!/bin/bash
# 使用 ImageMagick 或 sips (macOS) 创建简单的图标

cd "$(dirname "$0")"
mkdir -p icons

# 检查是否有 sips (macOS)
if command -v sips &> /dev/null; then
    # 创建一个临时图片文件
    for size in 16 48 128; do
        # 创建一个简单的纯色 PNG
        python3 << EOF
from struct import pack
import zlib

def create_simple_png(width, height, r, g, b):
    """创建一个简单的纯色 PNG"""
    # PNG 文件头
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    png += pack('>I', len(ihdr_data))
    png += b'IHDR' + ihdr_data
    png += pack('>I', ihdr_crc)
    
    # IDAT chunk (简单的 RGB 数据)
    row_data = bytes([r, g, b] * width)
    idat_data = zlib.compress(b''.join([b'\x00' + row_data for _ in range(height)]))
    idat_crc = zlib.crc32(b'IDAT' + idat_data) & 0xffffffff
    png += pack('>I', len(idat_data))
    png += b'IDAT' + idat_data
    png += pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    png += pack('>I', 0)
    png += b'IEND'
    png += pack('>I', iend_crc)
    
    return png

# 生成图标 (紫色 #667eea = RGB(102, 126, 234))
with open(f'icons/icon${size}.png', 'wb') as f:
    f.write(create_simple_png(${size}, ${size}, 102, 126, 234))
EOF
    done
    echo "图标已生成（使用 Python）"
elif command -v convert &> /dev/null; then
    # 使用 ImageMagick
    for size in 16 48 128; do
        convert -size ${size}x${size} xc:"#667eea" icons/icon${size}.png
    done
    echo "图标已生成（使用 ImageMagick）"
else
    echo "错误：需要安装 ImageMagick 或使用 Python 脚本"
    echo "或者运行: python3 generate-icons.py"
    exit 1
fi

