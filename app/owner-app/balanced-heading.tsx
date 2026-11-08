type BalancedHeadingTextProps = {
  text: string;
};

/** Let the available width decide wrapping; keep the year with the asset brand. */
export default function BalancedHeadingText({ text }: BalancedHeadingTextProps) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && /^(?:19|20)\d{2}$/.test(words[0])) {
    return <>{`${words[0]}\u00A0${words.slice(1).join(' ')}`}</>;
  }
  return <>{words.join(' ')}</>;
}
