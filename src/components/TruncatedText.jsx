const MAX_DISPLAY_CHARACTERS = 75;

export default function TruncatedText({ text, as: Element = 'span', className }) {
  const fullText = text == null ? '' : String(text);
  const characters = Array.from(fullText);
  const isTruncated = characters.length > MAX_DISPLAY_CHARACTERS;
  const displayText = isTruncated
    ? `${characters.slice(0, MAX_DISPLAY_CHARACTERS).join('')}...`
    : fullText;

  return (
    <Element className={className} title={fullText || undefined}>
      {displayText}
    </Element>
  );
}
