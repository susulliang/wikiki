const fs = require('fs');
const initSqlJs = require('sql.js');

async function run() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  db.run(`CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    mime_type TEXT,
    data BLOB
  )`);
  
  const content = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="test">';
  
  // extract
  const matches = content.matchAll(/<img[^>]+src="data:(image\/[^;]+);base64,([^"]+)"[^>]*>/gi);
  const images = [];
  for (const m of matches) {
    const mime = m[1];
    const b64 = m[2];
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    images.push({ id: 'img-123', mime, data: bytes });
  }
  
  // save
  for (const img of images) {
    db.run('INSERT INTO images (id, mime_type, data) VALUES (?, ?, ?)', [img.id, img.mime, img.data]);
  }
  
  // replace
  let idx = 0;
  const replaced = content.replace(/<img[^>]+src="data:image\/[^"]+"[^>]*>/gi, (match) => {
    if (idx >= images.length) return match;
    const img = images[idx++];
    return match.replace(/src="data:image\/[^"]+"/, `data-wiki-img="${img.id}"`);
  });
  console.log('Saved content:', replaced);
  
  // load
  const imgRows = db.exec('SELECT id, mime_type, data FROM images');
  const imgMap = new Map();
  if (imgRows[0]) {
    for (const row of imgRows[0].values) {
      imgMap.set(row[0], { mime: row[1], data: row[2] });
    }
  }
  
  // restore
  const restored = replaced.replace(/<img([^>]*)data-wiki-img="([^"]+)"([^>]*)>/gi, (_full, before, imgId, after) => {
    const img = imgMap.get(imgId);
    if (!img) return _full;
    let binary = '';
    const len = img.data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(img.data[i]);
    }
    const b64 = btoa(binary);
    const cleanBefore = before.replace(/src=""/g, '');
    const cleanAfter = after.replace(/src=""/g, '');
    return `<img${cleanBefore}src="data:${img.mime};base64,${b64}"${cleanAfter}>`;
  });
  console.log('Restored content:', restored);
  
  // verify
  console.log('Match?', content === restored);
}

run();
