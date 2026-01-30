import { type ReactNode, useEffect, useState } from "react";
import type { Line, LineProvider, LocalizedLine, MarkupAttribute } from "@yarnspinnertool/core";

interface StyledLineProps {
  line: Line;
  lineProvider: LineProvider | undefined;
  stringTableHash: number;
}

interface ParsedName {
  characterName: string | null;
  dialogue: string;
  /** Index in the full plain text where `dialogue` begins. */
  dialogueOffset: number;
}

function parseCharacterName(text: string): ParsedName {
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
        const afterColon = text.slice(i + 1);
        const trimmed = afterColon.trimStart();
        const dialogueOffset = i + 1 + (afterColon.length - trimmed.length);
        return {
          characterName: charName.trim(),
          dialogue: trimmed,
          dialogueOffset,
        };
      }
      break;
    } else {
      charName += text[i];
      i++;
    }
  }

  // No character name found
  return { characterName: null, dialogue: text, dialogueOffset: 0 };
}

/**
 * Renders a substring of the plain text with bold/italic markup applied.
 *
 * @param text      The substring to render.
 * @param attrs     The full attribute list from the parsed line.
 * @param offset    Where `text` begins within the full plain text.
 */
function renderWithMarkup(
  text: string,
  attrs: MarkupAttribute[],
  offset: number,
): ReactNode {
  const isBold = (name: string) => name === "bold" || name === "b";
  const isItalic = (name: string) => name === "italic" || name === "i";

  const styled = attrs.filter(
    (a) =>
      (isBold(a.name) || isItalic(a.name)) &&
      a.position < offset + text.length &&
      a.position + a.length > offset,
  );

  if (styled.length === 0) return text;

  // Collect break-points relative to `text`
  const pts = new Set<number>();
  pts.add(0);
  pts.add(text.length);
  for (const a of styled) {
    pts.add(Math.max(0, a.position - offset));
    pts.add(Math.min(text.length, a.position + a.length - offset));
  }
  const sorted = Array.from(pts).sort((a, b) => a - b);

  return sorted.slice(0, -1).map((start, i) => {
    const end = sorted[i + 1];
    if (start >= end) return null;

    const absPos = start + offset;
    let bold = false;
    let italic = false;
    for (const a of styled) {
      if (absPos >= a.position && absPos < a.position + a.length) {
        if (isBold(a.name)) bold = true;
        if (isItalic(a.name)) italic = true;
      }
    }

    const slice = text.slice(start, end);
    if (bold && italic) return <strong key={i}><em>{slice}</em></strong>;
    if (bold) return <strong key={i}>{slice}</strong>;
    if (italic) return <em key={i}>{slice}</em>;
    return <span key={i}>{slice}</span>;
  });
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
    }).catch(() => {
      // Markup parse failed — show the raw substituted text as a fallback
      if (!ignore) {
        const raw = (props.lineProvider as any)?.stringTable?.[props.line.id];
        if (raw) {
          setLocalisedLine({ text: raw, attributes: [], id: props.line.id, metadata: [] });
        }
      }
    });

    return () => {
      ignore = true;
    };
  }, [props.line, props.lineProvider, props.stringTableHash]);

  if (!localisedLine?.text) {
    return null;
  }

  const parsed = parseCharacterName(localisedLine.text);
  const attributes = localisedLine.attributes ?? [];

  if (parsed.characterName) {
    return (
      <>
        <span className="text-[#79A5B7] dark:text-[#9BC5D7] font-semibold">{parsed.characterName}:</span>
        <span className="text-[#2D1F30] dark:text-[#E0D8E2]"> {renderWithMarkup(parsed.dialogue, attributes, parsed.dialogueOffset)}</span>
      </>
    );
  }

  // No character name, just render the text
  return <span className="text-[#2D1F30] dark:text-[#E0D8E2]">{renderWithMarkup(localisedLine.text, attributes, 0)}</span>;
}
