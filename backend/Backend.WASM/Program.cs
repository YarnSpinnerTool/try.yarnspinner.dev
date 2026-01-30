using System.Text.Json;
using System.Text.Json.Serialization;
using Bootsharp;
using Bootsharp.Inject;
using Microsoft.Extensions.DependencyInjection;

// Application entry point for browser-wasm build target.
// Notice, how neither domain, nor other C# backend assemblies
// are coupled with the JavaScript interop specifics
// and can be shared with other build targets (console, MAUI, etc).

// Generate C# -> JavaScript interop handlers for specified contracts.
[assembly: JSExport(
    typeof(Backend.ICompiler)
    )]

// Generate JavaScript -> C# interop handlers for specified contracts.
[assembly: JSImport(typeof(Backend.Compiler.ICompilerUI))]
// Group all generated JavaScript APIs under "YarnSpinner" namespace.
[assembly: JSPreferences(Space = [
    "^Internals", "__InternalsDoNotUse",
    ".+", "YarnSpinner",
    ])]

class ConvertibleConverter : JsonConverter<IConvertible>
{
    public override IConvertible Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        return reader.TokenType switch
        {
            JsonTokenType.String => reader.GetString(),
            JsonTokenType.Number => reader.GetSingle(),
            JsonTokenType.True => true,
            JsonTokenType.False => false,
            JsonTokenType.Null => null,
            _ => throw new JsonException(),
        };
    }

    public override void Write(Utf8JsonWriter writer, IConvertible value, JsonSerializerOptions options)
    {
        switch (value)
        {
            case string stringVale:
                writer.WriteStringValue(stringVale);
                break;
            case bool boolValue:
                writer.WriteBooleanValue(boolValue);
                break;
            case float floatValue:
                writer.WriteNumberValue(floatValue);
                break;
            case double doubleValue:
                writer.WriteNumberValue(doubleValue);
                break;
            case int intValue:
                writer.WriteNumberValue(intValue);
                break;
            case uint uintValue:
                writer.WriteNumberValue(uintValue);
                break;
            case short shortValue:
                writer.WriteNumberValue(shortValue);
                break;
            case long longValue:
                writer.WriteNumberValue(longValue);
                break;
            case decimal decimalValue:
                writer.WriteNumberValue(decimalValue);
                break;
            default:
                throw new JsonException();
        }
    }
}

internal class Program
{
    static Program()
    {
        // Make IConvertible (de)serialize as JSON values.
        var converter = new ConvertibleConverter();
        Serializer.Options.Converters.Add(converter);
    }

    private static void Main(string[] args)
    {
        // Perform dependency injection.
        new ServiceCollection()
            // .AddSingleton<Backend.IComputer, Backend.Prime.Prime>() // use prime computer
            .AddSingleton<Backend.ICompiler, Backend.Compiler.Compiler>()
            .AddBootsharp() // inject generated interop handlers
            .BuildServiceProvider()
            .RunBootsharp(); // initialize interop services

        Console.WriteLine($".NET booted.");
    }
}

// Forcing Bootsharp to generate TypeScript declarations for the types we care about
public static class Internals
{
    [JSInvokable] public static Backend.Node GetNode() => throw new NotImplementedException();
    [JSInvokable] public static Backend.Declaration GetDeclaration() => throw new NotImplementedException();
    [JSInvokable] public static Backend.VariableDeclaration GetVariableDeclaration() => throw new NotImplementedException();
    [JSInvokable] public static Backend.TypeDeclaration GetTypeDeclaration() => throw new NotImplementedException();
    [JSInvokable] public static Backend.EnumTypeDeclaration GetEnumTypeDeclaration() => throw new NotImplementedException();
    [JSInvokable] public static Backend.StringInfo GetStringInfo() => throw new NotImplementedException();
    // [JSInvokable] public static Backend.Diagnostic GetDiagnostic() => throw new NotImplementedException();
    // [JSInvokable] public static Yarn.Compiler.Declaration GetYSDeclaration() => throw new NotImplementedException();
}
