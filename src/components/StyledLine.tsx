import { type ReactNode, useEffect, useRef, useState } from "react";
import type { Line, LineProvider, LocalizedLine, MarkupAttribute } from "@yarnspinnertool/core";

interface StyledLineProps {
  line: Line;
  lineProvider: LineProvider | undefined;
  stringTableHash: number;
  typewriterSpeed?: number;   // chars/sec, 0 = instant
  isLatest?: boolean;         // only animate the newest line
  onTypewriterComplete?: () => void;  // fired when reveal finishes
  skipRequested?: boolean;    // when true, instantly reveal all text
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

const isBold = (name: string) => name === "bold" || name === "b";
const isItalic = (name: string) => name === "italic" || name === "i";
const isWave = (name: string) => name === "wave";
const isShake = (name: string) => name === "shake";
const isColor = (name: string) => name === "color";

/**
 * Renders a substring of the plain text with bold/italic/wave/shake/color markup applied.
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
  const styled = attrs.filter(
    (a) =>
      (isBold(a.name) || isItalic(a.name) || isWave(a.name) || isShake(a.name) || isColor(a.name)) &&
      a.length > 0 &&
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
    let wave = false;
    let shake = false;
    let colorValue: string | null = null;

    for (const a of styled) {
      if (absPos >= a.position && absPos < a.position + a.length) {
        if (isBold(a.name)) bold = true;
        if (isItalic(a.name)) italic = true;
        if (isWave(a.name)) wave = true;
        if (isShake(a.name)) shake = true;
        if (isColor(a.name)) {
          const val = a.properties?.[a.name] ?? a.properties?.color;
          if (typeof val === "string") colorValue = val;
        }
      }
    }

    const slice = text.slice(start, end);

    // If wave or shake is active, split into per-character spans
    if (wave || shake) {
      const chars = slice.split("").map((ch, ci) => {
        const charAbsPos = absPos + ci;
        const className = wave ? "yarn-wave-char" : "yarn-text-shake-char";
        const delayS = wave
          ? charAbsPos * 0.05
          : charAbsPos * 0.03;
        return (
          <span
            key={ci}
            className={className}
            style={{ animationDelay: `${delayS}s` }}
          >
            {ch === " " ? "\u00A0" : ch}
          </span>
        );
      });

      let content: ReactNode = <>{chars}</>;
      if (bold && italic) content = <strong><em>{content}</em></strong>;
      else if (bold) content = <strong>{content}</strong>;
      else if (italic) content = <em>{content}</em>;
      if (colorValue) content = <span style={{ color: colorValue }}>{content}</span>;
      return <span key={i}>{content}</span>;
    }

    // No wave/shake — normal inline rendering
    let content: ReactNode = slice;
    if (bold && italic) content = <strong><em>{content}</em></strong>;
    else if (bold) content = <strong>{content}</strong>;
    else if (italic) content = <em>{content}</em>;
    if (colorValue) content = <span style={{ color: colorValue }}>{content}</span>;

    return <span key={i}>{content}</span>;
  });
}

/**
 * Compute the delay (in ms) before revealing the character at `absPos`.
 */
function getDelayAt(
  absPos: number,
  attrs: MarkupAttribute[],
  baseSpeed: number,
): number {
  // Check for [pause/] at this position (self-closing, length === 0)
  const pauseAttr = attrs.find(
    a => a.name === "pause" && a.length === 0 && a.position === absPos,
  );
  if (pauseAttr) {
    return 500;
  }

  // Check for [speed=N] covering this position
  const speedAttr = attrs.find(
    a => a.name === "speed" &&
      a.position <= absPos && a.position + a.length > absPos,
  );
  if (speedAttr) {
    const val = Number(speedAttr.properties?.[speedAttr.name] ?? speedAttr.properties?.speed);
    if (!isNaN(val) && val > 0) {
      return 1000 / val;
    }
  }

  return 1000 / baseSpeed;
}

export function StyledLine(props: StyledLineProps) {
  const [localisedLine, setLocalisedLine] = useState<LocalizedLine>();
  const [revealedLength, setRevealedLength] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(props.onTypewriterComplete);
  onCompleteRef.current = props.onTypewriterComplete;

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

  // Determine the dialogue length for typewriter
  const parsed = localisedLine?.text ? parseCharacterName(localisedLine.text) : null;
  const dialogueLength = parsed?.dialogue.length ?? 0;
  const dialogueOffset = parsed?.dialogueOffset ?? 0;
  const attributes = localisedLine?.attributes ?? [];

  const shouldAnimate = !!props.isLatest && !!props.typewriterSpeed && props.typewriterSpeed > 0;

  // Reset revealedLength when localised line changes (new line loaded)
  useEffect(() => {
    if (shouldAnimate) {
      setRevealedLength(0);
    }
  }, [localisedLine]);

  // Run the typewriter using a setTimeout chain for per-character delays
  useEffect(() => {
    if (!shouldAnimate || dialogueLength === 0) {
      return;
    }

    if (revealedLength >= dialogueLength) {
      return;
    }

    const baseSpeed = props.typewriterSpeed!;

    const revealNext = () => {
      setRevealedLength(prev => {
        const next = prev + 1;
        if (next >= dialogueLength) {
          onCompleteRef.current?.();
          return next;
        }
        // Schedule next character with position-aware delay
        const delay = getDelayAt(next + dialogueOffset, attributes, baseSpeed);
        timeoutRef.current = setTimeout(revealNext, delay);
        return next;
      });
    };

    // Kick off with the delay for the current position
    const initialDelay = getDelayAt(revealedLength + dialogueOffset, attributes, baseSpeed);
    timeoutRef.current = setTimeout(revealNext, initialDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [shouldAnimate, dialogueLength, props.typewriterSpeed, localisedLine]);

  // Handle skip request
  useEffect(() => {
    if (props.skipRequested && shouldAnimate && dialogueLength > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setRevealedLength(dialogueLength);
      onCompleteRef.current?.();
    }
  }, [props.skipRequested, shouldAnimate, dialogueLength]);

  if (!localisedLine?.text || !parsed) {
    return null;
  }

  // Determine the dialogue text to render (truncated if typewriter is active)
  const isRevealing = shouldAnimate && revealedLength < dialogueLength;
  const visibleDialogue = isRevealing
    ? parsed.dialogue.slice(0, revealedLength)
    : parsed.dialogue;

  if (parsed.characterName) {
    return (
      <>
        <span className="text-[#79A5B7] dark:text-[#9BC5D7] font-semibold">{parsed.characterName}:</span>
        <span className="text-[#2D1F30] dark:text-[#E0D8E2]"> {renderWithMarkup(visibleDialogue, attributes, parsed.dialogueOffset)}</span>
      </>
    );
  }

  // No character name, just render the text
  return <span className="text-[#2D1F30] dark:text-[#E0D8E2]">{renderWithMarkup(visibleDialogue, attributes, 0)}</span>;
}
