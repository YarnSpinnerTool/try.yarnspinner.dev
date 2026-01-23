/**
 * Load a sample Yarn file from the samples directory
 */

export interface Sample {
  id: string;
  name: string;
  description: string;
  filename: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'empty-script',
    name: 'Empty Script',
    description: 'A minimal starting point',
    filename: 'EmptyScript.yarn',
  },
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Introduction to Yarn Spinner basics',
    filename: 'GettingStarted.yarn',
  },
  {
    id: 'linear-story',
    name: 'Linear Story',
    description: 'Scene-by-scene narrative progression',
    filename: 'LinearStory.yarn',
  },
  {
    id: 'branching-dialogue',
    name: 'Branching Dialogue',
    description: 'Choices lead to different story paths',
    filename: 'BranchingDialogue.yarn',
  },
  {
    id: 'hub-and-spoke',
    name: 'Hub & Spoke',
    description: 'Central location with explorable branches',
    filename: 'HubAndSpoke.yarn',
  },
  {
    id: 'smart-line-selection',
    name: 'Smart Line Selection',
    description: 'Dynamic dialogue using saliency',
    filename: 'SmartLineSelection.yarn',
  },
];

export async function loadSample(filename: string): Promise<string> {
  const response = await fetch(`/samples/${filename}`);

  if (!response.ok) {
    throw new Error(`Failed to load sample: ${response.statusText}`);
  }

  return await response.text();
}
