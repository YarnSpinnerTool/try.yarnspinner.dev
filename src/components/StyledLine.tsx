import { useEffect, useState } from "react";
import type { Line, LineProvider, LocalizedLine } from "@yarnspinnertool/core";

interface StyledLineProps {
  line: Line;
  lineProvider: LineProvider | undefined;
  stringTableHash: string;
}

function parseCharacterName(text: string): { characterName: string | null; dialogue: string } {
  let i = 0;
  let charName = '';

  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      // Escaped character, skip both
      charName += text[i] + text[i + 1];
      i += 2;
    } else if (text[i] === ':') {
      // Found unescaped colon
      if (charName.trim().length > 0) {
        return {
          characterName: charName.trim(),
          dialogue: text.slice(i + 1).trim()
        };
      }
      break;
    } else {
      charName += text[i];
      i++;
    }
  }

  // No character name found
  return { characterName: null, dialogue: text };
}

export function StyledLine(props: StyledLineProps) {
  const [localisedLine, setLocalisedLine] = useState<LocalizedLine>();

  useEffect(() => {
    let ignore = false;

    props.lineProvider?.getLocalizedLine(props.line).then((localisedLine) => {
      if (ignore) {
        return;
      }

      setLocalisedLine(localisedLine);
    });

    return () => {
      ignore = true;
    };
  }, [props.line, props.lineProvider, props.stringTableHash]);

  if (!localisedLine?.text) {
    return null;
  }

  const parsed = parseCharacterName(localisedLine.text);

  if (parsed.characterName) {
    return (
      <>
        <span style={{ color: '#79A5B7', fontWeight: 600 }}>{parsed.characterName}</span>
        <span style={{ color: '#2D1F30' }}>: {parsed.dialogue}</span>
      </>
    );
  }

  // No character name, just render the text
  return <span style={{ color: '#2D1F30' }}>{localisedLine.text}</span>;
}
