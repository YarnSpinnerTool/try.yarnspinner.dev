// import { useEffect, useState, useCallback, ChangeEvent } from "react";
// import { Computer } from "backend";

// type Props = {
//   options: Computer.Options;
//   resultLimit: number;
// };

// export default ({ options, resultLimit }: Props) => {
//   const [computing, setComputing] = useState(false);
//   const [complexity, setComplexity] = useState(options.complexity);
//   const [multithreading, setMultithreading] = useState(options.multithreading);
//   const [results, setResults] = useState("");

//   const toggleCompute = useCallback(() => {
//     if (Computer.isComputing()) Computer.stopComputing();
//     else Computer.startComputing();
//   }, []);

//   const toggleMultithreading = useCallback(() => {
//     setMultithreading(!multithreading);
//   }, [multithreading]);

//   const handleComplexityInputChange = useCallback(
//     (event: ChangeEvent<HTMLInputElement>) => {
//       setComplexity(Math.min(Math.max(event.target.valueAsNumber, 99), 99999));
//     },
//     []
//   );

//   const logResult = useCallback(
//     (time: bigint) => {
//       setResults((i) => {
//         if ((i.match(/\n/g)?.length ?? 0) > resultLimit)
//           i = i.substring(0, i.lastIndexOf("\n"));
//         const stamp = new Date().toLocaleTimeString([], { hour12: false });
//         return `[${stamp}] Computed in ${time}ms.\n${i}`;
//       });
//     },
//     [resultLimit]
//   );

//   useEffect(() => {
//     Computer.getOptions = () => ({ complexity, multithreading });
//     if (Computer.isComputing()) Computer.startComputing();
//   }, [complexity, multithreading]);

//   useEffect(() => {
//     Computer.onComplete.subscribe(logResult);
//     return () => Computer.onComplete.unsubscribe(logResult);
//   }, [logResult]);

//   useEffect(() => {
//     Computer.onComputing.subscribe(setComputing);
//     return () => Computer.onComputing.unsubscribe(setComputing);
//   }, []);

//   return (
//     <div id="computer">
//       <div>
//         The Donut is animating on the UI thread, while a background thread
//         computing. When MULTITHREADING disabled, the computation will run on UI
//         affecting animation.
//       </div>
//       <div id="controls">
//         <label>
//           COMPLEXITY
//           <input
//             type="number"
//             value={complexity}
//             onChange={handleComplexityInputChange}
//           />
//         </label>
//         <label>
//           MULTITHREADING
//           <input
//             type="checkbox"
//             checked={multithreading}
//             onChange={toggleMultithreading}
//           />
//         </label>
//       </div>
//       <button onClick={toggleCompute}>
//         {computing ? "STOP COMPUTE" : "START COMPUTE"}
//       </button>
//       <div id="results">{results}</div>
//     </div>
//   );
// };
