using System;
using DotNetJS;
using Microsoft.JSInterop;

namespace YarnJS;

using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Yarn;
using Yarn.Compiler;

public partial class Program
{
    public Program() {
        JsonSerializerOptions options = new JsonSerializerOptions
        {
            Converters ={
                new JsonStringEnumConverter(namingPolicy: JsonNamingPolicy.CamelCase),
            },
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };
    }
    
    // The initial entry point, which is invoked when JavaScript boots the
    // 'dotnet' object.
    public static void Main()
    {

        string yarnSpinnerVersion = typeof(Yarn.Dialogue).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion ?? "<unknown>";

        Console.WriteLine($"Yarn Spinner for JS ready (Yarn Spinner version: {yarnSpinnerVersion})");
    }

    /// <summary>
    /// Creates and returns a new <see cref="JSDialogue"/> object, and returns a
    /// <see cref="DotNetObjectReference"/> containing for JavaScript to work
    /// with.
    /// </summary>
    /// <returns>A <see cref="DotNetObjectReference"/> that refers to a new
    /// JSDialogue <see cref="object"/>.</returns>
    [JSInvokable]
    public static DotNetObjectReference<JSDialogue> GetDialogue() {
        var d = new JSDialogue(new JSVariableStorage());
        return DotNetObjectReference.Create(d);
    }

    /// <summary>
    /// Clears the variable storage hosted in JavaScript.
    /// </summary>
    /// <remarks>
    /// This method's implementation is generated at build time.
    /// </remarks>
    [JSFunction]
    public static partial void ClearVariableStorage();



    /// <summary>
    /// Sets a value in the variable storaged hosted in JavaScript.
    /// </summary>
    /// <param name="variableName">The name of the variable to set.</param>
    /// <param name="value">The value to apply. This must be a <see
    /// cref="string"/>, a <see cref="double"/>, or a <see
    /// cref="bool"/>.</param>
    /// <inheritdoc cref="ClearVariableStorage" path="/remarks"/>
    [JSFunction]
    public static partial void SetValue(string variableName, object value);

    /// <summary>
    /// Gets a value in the variable storaged hosted in JavaScript.
    /// </summary>
    /// <param name="variableName">The name of the variable to set.</param>
    /// <inheritdoc cref="ClearVariableStorage" path="/remarks"/>
    [JSFunction]
    public static partial JsonElement GetValue(string variableName);
}

/// <summary>
/// A <see cref="Dialogue"/> subclass adapted for use in JavaScript.
/// </summary>
public class JSDialogue : Yarn.Dialogue {
    public JSDialogue(IVariableStorage variableStorage) : base(variableStorage) {}

    [Serializable]
    public struct JSCompilation {
        public bool Compiled { get; set; }
        public List<string> Nodes { get; set; }
        public Dictionary<string, string> StringTable { get; set; }
    }

    /// <summary>
    /// Stores information about a dialogue-related event, to be sent to the
    /// JavaScript host.
    /// </summary>
    [Serializable]
    public class YarnEvent {
        public enum Type {
            Line,
            Options,
            Command,
            DialogueEnded,
            PrepareForLines,
            NodeComplete,
            NodeStarted
        }
        [JsonPropertyName("type")]
        public Type EventType { get; set; }
    }

    [Serializable]
    public class LineEvent : YarnEvent {
        public LineEvent() {
            EventType = Type.Line;
        }
        public string LineID { get; set; }
        public IEnumerable<string> Substitutions { get; set; }
    }

    [Serializable]
    public class OptionsEvent : YarnEvent {
        public OptionsEvent() {
            EventType = Type.Options;
        }
        public struct Option {
            public string LineID { get; set; }
            public int OptionID { get; set; }
            public IEnumerable<string> Substitutions { get; set; }
        }
        public IEnumerable<Option> Options { get; set; }
    }

    [Serializable]
    public class CommandEvent : YarnEvent {
        public CommandEvent() {
            EventType = Type.Command;
        }
        public string CommandText { get; set; }
    }

    [Serializable]
    public class DialogueEndedEvent : YarnEvent
    {
        public DialogueEndedEvent()
        {
            EventType = Type.DialogueEnded;
        }
    }

    [JSInvokable]
    public async Task<JSCompilation> SetProgramSource(string source) {
        CompilationJob compilationJob = CompilationJob.CreateFromString("input", source);

        var result = Compiler.Compile(compilationJob);

        if (result.Program == null) {
            return new JSCompilation
            {
                Compiled = false,
                Nodes = new List<string>(),
                StringTable = new Dictionary<string, string>(),
            };
        }

        this.LineHandler = HandleLine;
        this.OptionsHandler = HandleOptions;
        this.CommandHandler = HandleCommand;
        this.DialogueCompleteHandler = HandleDialogueComplete;
        this.NodeStartHandler = HandleNodeStart;
        this.NodeCompleteHandler = HandleNodeComplete;
        this.PrepareForLinesHandler = HandlePrepareForLines;

        // Stop the VM if it was running - we don't want any dangling state,
        // like waiting on an option to be selected
        Stop();

        SetProgram(result.Program);

        return new JSCompilation
        {
            Compiled = true,
            Nodes = result.Program.Nodes.Keys.ToList(),
            StringTable = result.StringTable.ToDictionary(kv => kv.Key, kv => kv.Value.text),
        };
    }

    private void HandleCommand(Command command)
    {
        eventQueue.Enqueue(new CommandEvent
        {
            CommandText = command.Text,
        });
    }

    [JSInvokable]
    new public async void SetNode(string nodeName) {
        base.SetNode(nodeName);
    }

    /// <summary>
    /// The queue of Yarn events we need to send to JS. They'll be delivered
    /// when it calls <see cref="Continue"/>.
    /// </summary>
    private readonly Queue<YarnEvent> eventQueue = new();

    [JSInvokable]
    new public async Task<System.Text.Json.JsonElement> Continue()
    {
        base.Continue();

        JsonSerializerOptions options = new JsonSerializerOptions
        {
            Converters ={
                new JsonStringEnumConverter(namingPolicy: JsonNamingPolicy.CamelCase)
            },
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        JsonElement jsonElement = System.Text.Json.JsonSerializer.SerializeToElement<object[]>(eventQueue.ToArray(), options);
        eventQueue.Clear();
        return jsonElement;
    } 

    [JSInvokable]
    new public async void SetSelectedOption(int optionID) {
        Console.WriteLine($"Received selected option ID {optionID}");
        base.SetSelectedOption(optionID);
    }

    private void HandlePrepareForLines(IEnumerable<string> lineIDs)
    {
        eventQueue.Enqueue(new PrepareForLinesEvent
        {
            LineIDs = lineIDs,
        });
    }

    private void HandleNodeComplete(string completedNodeName)
    {
        eventQueue.Enqueue(new NodeCompleteEvent
        {
            NodeName = completedNodeName,
        });
    }

    private void HandleNodeStart(string startedNodeName)
    {
        eventQueue.Enqueue(new NodeStartedEvent
        {
            NodeName = startedNodeName,
        });
    }

    private void HandleDialogueComplete()
    {
        eventQueue.Enqueue(new DialogueEndedEvent());
    }

    private void HandleOptions(OptionSet options)
    {
        eventQueue.Enqueue(new OptionsEvent
        {
            Options = options.Options.Select(o => new OptionsEvent.Option
            {
                LineID = o.Line.ID,
                OptionID = o.ID,
                Substitutions = o.Line.Substitutions,
            })
        });
    }

    private void HandleLine(Line line)
    {
        eventQueue.Enqueue(new LineEvent
        {
            LineID = line.ID,
            Substitutions = line.Substitutions,
        });
    }

    [Serializable]
    public class PrepareForLinesEvent : YarnEvent
    {
        public PrepareForLinesEvent()
        {
            EventType = Type.PrepareForLines;
        }

        public IEnumerable<string> LineIDs { get; set; }
    }

    [Serializable]
    public class NodeCompleteEvent : YarnEvent
    {
        public NodeCompleteEvent()
        {
            EventType = Type.NodeComplete;
        }
        public string NodeName { get; set; }
    }

    [Serializable]
    public class NodeStartedEvent : YarnEvent
    {
        public NodeStartedEvent()
        {
            EventType = Type.NodeStarted;
        }
        public string NodeName { get; set; }
    }
}

public class JSVariableStorage : Yarn.IVariableStorage
{

    public void Clear()
    {
        // Synchronously invoke the Clear function
        Program.ClearVariableStorage();
    }

    public void SetValue(string variableName, string stringValue)
    {
        Console.WriteLine($"Set string {variableName} to {stringValue}");
        Program.SetValue(variableName, stringValue);
    }

    public void SetValue(string variableName, float floatValue)
    {
        Console.WriteLine($"Set float {variableName} to {floatValue}");
        Program.SetValue(variableName, floatValue);
    }

    public void SetValue(string variableName, bool boolValue)
    {
        Console.WriteLine($"Set bool {variableName} to {boolValue}");
        Program.SetValue(variableName, boolValue);
    }

    public bool TryGetValue<T>(string variableName, out T? result)
    {
        var objectResult = Program.GetValue(variableName);

        if (objectResult.ValueKind == JsonValueKind.Undefined) {
            result = default;
            return false;
        }

        try {
            if (typeof(T).IsInterface == false) {
                // If T isn't an interface, attempt to deserialise it into the
                // indicated class type.
                result = objectResult.Deserialize<T>();
            } else {
                // It's an interface. We can't deserialize directly into this
                // type (there might be many different classes that implement
                // the interface 'T', and we don't know which one to pick), so
                // we'll instead take the "raw" value of the JSON value, and
                // cast it to the interface.
                //
                // Todo: this current implementation won't work with JSON
                // objects. Is it possible to do something with this? Find the
                // types in the assembly that implement T and try to deserialize
                // it to that, maybe?

                switch(objectResult.ValueKind) {
                    // Get the actual value of the JSON Value, and cast it to
                    // the specified interface.
                    case JsonValueKind.String:
                        result = (T)(object)(objectResult.GetString() ?? string.Empty);
                        break;
                    case JsonValueKind.Number:
                        result = (T)(object)objectResult.GetDouble();
                        break;
                    case JsonValueKind.True:
                    case JsonValueKind.False:
                        result = (T)(object)objectResult.GetBoolean();
                        break;
                    default:
                        throw new InvalidCastException($"Can't cast value of JSON kind {objectResult.ValueKind} to {typeof(T)}");
                }
            }
        } catch (JsonException) {
            Console.Error.WriteLine($"Can't deserialize {objectResult.ValueKind} to {typeof(T)}");
            result = default;
            return false;
        } catch (InvalidCastException) {
            Console.Error.WriteLine($"Can't cast {objectResult.ValueKind} to {typeof(T)}");
            result = default;
            return false;
        }

        Console.WriteLine($"Result: {result}");

        return true;
    }
}
