# L20 抽象求解器：环树 + 多夹扣锁定 + 重力(上方环的球会落在下方未破环上) + 传送带容量 + 盒子栈顺序
# 用法: python3 tools/l20_solver.py verify   -> 校验 levels.js 中的 L20 设计（唯一解）
#       python3 tools/l20_solver.py search S -> 随机搜索新的颜色/盒子布局
import itertools, random, sys, json
# 3x3 布局：      W(212,380)  A(432,380)  E(652,380)
#                WW(212,600)  S(432,600) EE(652,600)
#                BL(212,820) SS(432,820) BR(652,820)
TREE = {'w': 'a', 'e': 'a', 's': 'a', 'ww': 'w', 'ee': 'e', 'ss': 's', 'bl': 'ss', 'br': 'ss'}
BELOW = {'w': 'ww', 'ww': 'bl', 'e': 'ee', 'ee': 'br', 'a': 's', 's': 'ss'}  # 正下方的环
COLORS = {'w': 'red', 'e': 'purple', 's': 'cyan', 'ww': 'green', 'ee': 'cyan', 'ss': 'orange', 'bl': 'blue', 'br': 'purple'}
BOXES = [['green', 'cyan', 'purple', 'cyan'], ['orange', 'cyan', 'red', 'purple'], ['purple', 'blue', 'cyan', 'blue'], ['purple', 'red', 'green', 'orange']]
CAP, N = 3, 6
def legal_orders():
    ids = list(TREE)
    def rec(done, order):
        if len(order) == len(ids): yield list(order); return
        for i in ids:
            if i in done: continue
            if any(TREE[k] == i and k not in done for k in ids): continue  # 有存活子环 => 两个以上夹扣 => 锁死
            done.add(i); order.append(i); yield from rec(done, order); order.pop(); done.discard(i)
    yield from rec(set(), [])
def gravity_ok(order):
    pos = {r: i for i, r in enumerate(order)}
    return all(pos[BELOW[r]] < pos[r] for r in BELOW if r in pos and BELOW[r] in pos)
def simulate(order, colors, cols, B):
    cols = [list(c) for c in cols]; fill = [0] * len(cols); belt = []; peak = 0
    for rid in order:
        for _ in range(N):
            belt.append(colors[rid]); moved = True
            while moved:
                moved = False
                for bi, c in enumerate(belt):
                    for k, col in enumerate(cols):
                        if col and col[0] == c:
                            fill[k] += 1; belt.pop(bi); moved = True
                            if fill[k] == CAP: col.pop(0); fill[k] = 0
                            break
                    if moved: break
            peak = max(peak, len(belt))
            if len(belt) >= B: return None
    return peak if not belt else None
def analyse(colors, cols, B=6):
    res = [(o, simulate(o, colors, cols, B)) for o in legal_orders()]
    return [(o, p) for o, p in res if p is not None]
if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'verify'
    if mode == 'search':
        random.seed(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
        pal = ['red', 'orange', 'green', 'blue', 'cyan', 'purple']
        for t in range(200000):
            colors = {r: random.choice(pal) for r in TREE}
            if len(set(colors.values())) < 6: continue
            bag = [c for r in TREE for c in [colors[r]] * (N // CAP)]; random.shuffle(bag)
            cols = [bag[i*4:(i+1)*4] for i in range(4)]
            sols = analyse(colors, cols, 6)
            if len(sols) == 1 and gravity_ok(sols[0][0]) and sols[0][1] <= 3 and not analyse(colors, cols, 5) == []:
                looser = analyse(colors, cols, 9)
                print(json.dumps({'colors': colors, 'cols': cols, 'sol': sols[0], 'B9': len(looser)})); break
    else:
        print('legal tree orders:', sum(1 for _ in legal_orders()))
        for B in (4, 5, 6, 7, 8, 10, 13):
            s = analyse(COLORS, BOXES, B); print(f'B={B}: {len(s)} solvable orders', s[:3] if len(s) <= 3 else '')
