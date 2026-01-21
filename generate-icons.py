#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的图标生成脚本
生成 16x16, 48x48, 128x128 三种尺寸的图标
"""

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("需要安装 Pillow 库: pip install Pillow")
    exit(1)

import os

def create_icon(size):
    """创建指定尺寸的图标"""
    # 创建图像
    img = Image.new('RGB', (size, size), color='white')
    draw = ImageDraw.Draw(img)
    
    # 绘制渐变背景（简化版：使用纯色）
    # 主色调：紫色渐变 (#667eea 到 #764ba2)
    fill_color = (102, 126, 234)  # #667eea
    draw.rectangle([(0, 0), (size, size)], fill=fill_color)
    
    # 绘制笔记本图标（简单的线条）
    margin = int(size * 0.2)
    line_width = max(1, size // 16)
    
    # 外框
    draw.rectangle(
        [margin, margin, size - margin, size - margin],
        outline='white',
        width=line_width
    )
    
    # 内部横线（模拟笔记本）
    line_spacing = int(size * 0.15)
    for i in range(1, 3):
        y = margin + line_spacing * i
        draw.line(
            [(margin * 2, y), (size - margin * 2, y)],
            fill='white',
            width=line_width
        )
    
    return img

def main():
    """主函数"""
    # 创建 icons 目录
    icons_dir = 'icons'
    if not os.path.exists(icons_dir):
        os.makedirs(icons_dir)
        print(f"创建目录: {icons_dir}")
    
    # 生成三种尺寸的图标
    sizes = [16, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        filename = f'{icons_dir}/icon{size}.png'
        icon.save(filename, 'PNG')
        print(f"生成图标: {filename} ({size}x{size})")
    
    print("\n✅ 图标生成完成！")
    print(f"图标文件保存在: {os.path.abspath(icons_dir)}")

if __name__ == '__main__':
    main()

