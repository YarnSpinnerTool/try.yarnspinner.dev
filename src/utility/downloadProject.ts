/**
 * Download Project as Zip
 *
 * Creates a zip file containing:
 * - The .yarn script file
 * - A valid .yarnproject file
 */

import JSZip from 'jszip';

const DEFAULT_YARN_PROJECT = {
  projectFileVersion: 3,
  sourceFiles: ["**/*.yarn"],
  baseLanguage: "en",
};

/**
 * Download the current script as a project zip file
 */
export async function downloadProject(scriptContent: string, projectName: string = 'YarnProject'): Promise<void> {
  const zip = new JSZip();

  // Add the .yarn script file
  zip.file(`${projectName}.yarn`, scriptContent);

  // Add the .yarnproject file
  const yarnProjectContent = JSON.stringify(DEFAULT_YARN_PROJECT, null, 2);
  zip.file(`${projectName}.yarnproject`, yarnProjectContent);

  // Generate the zip and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
