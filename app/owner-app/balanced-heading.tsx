type BalancedHeadingTextProps = {
  text: string;
};

/**
 * Keeps a useful group of words together at the end of a heading so narrow
 * mobile layouts do not leave one or two orphaned words on the final line.
 */
export default function BalancedHeadingText({ text }: BalancedHeadingTextProps) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 3) return <>{text}</>;

  if (/^(?:19|20)\d{2}$/.test(words[0])) {
    return <>{`${words[0]}\u00A0${words.slice(1).join(' ')}`}</>;
  }

  const tailWordCount = Math.max(3, Math.ceil((words.length + 1) / 2));
  const splitAt = Math.max(1, words.length - tailWordCount);
  const leadingWords = words.slice(0, splitAt).join(' ');
  const trailingWords = words.slice(splitAt).join(' ');

  return (
    <>
      <span style={{ display: 'block' }}>{leadingWords}</span>
      <span
        style={{
          display: 'block',
          maxWidth: '100%',
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          textWrap: 'balance',
        }}
      >
        {trailingWords}
      </span>
    </>
  );
}
