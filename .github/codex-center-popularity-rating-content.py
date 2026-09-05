from pathlib import Path

path = Path('app/valuation/page.module.css')
text = path.read_text()

old_button = '''.popularityModalStarButton {
  display: grid;
  place-items: center;
  align-content: end;
  gap: 0.18rem;
  min-height: 76px;
  padding: 0.25rem 0.5rem 0.18rem;
  box-sizing: border-box;
'''
new_button = '''.popularityModalStarButton {
  display: grid;
  grid-template-rows: auto auto;
  place-items: center;
  align-content: center;
  justify-items: center;
  gap: 0.18rem;
  min-height: 76px;
  padding: 0.55rem 0.5rem;
  box-sizing: border-box;
'''
if old_button not in text:
    raise RuntimeError('Popularity star button block not found')
text = text.replace(old_button, new_button, 1)

old_glyph = '''.popularityModalStarGlyph {
  font-size: 1.7rem;
  line-height: 1;
  transform: translateY(6px);
}
'''
new_glyph = '''.popularityModalStarGlyph {
  display: block;
  font-size: 1.7rem;
  line-height: 1;
  transform: none;
}
'''
if old_glyph not in text:
    raise RuntimeError('Popularity star glyph block not found')
text = text.replace(old_glyph, new_glyph, 1)

old_small = '''.popularityModalStarButton small {
  color: currentColor;
  font-size: 0.72rem;
  font-weight: 850;
}
'''
new_small = '''.popularityModalStarButton small {
  display: block;
  margin: 0;
  color: currentColor;
  font-size: 0.72rem;
  font-weight: 850;
  line-height: 1;
  text-align: center;
}
'''
if old_small not in text:
    raise RuntimeError('Popularity star number block not found')
text = text.replace(old_small, new_small, 1)

path.write_text(text)
