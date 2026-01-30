import { YarnSpinner } from "backend";

import { VariableStorage, YarnValue } from "@yarnspinnertool/core";

import { Runner, YarnStoryHandle } from "../components/Runner";
import { LspService } from "../language";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { AppHeader } from "../components/AppHeader";
import { ButtonGroup, ButtonGroupItem } from "../components/ButtonGroup";
import CodeMirrorEditor, { type CodeMirrorEditorHandle } from "../components/CodeMirrorEditor";
import { VariableView } from "../components/VariableView";
import { HelpPanel } from "../components/HelpPanel";
import { AboutPanel } from "../components/AboutPanel";
import { compilationDebounceMilliseconds, scriptKey } from "../config.json";
import c from "../utility/classNames";
import { downloadStandaloneRunner } from "../utility/downloadStandaloneRunner";
import { useDebouncedCallback } from "../utility/useDebouncedCallback";
import { YarnStorageContext } from "../YarnStorageContext";
import { fetchInitialContent, type InitialContentResult } from "../utility/fetchInitialContent";
import { loadFromDisk } from "../utility/loadFromDisk";
import { fetchGist } from "../utility/fetchGist";
import { extractGistId } from "../utility/extractGistId";
import { loadSample, SAMPLES } from "../utility/loadSample";
import { downloadProject } from "../utility/downloadProject";

import { backendPromise, onBackendStatusChange, BackendStatus, retryBackendLoad, getBackendStatus } from "../utility/loadBackend";
import { Button } from "../components/Button";
import * as images from "../img";
import { GitHubAuthDialog } from "../components/GitHubAuthDialog";
import { GistBrowser } from "../components/GistBrowser";
import { getAuthState, clearToken, createGist, listGists, type GitHubAuthState } from "../utility/githubAuth";

type InitialContentLoadingState =
  | {
      state: "loading" | "error";
    }
  | { state: "loaded"; value: string; source: 'gist' | 'localStorage' | 'default' };

type ViewMode = "code" | "game";

export function TryYarnSpinner() {
  const [state, setState] = useState<{
    compilationResult?: YarnSpinner.CompilationResult;
    compilationVersion: number;
  }>({ compilationVersion: 0 });

  const [backendStatus, setBackendStatus] = useState<BackendStatus>('loading');

  const [viewMode, setViewMode] = useState<ViewMode>("code");

  // Track if user has tapped Play tab before (for first-time UX hint)
  const [hasPlayedBefore, setHasPlayedBefore] = useState(() => {
    return localStorage.getItem('hasPlayedBefore') === 'true';
  });

  // Detect if we're on mobile (play pane not visible by default)
  const [isMobile, setIsMobile] = useState(() => {
    return window.innerWidth < 768; // sm breakpoint
  });

  // Drag and drop state
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Track if content has been modified (for confirmation dialogs)
  const [isChanged, setIsChanged] = useState(false);

  // Flag to skip marking as changed during programmatic loads
  const isProgrammaticLoadRef = useRef(false);

  // Load confirmation dialog state
  type PendingLoadAction =
    | { type: 'new' }
    | { type: 'drop'; content: string }
    | { type: 'disk'; loader: () => Promise<string> }
    | { type: 'gist'; gistId: string }
    | { type: 'sample'; filename: string };
  const [pendingLoadAction, setPendingLoadAction] = useState<PendingLoadAction | null>(null);
  const [showLoadConfirmDialog, setShowLoadConfirmDialog] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePlayTabClick = useCallback(() => {
    setViewMode("game");
    if (!hasPlayedBefore) {
      setHasPlayedBefore(true);
      localStorage.setItem('hasPlayedBefore', 'true');
    }
  }, [hasPlayedBefore]);

  const onEdited = useDebouncedCallback(async (value: string | undefined) => {
    if (value === undefined) {
      // No content
      return;
    }

    // Mark as changed when user edits (but not during programmatic loads)
    if (!isProgrammaticLoadRef.current) {
      setIsChanged(true);
      // Stop playback when the user edits the script
      if (isRunning) {
        handleStop();
      }
    }

    // Store script in local storage, or clear it if empty
    if (value.trim().length === 0) {
      window.localStorage.removeItem(scriptKey);
    } else {
      window.localStorage.setItem(scriptKey, value);
    }

    compileYarnScript(value);
  }, compilationDebounceMilliseconds);

  const compileYarnScript = useCallback(async (source: string) => {
    await backendPromise;

    // Check if backend loaded successfully using module-level state (not React state which may be stale)
    if (getBackendStatus() !== 'ready') {
      console.log("Backend not ready, skipping compilation");
      return;
    }

    console.log("Compiling...");

    let result: YarnSpinner.CompilationResult;
    try {
      result = await YarnSpinner.compileAsync({ source });
    } catch (error) {
      // If compilation throws, create a synthetic error result instead of crashing
      console.error("Compilation threw an exception:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error && error.stack ? `\n\nStack trace:\n${error.stack}` : '';
      result = {
        info: "",
        programData: undefined,
        programHash: 0,
        stringTable: {},
        stringTableHash: 0,
        diagnostics: [{
          fileName: "input",
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          message: `Internal compiler error: ${errorMessage}`,
          context: stackTrace, // Store stack trace in context field for copying
          severity: YarnSpinner.DiagnosticSeverity.Error,
        }],
        nodes: {},
        variableDeclarations: {},
        typeDeclarations: {},
      };
    }

    if (result.programData) {
      console.log("Compilation success");
    } else {
      console.log("Compilation failure");
    }

    setState(prev => ({
      compilationResult: result,
      compilationVersion: prev.compilationVersion + 1,
    }));

    // Feed compilation result to LSP service (avoids a redundant WASM compile)
    LspService.updateFromCompilationResult(source, result);

    return result;
  }, []);

  const [initialContentState, setInitialContentState] =
    useState<InitialContentLoadingState>({
      state: "loading",
    });

  useEffect(() => {
    let ignore = false;

    fetchInitialContent().then((result) => {
      if (ignore) {
        return;
      }
      setInitialContentState({ state: "loaded", value: result.content, source: result.source });
      // Content from localStorage is considered "changed" (user's work in progress)
      // Content from gist or default is not (can be reloaded)
      setIsChanged(result.source === 'localStorage');
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (initialContentState.state === "loaded") {
      compileYarnScript(initialContentState.value);
    }
  }, [compileYarnScript, initialContentState]);

  // Track backend loading status
  useEffect(() => {
    const unsubscribe = onBackendStatusChange((status) => {
      setBackendStatus(status);
    });
    return unsubscribe;
  }, []);

  // Initialize LSP service when backend is ready
  useEffect(() => {
    if (backendStatus === 'ready') {
      LspService.initialize();
    }
  }, [backendStatus]);

  const updateVariableDisplay = useCallback((name: string, val: YarnValue) => {
    console.log(`Updated ${name} to ${val}`);
    setStorageContentsVersion((v) => v + 1);
  }, []);

  const storage = useRef<VariableStorage>({});

  const [, setStorageContentsVersion] = useState(0);

  const playerRef = useRef<YarnStoryHandle>(null);
  const [isRunning, setIsRunning] = useState(false);

  const editorRef = useRef<CodeMirrorEditorHandle>(null);

  // Save or clear localStorage before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const currentContent = editorRef.current?.getValue();
      if (currentContent !== undefined) {
        if (currentContent.trim().length === 0) {
          window.localStorage.removeItem(scriptKey);
        } else {
          window.localStorage.setItem(scriptKey, currentContent);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handlePlay = useCallback(async () => {
    // Get current editor content and compile it immediately (bypass debounce)
    const currentContent = editorRef.current?.getValue();
    if (!currentContent) {
      return;
    }

    const result = await compileYarnScript(currentContent);

    // Only proceed if compilation succeeded
    if (!result) {
      return;
    }

    // Switch to game mode
    setViewMode("game");
    setIsRunning(true);

    // Wait for Runner to mount (up to 500ms)
    for (let i = 0; i < 10; i++) {
      if (playerRef.current) break;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    if (!playerRef.current) {
      console.warn("Runner did not mount in time");
      return;
    }

    // Load and start with the fresh result
    playerRef.current.loadAndStart(result);
  }, [compileYarnScript]);

  const handleStop = useCallback(() => {
    playerRef.current?.stop();
    setIsRunning(false);
  }, []);

  // Execute a load action (called directly or after confirmation)
  const executeLoadAction = useCallback(async (action: NonNullable<typeof pendingLoadAction>, autoPlay: boolean = false) => {
    try {
      let content: string;
      let markAsChanged = true; // Default: loading from disk/drop marks as changed

      switch (action.type) {
        case 'new':
          content = await loadSample('EmptyScript.yarn');
          markAsChanged = false;
          localStorage.removeItem(scriptKey);
          break;
        case 'drop':
          content = action.content;
          markAsChanged = true;
          break;
        case 'disk':
          content = await action.loader();
          markAsChanged = true;
          break;
        case 'gist':
          content = await fetchGist(action.gistId);
          markAsChanged = false; // Can reload from gist
          // Update URL to include gist ID
          {
            const gistUrl = new URL(window.location.href);
            gistUrl.searchParams.set('gist', action.gistId);
            window.history.pushState({}, '', gistUrl.toString());
          }
          break;
        case 'sample':
          content = await loadSample(action.filename);
          markAsChanged = false; // Can reload from sample
          autoPlay = true; // Samples always auto-play
          break;
      }

      // Set flag to prevent onEdited from marking as changed during programmatic load
      isProgrammaticLoadRef.current = true;
      editorRef.current?.setValue(content);
      setIsChanged(markAsChanged);

      // Clear the flag after the debounce period
      setTimeout(() => {
        isProgrammaticLoadRef.current = false;
      }, compilationDebounceMilliseconds + 50);

      // Compile the loaded content
      const result = await compileYarnScript(content);

      // Auto-play if requested and compilation succeeded
      if (autoPlay && result?.programData) {
        setViewMode("game");
        setIsRunning(true);
        // Wait for Runner to mount (up to 500ms)
        for (let i = 0; i < 10; i++) {
          if (playerRef.current) break;
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        if (!playerRef.current) {
          console.warn("Runner did not mount in time");
          return;
        }
        playerRef.current.loadAndStart(result);
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'File selection cancelled') {
        return; // User cancelled, not an error
      }
      console.error('Failed to load:', error);

      // User-friendly error messages
      if (action.type === 'gist') {
        let userMessage = 'Could not load the Gist. ';
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('not found') || msg.includes('404')) {
            userMessage += 'The Gist ID or URL does not exist.';
          } else if (msg.includes('truncated')) {
            userMessage += 'The Gist file is too large.';
          } else if (msg.includes('network') || msg.includes('fetch')) {
            userMessage += 'Network error. Check your connection.';
          } else {
            userMessage += 'Please try again.';
          }
        }
        alert(userMessage);
      } else if (action.type === 'sample') {
        alert('Could not load the sample. Please try again.');
      } else if (action.type === 'disk') {
        alert('Could not load the file. Please make sure it\'s a valid text file.');
      }
    }
  }, [compileYarnScript]);

  // Request a load - shows confirmation if content has changed and editor is not empty
  const requestLoad = useCallback((action: NonNullable<typeof pendingLoadAction>) => {
    const currentContent = editorRef.current?.getValue() || '';
    const isEmpty = currentContent.trim().length === 0;

    if (isChanged && !isEmpty) {
      setPendingLoadAction(action);
      setShowLoadConfirmDialog(true);
    } else {
      executeLoadAction(action);
    }
  }, [isChanged, executeLoadAction]);

  // Drag and drop file handling
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingFile(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDraggingFile(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingFile(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        // Accept .yarn files or any text file
        if (file.name.endsWith('.yarn') || file.type.startsWith('text/')) {
          try {
            const content = await file.text();
            // Use requestLoad which handles the isChanged check
            requestLoad({ type: 'drop', content });
          } catch (error) {
            console.error('Failed to read dropped file:', error);
          }
        }
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [requestLoad]);

  const handleLoadFromDisk = useCallback(() => {
    // Create a loader function that will be called after confirmation (if needed)
    const loader = async () => {
      return await loadFromDisk();
    };
    requestLoad({ type: 'disk', loader });
  }, [requestLoad]);

  const handleLoadFromGist = useCallback(() => {
    const input = prompt('Enter GitHub Gist URL or ID:');
    if (!input) {
      return;
    }
    try {
      const gistId = extractGistId(input);
      requestLoad({ type: 'gist', gistId });
    } catch (error) {
      alert('Invalid Gist URL or ID.');
    }
  }, [requestLoad]);

  const handleLoadSample = useCallback((filename: string) => {
    requestLoad({ type: 'sample', filename });
  }, [requestLoad]);

  const handleNew = useCallback(() => {
    requestLoad({ type: 'new' });
  }, [requestLoad]);

  // Check if there are any compilation errors
  const hasErrors = state.compilationResult?.diagnostics.some(
    d => d.severity === YarnSpinner.DiagnosticSeverity.Error
  ) ?? false;

  // Stop running if compilation has errors or program becomes invalid
  useEffect(() => {
    if (isRunning && (hasErrors || !state.compilationResult?.programData)) {
      handleStop();
    }
  }, [hasErrors, state.compilationResult?.programData, isRunning, handleStop]);

  // State for help panel visibility
  const [showHelpPanel, setShowHelpPanel] = useState(false);

  // State for about panel visibility
  const [showAboutPanel, setShowAboutPanel] = useState(false);

  // Compiler version (fetched from backend)
  const [compilerVersion, setCompilerVersion] = useState<string | undefined>();

  // Get compiler version when backend is ready
  useEffect(() => {
    if (backendStatus === 'ready') {
      // Get version from backend
      try {
        const version = YarnSpinner.getVersion();
        if (version) {
          setCompilerVersion(version);
        }
      } catch (e) {
        console.warn('Could not get compiler version:', e);
      }
    }
  }, [backendStatus]);

  // GitHub auth state
  const [githubAuthState, setGithubAuthState] = useState<GitHubAuthState | null>(null);
  const [showGitHubAuthDialog, setShowGitHubAuthDialog] = useState(false);
  const [showGistBrowser, setShowGistBrowser] = useState(false);

  // Load GitHub auth state on mount
  useEffect(() => {
    getAuthState().then(setGithubAuthState);
  }, []);

  // GitHub handlers
  const handleGitHubLogin = useCallback(() => {
    setShowGitHubAuthDialog(true);
  }, []);

  const handleGitHubLogout = useCallback(() => {
    clearToken();
    setGithubAuthState({ isAuthenticated: false, token: null, username: null });
  }, []);

  const handleSaveToGist = useCallback(async () => {
    if (!githubAuthState?.token) {
      setShowGitHubAuthDialog(true);
      return;
    }

    const currentContent = editorRef.current?.getValue();
    if (!currentContent) {
      alert('No content to save');
      return;
    }

    const filename = prompt('Enter filename for gist:', 'script.yarn');
    if (!filename) return;

    const description = prompt('Enter description (optional):', 'Yarn Spinner Script');

    try {
      const gist = await createGist(
        githubAuthState.token,
        filename.endsWith('.yarn') ? filename : `${filename}.yarn`,
        currentContent,
        description || 'Yarn Spinner Script'
      );

      // Update URL to include gist ID
      const url = new URL(window.location.href);
      url.searchParams.set('gist', gist.id);
      window.history.pushState({}, '', url.toString());

      alert(`Saved to gist!\n\nYou can share this URL:\n${window.location.href}\n\nOr view on GitHub:\n${gist.html_url}`);
    } catch (error) {
      console.error('Failed to save gist:', error);
      alert('Failed to save gist. Please try again.');
    }
  }, [githubAuthState]);

  const handleBrowseGists = useCallback(() => {
    if (!githubAuthState?.token) {
      setShowGitHubAuthDialog(true);
      return;
    }
    setShowGistBrowser(true);
  }, [githubAuthState]);

  const handleLoadGistFile = useCallback(async (gistId: string, filename: string) => {
    requestLoad({ type: 'gist', gistId });
  }, [requestLoad]);

  // Load confirmation dialog handlers
  const handleLoadConfirmReplace = useCallback(() => {
    if (pendingLoadAction) {
      executeLoadAction(pendingLoadAction);
    }
    setPendingLoadAction(null);
    setShowLoadConfirmDialog(false);
  }, [pendingLoadAction, executeLoadAction]);

  const handleLoadConfirmDownloadAndReplace = useCallback(async () => {
    // Download existing content first
    const currentContent = editorRef.current?.getValue() || '';
    if (currentContent.trim().length > 0) {
      const blob = new Blob([currentContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MyScript.yarn';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    // Brief delay to allow browser download dialog to process
    await new Promise(resolve => setTimeout(resolve, 200));

    // Then execute the load
    if (pendingLoadAction) {
      executeLoadAction(pendingLoadAction);
    }
    setPendingLoadAction(null);
    setShowLoadConfirmDialog(false);
  }, [pendingLoadAction, executeLoadAction]);

  const handleLoadConfirmCancel = useCallback(() => {
    setPendingLoadAction(null);
    setShowLoadConfirmDialog(false);
  }, []);

  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  // Saliency strategy state
  const [saliencyStrategy, setSaliencyStrategy] = useState<string>(() => {
    return localStorage.getItem('saliencyStrategy') || 'random_best_least_recent';
  });

  // Unavailable options display mode: 'hidden' or 'strikethrough'
  const [unavailableOptionsMode, setUnavailableOptionsMode] = useState<'hidden' | 'strikethrough'>(() => {
    return (localStorage.getItem('unavailableOptionsMode') as 'hidden' | 'strikethrough') || 'hidden';
  });

  // Wait progress bar toggle (default: on)
  const [showWaitProgress, setShowWaitProgress] = useState(() => {
    return localStorage.getItem('showWaitProgress') !== 'false';
  });

  // Dice effects toggle (default: on)
  const [showDiceEffects, setShowDiceEffects] = useState(() => {
    return localStorage.getItem('showDiceEffects') !== 'false';
  });

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Save saliency strategy to localStorage
  useEffect(() => {
    localStorage.setItem('saliencyStrategy', saliencyStrategy);
  }, [saliencyStrategy]);

  // Save unavailable options mode to localStorage
  useEffect(() => {
    localStorage.setItem('unavailableOptionsMode', unavailableOptionsMode);
  }, [unavailableOptionsMode]);

  // Save wait progress preference to localStorage
  useEffect(() => {
    localStorage.setItem('showWaitProgress', String(showWaitProgress));
  }, [showWaitProgress]);

  // Save dice effects preference to localStorage
  useEffect(() => {
    localStorage.setItem('showDiceEffects', String(showDiceEffects));
  }, [showDiceEffects]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(prev => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Cmd/Ctrl + Enter: Run dialogue
      if (cmdOrCtrl && event.key === 'Enter') {
        event.preventDefault();
        if (backendStatus === 'ready' && !hasErrors) {
          handlePlay();
        }
        return;
      }

      // Cmd/Ctrl + S: Save script
      if (cmdOrCtrl && event.key === 's') {
        event.preventDefault();
        editorRef.current?.saveContents();
        return;
      }

      // Escape: Close help panel or about panel
      if (event.key === 'Escape') {
        if (showHelpPanel) {
          event.preventDefault();
          setShowHelpPanel(false);
          return;
        }
        if (showAboutPanel) {
          event.preventDefault();
          setShowAboutPanel(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [backendStatus, hasErrors, handlePlay, viewMode, showHelpPanel, showAboutPanel]);

  return (
    <YarnStorageContext.Provider value={storage.current}>
      <div className="flex h-full w-full flex-col" style={{backgroundColor: darkMode ? '#4C434F' : '#F9F7F9'}}>
        {/* Drag and drop overlay */}
        {isDraggingFile && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
            style={{ backgroundColor: 'rgba(76, 137, 98, 0.15)', backdropFilter: 'blur(4px)' }}
          >
            <div
              className="rounded-2xl shadow-2xl p-8 text-center"
              style={{
                backgroundColor: darkMode ? '#242124' : 'white',
                border: '4px dashed #4C8962'
              }}
            >
              <div
                className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#4C8962' }}
              >
                <img src={images.YarnSpinnerLogoURL} alt="Yarn Spinner" className="h-12 w-auto" />
              </div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#4C8962' }}>Drop to Open</h2>
              <p style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}>Drop your .yarn file to load it</p>
            </div>
          </div>
        )}

        {/* Load confirmation dialog */}
        {showLoadConfirmDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div
              className="rounded-2xl shadow-2xl p-6 max-w-md mx-4"
              style={{ backgroundColor: darkMode ? '#242124' : 'white' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#4C8962' }}
                >
                  <img src={images.YarnSpinnerLogoURL} alt="" className="h-7 w-auto" />
                </div>
                <div>
                  <h2 className="text-xl font-bold" style={{ color: darkMode ? '#F9F7F9' : '#242124' }}>
                    Replace Current Script?
                  </h2>
                  <p className="text-sm" style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}>
                    You have an existing script in the editor
                  </p>
                </div>
              </div>

              <p className="mb-6" style={{ color: darkMode ? '#D1D5DB' : '#4B5563' }}>
                Loading will replace your current script. What would you like to do?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleLoadConfirmDownloadAndReplace}
                  className="w-full px-4 py-3 rounded-lg font-semibold text-white transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#4C8962' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5C9A72'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4C8962'}
                >
                  Download Current & Replace
                </button>
                <button
                  onClick={handleLoadConfirmReplace}
                  className="w-full px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: darkMode ? '#3F3A40' : '#F3F4F6',
                    color: darkMode ? '#F9F7F9' : '#374151'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#534952' : '#E5E7EB'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = darkMode ? '#3F3A40' : '#F3F4F6'}
                >
                  Replace Without Saving
                </button>
                <button
                  onClick={handleLoadConfirmCancel}
                  className="w-full px-4 py-2 rounded-lg font-semibold transition-colors"
                  style={{ color: darkMode ? '#9CA3AF' : '#6B7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = darkMode ? '#F9F7F9' : '#374151'}
                  onMouseLeave={(e) => e.currentTarget.style.color = darkMode ? '#9CA3AF' : '#6B7280'}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <AppHeader
          onNew={handleNew}
          onSaveScript={editorRef.current?.saveContents}
          onLoadFromDisk={handleLoadFromDisk}
          onLoadFromGist={handleLoadFromGist}
          onLoadSample={handleLoadSample}
          samples={SAMPLES}
          onPlay={backendStatus === 'ready' && !hasErrors ? handlePlay : undefined}
          onStop={handleStop}
          isRunning={isRunning}
          onExportPlayer={() => {
            if (!state.compilationResult) {
              return;
            }
            downloadStandaloneRunner(state.compilationResult);
          }}
          onDownloadProject={() => {
            const content = editorRef.current?.getValue();
            if (content) {
              downloadProject(content);
            }
          }}
          onShowHelp={() => setShowHelpPanel(true)}
          onShowAbout={() => setShowAboutPanel(true)}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          backendStatus={backendStatus}
          saliencyStrategy={saliencyStrategy}
          onSaliencyStrategyChange={setSaliencyStrategy}
          unavailableOptionsMode={unavailableOptionsMode}
          onUnavailableOptionsModeChange={setUnavailableOptionsMode}
          showWaitProgress={showWaitProgress}
          onShowWaitProgressChange={setShowWaitProgress}
          showDiceEffects={showDiceEffects}
          onShowDiceEffectsChange={setShowDiceEffects}
          githubAuthState={githubAuthState}
          onGitHubLogin={() => setShowGitHubAuthDialog(true)}
          onGitHubLogout={handleGitHubLogout}
          onSaveToGist={handleSaveToGist}
          onBrowseGists={handleBrowseGists}
          compilerVersion={compilerVersion}
        />

        {/* Error overlay */}
        {backendStatus === 'error' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#242124] rounded-lg shadow-xl p-8 max-w-md mx-4">
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Failed to Load Runtime</h2>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                The Yarn Spinner runtime failed to load. This might be due to:
              </p>
              <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 mb-6 space-y-2">
                <li>Cached files from an old version</li>
                <li>Network connection issues</li>
                <li>Browser compatibility problems</li>
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    setBackendStatus('loading');
                    try {
                      await retryBackendLoad();
                    } catch (e) {
                      // Error will be handled by onBackendStatusChange
                    }
                  }}
                  className="flex-1 bg-green text-white px-4 py-2 rounded-lg font-semibold hover:bg-green/90 transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={() => {
                    // Clear cache and reload
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(registrations => {
                        registrations.forEach(reg => reg.unregister());
                      });
                    }
                    window.location.reload();
                  }}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Clear Cache & Reload
                </button>
              </div>
            </div>
          </div>
        )}

        {/* App - Two column layout with individual scrolling */}
        <div className="flex flex-1 min-h-0 pb-16 md:pb-0 pt-12">
          {/* Editor */}
          <div
            className={c(
              "w-full md:w-1/2 overflow-hidden",
              "md:flex",
              viewMode === "code" ? "flex" : "hidden",
            )}
          >
            <CodeMirrorEditor
              initialValue={
                (initialContentState.state === "loaded" &&
                  initialContentState.value) ||
                ""
              }
              compilationResult={state.compilationResult}
              compilationVersion={state.compilationVersion}
              onValueChanged={onEdited}
              onRun={isRunning ? handleStop : (backendStatus === 'ready' && !hasErrors ? handlePlay : undefined)}
              darkMode={darkMode}
              ref={editorRef}
            />
          </div>

          {/* Player */}
          <div
            className={c(
              "flex w-full md:w-1/2 flex-col border-l relative border-[#E5E1E6] dark:border-[#534952]",
              "md:flex",
              viewMode === "game" ? "flex" : "hidden",
            )}
          >
            {/* Variables Popover - absolutely positioned */}
            <VariableView
              compilationResult={state.compilationResult}
              storage={storage.current}
            />

            {/* Log */}
            <div className="flex-1 bg-white dark:bg-[#242124] flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden">
                <Runner
                  locale="en-US"
                  compilationResult={state.compilationResult}
                  ref={playerRef}
                  onVariableChanged={updateVariableDisplay}
                  backendStatus={backendStatus}
                  saliencyStrategy={saliencyStrategy}
                  unavailableOptionsMode={unavailableOptionsMode}
                  showWaitProgress={showWaitProgress}
                  showDiceEffects={showDiceEffects}
                  onDialogueComplete={() => setIsRunning(false)}
                  isMobile={isMobile}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile view switcher - fixed at bottom */}
        <div
          className="fixed bottom-0 left-0 right-0 flex justify-center md:hidden bg-white dark:bg-[#242124] border-t border-[#E5E1E6] dark:border-[#534952] shadow-lg z-40"
          style={{
            paddingTop: '0.5rem',
            paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
          }}
        >
          <ButtonGroup>
            <ButtonGroupItem
              onClick={() => setViewMode("code")}
              active={viewMode === "code"}
            >
              Code
            </ButtonGroupItem>
            <ButtonGroupItem
              onClick={handlePlayTabClick}
              active={viewMode === "game"}
              pulse={isMobile && !hasPlayedBefore}
            >
              Play
            </ButtonGroupItem>
          </ButtonGroup>
        </div>

        {/* Help Panel - shows when ? is pressed */}
        {showHelpPanel && <HelpPanel onClose={() => setShowHelpPanel(false)} />}

        {/* About Panel */}
        {showAboutPanel && (
          <AboutPanel
            onClose={() => setShowAboutPanel(false)}
            compilerVersion={compilerVersion}
            commitHash={__GIT_COMMIT_HASH__}
          />
        )}

        {/* GitHub feature temporarily disabled */}
        {/* {showGitHubAuthDialog && (
          <GitHubAuthDialog
            onClose={() => setShowGitHubAuthDialog(false)}
            onAuthenticated={(authState) => {
              setGithubAuthState(authState);
              setShowGitHubAuthDialog(false);
            }}
          />
        )}

        {showGistBrowser && githubAuthState && (
          <GistBrowser
            onClose={() => setShowGistBrowser(false)}
            onLoadGist={handleLoadGistFile}
            authState={githubAuthState}
          />
        )} */}
      </div>
    </YarnStorageContext.Provider>
  );
}
