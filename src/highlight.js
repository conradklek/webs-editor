const syntaxRules = [
  { style: "string", regex: /(['"`])(?:\\.|[^\\])*?\1/g },
  {
    style: "keyword",
    regex:
      /\b(const|let|var|function|if|else|return|import|from|export|new|class|super|extends|async|await|try|catch|finally|for|while|do|switch|case|default|break|continue)\b/g,
  },
  { style: "specialChar", regex: /[\[\](){}+\-.,;:=<>*\/%&|!?~^]/g },
];

export function highlight(line, language) {
  if (language !== "js") {
    if (line === "") return [];
    return [{ text: line, style: "text" }];
  }

  let segments = [{ text: line, style: "text" }];
  syntaxRules.forEach((rule) => {
    let newSegments = [];
    segments.forEach((segment) => {
      if (segment.style !== "text") {
        newSegments.push(segment);
        return;
      }
      const text = segment.text;
      let lastIndex = 0;
      let match;
      rule.regex.lastIndex = 0;
      while ((match = rule.regex.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = rule.regex.lastIndex;
        if (startIndex > lastIndex) {
          newSegments.push({
            text: text.substring(lastIndex, startIndex),
            style: "text",
          });
        }
        newSegments.push({
          text: match[0],
          style: rule.style,
        });
        lastIndex = endIndex;
      }
      if (lastIndex < text.length) {
        newSegments.push({
          text: text.substring(lastIndex),
          style: "text",
        });
      }
    });
    segments = newSegments;
  });
  if (segments.length === 1 && segments[0].text === "") {
    return [];
  }
  return segments;
}
