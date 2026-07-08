const content = '<img alt="foo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" class="bar">';

function extractBase64Images(content) {
  const images = [];
  const matches = content.matchAll(/<img[^>]+src="data:(image\/[^;]+);base64,([^"]+)"[^>]*>/gi);
  let counter = 0;
  for (const m of matches) {
    const mime = m[1];
    const b64 = m[2];
    images.push({ id: `img-123`, mime, data: b64 });
  }
  return images;
}

const IMG_PLACEHOLDER_RE = /<img[^>]+src="data:image\/[^"]+"[^>]*>/gi;

function replaceBase64WithPlaceholders(content, images) {
  let idx = 0;
  return content.replace(IMG_PLACEHOLDER_RE, (match) => {
    if (idx >= images.length) return match;
    const img = images[idx++];
    return match.replace(/src="data:image\/[^"]+"/, `data-wiki-img="${img.id}"`);
  });
}

function restoreBase64Images(content, imageMap) {
  return content.replace(/<img([^>]*)data-wiki-img="([^"]+)"([^>]*)>/gi, (_full, before, imgId, after) => {
    const img = imageMap.get(imgId);
    if (!img) return _full;
    const cleanBefore = before.replace(/src=""/g, '');
    const cleanAfter = after.replace(/src=""/g, '');
    return `<img${cleanBefore}src="data:${img.mime};base64,${img.data}"${cleanAfter}>`;
  });
}

const images = extractBase64Images(content);
console.log("images extracted:", images.length);
const replaced = replaceBase64WithPlaceholders(content, images);
console.log("replaced:", replaced);
const map = new Map();
map.set(images[0].id, images[0]);
const restored = restoreBase64Images(replaced, map);
console.log("restored:", restored);

const oldContent = '<img alt="foo" src="" data-wiki-img="img-123" class="bar">';
const oldRestored = restoreBase64Images(oldContent, map);
console.log("old restored:", oldRestored);
