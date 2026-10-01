// Build dist/index.html: inline CSS, JS and the embedded font into one self-contained file.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('src/index.html');
const css = read('src/style.css');
const fontPath = path.join(root, 'src/fonts.css');
const fonts = fs.existsSync(fontPath) ? fs.readFileSync(fontPath, 'utf8') : '';
const jsFiles = ['src/theory.js'].concat(fs.existsSync(path.join(root, 'src/shapes.js')) ? ['src/shapes.js'] : [], fs.existsSync(path.join(root, 'src/audio.js')) ? ['src/audio.js'] : [], fs.existsSync(path.join(root, 'src/app.js')) ? ['src/app.js'] : []);
const js = jsFiles.map(read).join('\n;\n');
html = html.replace('<!--STYLE-->', () => '<style>\n' + fonts + '\n' + css + '\n</style>');
html = html.replace('<!--SCRIPT-->', () => '<script>\n' + js.replace(/<\/script/gi, '<\\/script') + '\n</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log('dist/index.html', Buffer.byteLength(html), 'bytes from', jsFiles.join(', '));
