function renderInline(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={`${match.index}-b`} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <em key={`${match.index}-i`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MarkdownContent({ content }) {
  const blocks = String(content || '')
    .trim()
    .split(/\n{2,}/);

  return (
    <div className="space-y-3 text-base leading-relaxed text-ink/90">
      {blocks.map((block, index) => {
        const line = block.trim();
        if (line.startsWith('## ')) {
          return (
            <h3 key={index} className="font-display text-lg font-semibold text-ink">
              {line.replace(/^##\s+/, '')}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h3 key={index} className="font-display text-xl font-semibold text-ink">
              {line.replace(/^#\s+/, '')}
            </h3>
          );
        }
        if (line.startsWith('- ')) {
          const items = line.split('\n').filter((item) => item.startsWith('- '));
          return (
            <ul
              key={index}
              className="list-disc space-y-1.5 pl-5 text-moss marker:text-clay"
            >
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item.replace(/^- /, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-moss">
            {renderInline(line.replace(/\n/g, ' '))}
          </p>
        );
      })}
    </div>
  );
}
