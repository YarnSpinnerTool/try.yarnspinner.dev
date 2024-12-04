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
using Google.Protobuf;
using Yarn;
using Yarn.Compiler;

public partial class Program
{
    static Program()
    {
        // When we first start up, configure our JSON serialization settings to
        // send property names as camelCase, and to send enums as camel-cased
        // strings. This will apply to all return values from our JSInvokable
        // methods.
        JS.Runtime.ConfigureJson(options =>
        {
            options.Converters.Add(
                new JsonStringEnumConverter(namingPolicy: JsonNamingPolicy.CamelCase)
            );
            options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        });
    }

    // The initial entry point, which is invoked when JavaScript boots the
    // 'dotnet' object.
    public static void Main()
    {

        string yarnSpinnerVersion = GetYarnSpinnerVersion().Result;

        Console.WriteLine($"Yarn Spinner for JS ready (Yarn Spinner version: {yarnSpinnerVersion})");
    }

    [JSInvokable]
    public static Task<string> GetYarnSpinnerVersion()
    {
        string yarnSpinnerVersion = typeof(Yarn.Dialogue).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion ?? "<unknown>";

        return Task.FromResult(yarnSpinnerVersion);
    }

    /// <summary>
    /// Creates and returns a new <see cref="JSDialogue"/> object, and returns a
    /// <see cref="DotNetObjectReference"/> containing for JavaScript to work
    /// with.
    /// </summary>
    /// <returns>A <see cref="DotNetObjectReference"/> that refers to a new
    /// JSDialogue <see cref="object"/>.</returns>
    [JSInvokable]
    public static DotNetObjectReference<JSDialogue> GetDialogue()
    {
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

    [JSFunction]
    public static partial JsonElement InvokeFunction(string name, object[] parameters);
}

/// <summary>
/// A <see cref="Dialogue"/> subclass adapted for use in JavaScript.
/// </summary>
public class JSDialogue : Yarn.Dialogue
{
    public static System.Random Random = new Random();

    public JSDialogue(IVariableStorage variableStorage) : base(variableStorage)
    {
        this.LineHandler = HandleLine;
        this.OptionsHandler = HandleOptions;
        this.CommandHandler = HandleCommand;
        this.DialogueCompleteHandler = HandleDialogueComplete;
        this.NodeStartHandler = HandleNodeStart;
        this.NodeCompleteHandler = HandleNodeComplete;
        this.PrepareForLinesHandler = HandlePrepareForLines;

        this.ContentSaliencyStrategy = new Yarn.Saliency.RandomBestLeastRecentlyViewedSalienceStrategy(variableStorage);
    }

    [Serializable]
    public class JSHeader
    {
        public string Key { get; set; } = "";
        public string Value { get; set; } = "";
    }

    [Serializable]
    public class JSNodeInfo
    {
        public string Name { get; set; } = "";
        public List<JSHeader> Headers { get; set; } = new();
    }

    [Serializable]
    public class JSCompilation
    {
        public bool Compiled { get; set; } = false;
        public List<JSNodeInfo> Nodes { get; set; } = new List<JSNodeInfo>();
        public Dictionary<string, string> StringTable { get; set; } = new Dictionary<string, string>();
        public List<Diagnostic> Diagnostics { get; set; } = new List<Diagnostic>();
        public byte[] ProgramData { get; set; } = Array.Empty<byte>();
    }

    /// <summary>
    /// Stores information about a dialogue-related event, to be sent to the
    /// JavaScript host.
    /// </summary>
    [Serializable]
    public class YarnEvent
    {
        public enum Type
        {
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
    public class LineEvent : YarnEvent
    {
        public LineEvent()
        {
            EventType = Type.Line;
        }
        public string LineID { get; set; } = "<unknown>";
        public IEnumerable<string> Substitutions { get; set; } = new List<string>();
    }

    [Serializable]
    public class OptionsEvent : YarnEvent
    {
        public OptionsEvent()
        {
            EventType = Type.Options;
        }
        public struct Option
        {
            public string LineID { get; set; }
            public int OptionID { get; set; }
            public IEnumerable<string> Substitutions { get; set; }
            public bool IsAvailable { get; set; }
        }
        public IEnumerable<Option> Options { get; set; } = new List<Option>();
    }

    [Serializable]
    public class CommandEvent : YarnEvent
    {
        public CommandEvent()
        {
            EventType = Type.Command;
        }
        public string CommandText { get; set; } = "<unknown>";
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
    public Task<JSCompilation> SetProgramSource(string source)
    {
        CompilationJob compilationJob = CompilationJob.CreateFromString("input", source, this.Library);

        var result = Compiler.Compile(compilationJob);

        if (result.Program == null)
        {
            JSCompilation compilation = new JSCompilation()
            {
                Compiled = false,
                Nodes = new List<JSNodeInfo>(),
                StringTable = new Dictionary<string, string>(),
                Diagnostics = result.Diagnostics.ToList(),
                ProgramData = Array.Empty<byte>(),
            };

            return Task.FromResult(compilation);
        }

        // Stop the VM if it was running - we don't want any dangling state,
        // like waiting on an option to be selected
        Stop();

        SetProgram(result.Program);

        return Task.FromResult(new JSCompilation
        {
            Compiled = true,
            Nodes = result.Program.Nodes.Values.Select(n =>
            {
                return new JSNodeInfo
                {
                    Name = n.Name,
                    Headers = n.Headers.Select(h =>
                    {
                        return new JSHeader
                        {
                            Key = h.Key,
                            Value = h.Value
                        };
                    }).ToList()
                };
            }).ToList(),
            StringTable = result.StringTable?.ToDictionary(kv => kv.Key, kv => kv.Value.text ?? "") ?? new Dictionary<string, string>(),
            Diagnostics = result.Diagnostics.ToList(),
            ProgramData = result.Program?.ToByteArray() ?? Array.Empty<byte>(),
        });
    }

    private void HandleCommand(Command command)
    {
        eventQueue.Enqueue(new CommandEvent
        {
            CommandText = command.Text,
        });
    }

    [JSInvokable]
    new public void SetNode(string nodeName)
    {
        // Clear out our event queue before starting - we're starting a fresh
        // new run
        eventQueue.Clear();

        base.SetNode(nodeName);
    }

    /// <summary>
    /// The queue of Yarn events we need to send to JS. They'll be delivered
    /// when it calls <see cref="Continue"/>.
    /// </summary>
    private readonly Queue<YarnEvent> eventQueue = new();

    [JSInvokable]
    new public Task<System.Text.Json.JsonElement> Continue()
    {
        base.Continue();

        JsonSerializerOptions options = new()
        {
            Converters ={
                new JsonStringEnumConverter(namingPolicy: JsonNamingPolicy.CamelCase)
            },
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        };

        JsonElement jsonElement = System.Text.Json.JsonSerializer.SerializeToElement<object[]>(eventQueue.ToArray(), options);
        eventQueue.Clear();
        return Task.FromResult(jsonElement);
    }

    [JSInvokable]
    new public void SetSelectedOption(int optionID)
    {
        base.SetSelectedOption(optionID);
    }

    [JSInvokable]
    public bool RegisterFunction(JsonElement element)
    {
        // Get the descriptor for the function, and use that to build a delegate
        // of the correct signature such that Library is able to get type
        // information from it, and that calls Program.InvokeFunction to actually do
        // the work.

        var hasName = element.TryGetProperty("name", out var functionNameElement);
        var hasParameters = element.TryGetProperty("parameters", out var functionParametersElement);
        var hasReturnType = element.TryGetProperty("returnType", out var returnTypeElement);

        var name = functionNameElement.GetString() ?? "<unknown>";
        var parameters = functionParametersElement.EnumerateArray()
            .Select(i => GetTypeFromName(i.GetString() ?? "undefined"));
        var returnType = GetTypeFromName(returnTypeElement.GetString() ?? "undefined");

        Delegate GetDelegate<T>()
        {
            // Depending on the number of parameters that we've been told about,
            // return a delegate with the appropriate number of parameters that
            // invokes InvokeFunction.
            //
            // (The Library uses the actual parameter count of the delegate to
            // figure out how many parameters to expect in a Yarn function
            // call.)
            switch (parameters.Count())
            {
                case 0:
                    return () => (T)ParseResult(Program.InvokeFunction(name, Array.Empty<object>()));
                case 1:
                    return (object p1) => (T)ParseResult(Program.InvokeFunction(name, new[] { p1 }));
                case 2:
                    return (object p1, object p2) => (T)ParseResult(Program.InvokeFunction(name, new[] { p1, p2 }));
                case 3:
                    return (object p1, object p2, object p3) => (T)ParseResult(Program.InvokeFunction(name, new[] { p1, p2, p3 }));
                case 4:
                    return (object p1, object p2, object p3, object p4) => (T)ParseResult(Program.InvokeFunction(name, new[] { p1, p2, p3, p4 }));
                case 5:
                    return (object p1, object p2, object p3, object p4, object p5) => (T)ParseResult(Program.InvokeFunction(name, new[] { p1, p2, p3, p4, p5 }));
                case 6:
                    return (object p1, object p2, object p3, object p4, object p5, object p6) => (T)ParseResult(Program.InvokeFunction(name, new[] { p1, p2, p3, p4, p5, p6 }));
                default:
                    throw new ArgumentOutOfRangeException($"Too many parameters for function '{name}' (max 6)");
            }
        }

        Delegate d;

        // Create a delegate with the right return type.
        if (returnType == typeof(string))
        {
            d = GetDelegate<string>();
        }
        else if (returnType == typeof(float))
        {
            d = GetDelegate<float>();
        }
        else if (returnType == typeof(bool))
        {
            d = GetDelegate<bool>();
        }
        else
        {
            throw new ArgumentOutOfRangeException($"Invalid return type {returnTypeElement}");
        }

        Library.RegisterFunction(name, d);

        return true;

        Type GetTypeFromName(string typeName)
        {
            switch (typeName)
            {
                case "string":
                    return typeof(string);
                case "number":
                    return typeof(float);
                case "bool":
                    return typeof(bool);
                default:
                    throw new ArgumentOutOfRangeException($"Parameter has invalid Yarn type '{typeName}'");
            }
        }

        IConvertible ParseResult(JsonElement e)
        {

            Console.WriteLine($"C#: Function {name} returned '{e}'");
            var type = returnType;

            if (type == typeof(string))
            {
                return e.GetString() ?? string.Empty;
            }
            else if (type == typeof(float))
            {
                return e.GetDouble();
            }
            else if (type == typeof(bool))
            {
                return e.GetBoolean();
            }
            else
            {
                throw new ArgumentOutOfRangeException($"Invalid return type '{returnType}' from function '{name}'");
            }
        }

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
                IsAvailable = o.IsAvailable,
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

        public IEnumerable<string> LineIDs { get; set; } = new List<string>();
    }

    [Serializable]
    public class NodeCompleteEvent : YarnEvent
    {
        public NodeCompleteEvent()
        {
            EventType = Type.NodeComplete;
        }
        public string NodeName { get; set; } = "<unknown>";
    }

    [Serializable]
    public class NodeStartedEvent : YarnEvent
    {
        public NodeStartedEvent()
        {
            EventType = Type.NodeStarted;
        }
        public string NodeName { get; set; } = "<unknown>";
    }
}

public class JSVariableStorage : Yarn.IVariableStorage
{
    public Yarn.Program Program { get; set; }
    public ISmartVariableEvaluator SmartVariableEvaluator { get; set; }

    public void Clear()
    {
        // Synchronously invoke the Clear function
        YarnJS.Program.ClearVariableStorage();
    }

    public VariableKind GetVariableKind(string name) => Program.GetVariableKind(name);

    public void SetValue(string variableName, string stringValue)
    {
        YarnJS.Program.SetValue(variableName, stringValue);
    }

    public void SetValue(string variableName, float floatValue)
    {
        Console.WriteLine($"Set float {variableName} to {floatValue}");
        YarnJS.Program.SetValue(variableName, floatValue);
    }

    public void SetValue(string variableName, bool boolValue)
    {
        Console.WriteLine($"Set bool {variableName} to {boolValue}");
        YarnJS.Program.SetValue(variableName, boolValue);
    }

    public bool TryGetValue<T>(string variableName, out T? result)
    {
        var variableKind = GetVariableKind(variableName);

        if (variableKind == VariableKind.Unknown)
        {
            // No idea.
            result = default;
            return false;
        }

        else if (variableKind == VariableKind.Smart)
        {
            return SmartVariableEvaluator.TryGetSmartVariable<T>(variableName, out result);
        }

        Console.WriteLine($"reading {typeof(T)} variable " + variableName);
        var objectResult = YarnJS.Program.GetValue(variableName);

        if (objectResult.ValueKind == JsonValueKind.Undefined)
        {
            // Fetch the initial value from the program
            if (this.Program.InitialValues.TryGetValue(variableName, out var operand) == false)
            {
                // Not present in initial values. This should have resulted in
                // our variable kind being Unknown, so we've got something weird
                // happening here.
                throw new InvalidOperationException($"Internal error: program has no initial value for {variableKind} variable {variableName}");
            }
            if (typeof(T).IsAssignableFrom(typeof(float)))
            {
                result = (T)(object)operand.FloatValue;
                return true;
            }
            if (typeof(T).IsAssignableFrom(typeof(string)))
            {
                result = (T)(object)operand.StringValue;
                return true;
            }
            if (typeof(T).IsAssignableFrom(typeof(bool)))
            {
                result = (T)(object)operand.BoolValue;
                return true;
            }
            else
            {
                result = default;
                return false;
            }
        }

        try
        {
            // What kind of type is T?
            if (typeof(T).IsInterface)
            {
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

                switch (objectResult.ValueKind)
                {
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
            else
            {
                // If T isn't an interface, attempt to deserialise it into the
                // indicated class type.
                result = objectResult.Deserialize<T>();
            }
        }
        catch (JsonException)
        {
            Console.Error.WriteLine($"Can't deserialize {objectResult.ValueKind} to {typeof(T)}");
            result = default;
            return false;
        }
        catch (InvalidCastException)
        {
            Console.Error.WriteLine($"Can't cast {objectResult.ValueKind} to {typeof(T)}");
            result = default;
            return false;
        }

        Console.WriteLine($"Result: {result}");

        return true;
    }
}

