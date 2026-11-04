from PIL import Image, ImageDraw, ImageFont
import struct, zlib, io, os

def create_icon():
    sizes = [256, 128, 64, 48, 32, 16]
    images = []
    
    for size in sizes:
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # 深蓝色圆角背景
        margin = int(size * 0.08)
        radius = int(size * 0.22)
        
        # 画圆角矩形背景
        def rounded_rect(draw, xy, radius, fill):
            x1, y1, x2, y2 = xy
            draw.rectangle([x1+radius, y1, x2-radius, y2], fill=fill)
            draw.rectangle([x1, y1+radius, x2, y2-radius], fill=fill)
            draw.ellipse([x1, y1, x1+radius*2, y1+radius*2], fill=fill)
            draw.ellipse([x2-radius*2, y1, x2, y1+radius*2], fill=fill)
            draw.ellipse([x1, y2-radius*2, x1+radius*2, y2], fill=fill)
            draw.ellipse([x2-radius*2, y2-radius*2, x2, y2], fill=fill)
        
        # 背景 - 深蓝色
        rounded_rect(draw, (margin, margin, size-margin, size-margin), radius, (10, 22, 40, 255))
        
        # 品牌蓝色装饰条（顶部）
        bar_h = max(3, int(size * 0.06))
        bar_margin = int(size * 0.18)
        bar_radius = bar_h // 2
        rounded_rect(draw, (bar_margin, int(size*0.22), size-bar_margin, int(size*0.22)+bar_h), bar_radius, (29, 111, 209, 255))
        
        # 绘制 "AI" 文字
        center_x = size // 2
        center_y = int(size * 0.52)
        
        font_size = max(8, int(size * 0.3))
        try:
            font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        # 白色 "AI" 文字
        bbox = draw.textbbox((0, 0), "AI", font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        draw.text((center_x - text_w//2, center_y - text_h//2 - int(size*0.04)), "AI", fill=(255, 255, 255, 255), font=font)
        
        # 品牌蓝色小横线（底部装饰）
        line_y = int(size * 0.72)
        line_margin = int(size * 0.3)
        line_h = max(2, int(size * 0.04))
        rounded_rect(draw, (line_margin, line_y, size-line_margin, line_y+line_h), line_h//2, (29, 111, 209, 200))
        
        images.append(img)
    
    # 保存为 ICO
    out_path = os.path.join(os.path.dirname(__file__), 'assets', 'icon.ico')
    images[0].save(out_path, format='ICO', sizes=[(s, s) for s in sizes], append_images=images[1:])
    print(f"Icon saved to: {out_path}")

create_icon()
