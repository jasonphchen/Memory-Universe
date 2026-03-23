#!/usr/bin/env python3
"""
压缩 back-up 文件夹中的图片到大约 200KB，保存到 stars 文件夹
"""

import os
from pathlib import Path
from PIL import Image
import io

def compress_image(input_path: Path, output_path: Path, target_size_kb: int = 20):
    """
    压缩图片到目标大小（KB）
    
    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径
        target_size_kb: 目标文件大小（KB）
    """
    try:
        # 打开图片
        img = Image.open(input_path)
        target_size_bytes = target_size_kb * 1024
        
        # 检查图片模式
        has_alpha = img.mode in ('RGBA', 'LA')
        is_png = input_path.suffix.lower() == '.png'
        
        if has_alpha and is_png:
            # 对于透明 PNG，尝试不同的压缩方法
            # 方法1: 尝试 PNG 优化
            output_buffer = io.BytesIO()
            img.save(output_buffer, format='PNG', optimize=True)
            size = len(output_buffer.getvalue())
            
            if size <= target_size_bytes * 1.1:
                # PNG 压缩后大小合适，直接保存
                with open(output_path, 'wb') as f:
                    f.write(output_buffer.getvalue())
                print(f"✓ {input_path.name} -> {output_path.name} ({size/1024:.1f}KB, PNG)")
                return
            
            # 方法2: 如果 PNG 还是太大，尝试 WebP
            for quality in range(85, 40, -5):
                output_buffer = io.BytesIO()
                img.save(output_buffer, format='WEBP', quality=quality, method=6)
                size = len(output_buffer.getvalue())
                
                if size <= target_size_bytes * 1.1:
                    output_path_webp = output_path.with_suffix('.webp')
                    with open(output_path_webp, 'wb') as f:
                        f.write(output_buffer.getvalue())
                    print(f"✓ {input_path.name} -> {output_path_webp.name} ({size/1024:.1f}KB, WebP)")
                    return
            
            # 方法3: 如果还是太大，降低分辨率
            scale_factor = 0.9
            while size > target_size_bytes * 1.1 and scale_factor > 0.5:
                new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
                resized_img = img.resize(new_size, Image.Resampling.LANCZOS)
                output_buffer = io.BytesIO()
                resized_img.save(output_buffer, format='WEBP', quality=75, method=6)
                size = len(output_buffer.getvalue())
                scale_factor -= 0.1
            
            output_path_webp = output_path.with_suffix('.webp')
            with open(output_path_webp, 'wb') as f:
                f.write(output_buffer.getvalue())
            print(f"✓ {input_path.name} -> {output_path_webp.name} ({size/1024:.1f}KB, WebP, 缩放: {scale_factor+0.1:.1f})")
            
        else:
            # 对于非透明图片，使用 JPEG 压缩
            rgb_img = img.convert('RGB')
            
            for quality in range(90, 30, -5):
                output_buffer = io.BytesIO()
                rgb_img.save(output_buffer, format='JPEG', quality=quality, optimize=True)
                size = len(output_buffer.getvalue())
                
                if size <= target_size_bytes * 1.1:
                    output_path_jpg = output_path.with_suffix('.jpg')
                    with open(output_path_jpg, 'wb') as f:
                        f.write(output_buffer.getvalue())
                    print(f"✓ {input_path.name} -> {output_path_jpg.name} ({size/1024:.1f}KB, JPEG, quality: {quality})")
                    return
            
            # 如果还是太大，降低分辨率
            scale_factor = 0.9
            best_quality = 75
            while size > target_size_bytes * 1.1 and scale_factor > 0.5:
                new_size = (int(rgb_img.width * scale_factor), int(rgb_img.height * scale_factor))
                resized_img = rgb_img.resize(new_size, Image.Resampling.LANCZOS)
                output_buffer = io.BytesIO()
                resized_img.save(output_buffer, format='JPEG', quality=best_quality, optimize=True)
                size = len(output_buffer.getvalue())
                scale_factor -= 0.1
            
            output_path_jpg = output_path.with_suffix('.jpg')
            with open(output_path_jpg, 'wb') as f:
                f.write(output_buffer.getvalue())
            print(f"✓ {input_path.name} -> {output_path_jpg.name} ({size/1024:.1f}KB, JPEG, 缩放: {scale_factor+0.1:.1f})")
        
    except Exception as e:
        print(f"✗ 压缩 {input_path.name} 失败: {e}")

def main():
    # 获取脚本所在目录
    script_dir = Path(__file__).parent
    backup_dir = script_dir / 'back-up'
    output_dir = script_dir / 'stars'
    
    # 创建输出目录（如果不存在）
    output_dir.mkdir(exist_ok=True)
    
    # 支持的图片格式
    image_extensions = {'.png', '.jpg', '.jpeg', '.PNG', '.JPG', '.JPEG'}
    
    # 获取所有图片文件
    image_files = [f for f in backup_dir.iterdir() if f.suffix in image_extensions]
    
    if not image_files:
        print(f"在 {backup_dir} 中没有找到图片文件")
        return
    
    print(f"找到 {len(image_files)} 个图片文件\n")
    
    for image_file in image_files:
        output_path = output_dir / image_file.name
        compress_image(image_file, output_path, target_size_kb=20)
    
    print(f"\n压缩完成！输出目录: {output_dir}")

if __name__ == '__main__':
    main()
