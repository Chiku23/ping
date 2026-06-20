import os
from PIL import Image

icon_src_path = "/home/chiku/Projects/Angular/ping_app_icon.png"
splash_src_path = "/home/chiku/Projects/Angular/ping_app_splash.png"

res_dir = "/home/chiku/Projects/Angular/ping-app/android/app/src/main/res"

print("Updating launcher icons...")
for root, dirs, files in os.walk(res_dir):
    for f in files:
        if f.startswith("ic_launcher") and f.endswith(".png"):
            dest_path = os.path.join(root, f)
            with Image.open(dest_path) as dest_img:
                size = dest_img.size
            print(f"Resizing icon to {size} for {dest_path}")
            with Image.open(icon_src_path) as src_img:
                resized = src_img.resize(size, Image.Resampling.LANCZOS)
                resized.save(dest_path, "PNG")

print("Updating splash screens...")
for root, dirs, files in os.walk(res_dir):
    for f in files:
        if f == "splash.png" and f.endswith(".png"):
            dest_path = os.path.join(root, f)
            with Image.open(dest_path) as dest_img:
                size = dest_img.size
            print(f"Resizing splash to {size} for {dest_path}")
            with Image.open(splash_src_path) as src_img:
                if size[0] > size[1]: # Landscape splash
                    resized = src_img.rotate(270, expand=True).resize(size, Image.Resampling.LANCZOS)
                else: # Portrait splash
                    resized = src_img.resize(size, Image.Resampling.LANCZOS)
                resized.save(dest_path, "PNG")

print("All assets updated successfully!")
