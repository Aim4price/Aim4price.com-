from pathlib import Path

path = Path('app/valuation/page.module.css')
text = path.read_text()
old = '''.popularityModalStarGlyph {
  font-size: 1.7rem;
  line-height: 1;
}
'''
new = '''.popularityModalStarGlyph {
  font-size: 1.7rem;
  line-height: 1;
  transform: translateY(6px);
}
'''
if old not in text:
    raise RuntimeError('Popularity star glyph rule not found')
path.write_text(text.replace(old, new, 1))
