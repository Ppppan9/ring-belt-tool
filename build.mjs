import { build } from 'esbuild';
import fs from 'fs';
// 美术资源：assets/named/*.png → 生成导入模块（esbuild 无 import.meta.glob）
const names = fs.readdirSync('assets/named').filter(f => f.endsWith('.png')).sort();
fs.writeFileSync('src/assets_gen.js', '// 自动生成（build.mjs），勿手改\n' + names.map((f, i) => `import a${i} from '../assets/named/${f}';`).join('\n') + `\nexport default {${names.map((f, i) => `${JSON.stringify(f.replace(/\.png$/, ''))}: a${i}`).join(', ')}};\n`);
const r = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'inline', loader: { '.jpg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl', '.json': 'json', '.jsx': 'text', '.md': 'text', '.py': 'text', '.woff2': 'dataurl', '.ttf': 'dataurl' } });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync('src/template.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
fs.writeFileSync('index.html', html);
console.log('index.html', (html.length / 1024).toFixed(0), 'KB');
