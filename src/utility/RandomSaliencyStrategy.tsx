import type {
  ContentSaliencyStrategy,
  ContentSaliencyOption,
} from "@yarnspinnertool/core";

// The 'Random' strategy isn't built-in to Yarn Spinner, but it's simple enough
// to add - it just needs to choose randomly from the set of options that aren't
// failing.

export class RandomSaliencyStrategy implements ContentSaliencyStrategy {
  queryBestContent(
    content: ContentSaliencyOption[],
  ): ContentSaliencyOption | null {
    // Get rid of any content that has a failing condition
    const allowedContent = content.filter(
      (c) => c.failingConditionValueCount == 0,
    );

    // None left? Return null.
    if (allowedContent.length == 0) {
      return null;
    }

    // Pick a random item from the resulting set.
    return allowedContent[Math.floor(Math.random() * allowedContent.length)];
  }
  contentWasSelected(): void {
    // No-op - we don't need to take any action when content is actually used
  }
}
