import { useEffect, useRef, useCallback } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<A extends any[]>(
    callback: (...args: A) => void,
    wait: number
): (...args: A) => void {
    // track args & timeout handle between calls
    const argsRef = useRef<A>();
    const timeout = useRef<ReturnType<typeof setTimeout>>();

    // Keep the callback ref up to date so we always call the latest version
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    function cleanup() {
        if (timeout.current) {
            clearTimeout(timeout.current);
        }
    }

    // make sure our timeout gets cleared if
    // our consuming component gets unmounted
    useEffect(() => cleanup, []);

    return useCallback(function debouncedCallback(...args: A) {
        // capture latest args
        argsRef.current = args;

        // clear debounce timer
        cleanup();

        // start waiting again
        timeout.current = setTimeout(() => {
            if (argsRef.current) {
                // Call the latest callback via ref
                callbackRef.current(...argsRef.current);
            }
        }, wait);
    }, [wait]);
}
