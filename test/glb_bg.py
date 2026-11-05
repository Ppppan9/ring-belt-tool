# 从 scene.glb 中取出背景贴图（宽高比 864:1920 的最大图）存为 png，打印路径
import json, struct, sys, io
from PIL import Image
b = open(sys.argv[1], 'rb').read(); l = struct.unpack('<I', b[12:16])[0]; J = json.loads(b[20:20 + l]); off = 20 + l + 8
best = None
for im in J.get('images', []):
    bv = J['bufferViews'][im['bufferView']]; data = b[off + bv.get('byteOffset', 0): off + bv.get('byteOffset', 0) + bv['byteLength']]
    I = Image.open(io.BytesIO(data))
    if abs(I.width / I.height - 864 / 1920) < 0.02 and (best is None or I.width > best.width): best = I
# glTF 贴图按 GL 约定上下翻转存储 → 翻回画布方向再比较
if best: best = best.transpose(Image.FLIP_TOP_BOTTOM); best.save(sys.argv[2]); print(sys.argv[2])
