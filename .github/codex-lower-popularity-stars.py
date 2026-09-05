from pathlib import Path

path = Path('app/valuation/page.module.css')
text = path.read_text()
old = '''.popularityModalStarButton {
  display: grid;
  place-items: center;
  gap: 0.18rem;
  min-height: 76px;
'''
new = '''.popularityModalStarButton {
  display: grid;
  place-items: center;
  align-content: end;
  gap: 0.18rem;
  min-height: 76px;
  padding: 0.25rem 0.5rem 0.18rem;
  box-sizing: border-box;
'''
if old not in text:
    raise RuntimeError('Popularity modal star button block not found')
text = text.replace(old, new, 1)
path.write_text(text)
