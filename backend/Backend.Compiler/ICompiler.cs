using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

using Yarn;
using Yarn.Compiler;

namespace Backend;

// Contract for the Yarn Spinner compiler service.
// The specific implementation is in another assembly, so that
// the domain is not coupled with the details.

public interface ICompiler
{
    Task<CompilationResult> CompileAsync(CompilationRequest compilationRequest);

    Task Delay(int ms);

    string GetVersion();

}

public record CompilationRequest
{
    public string Source { get; init; }
}

public record CompilationResult
{
    public string Info { get; init; } = "";
    public Dictionary<string, Node> Nodes { get; init; } = [];
    public Dictionary<string, VariableDeclaration> VariableDeclarations { get; init; } = [];
    public Dictionary<string, TypeDeclaration> TypeDeclarations { get; init; } = [];
    public Dictionary<string, StringInfo>? StringTable { get; set; } = null;
    public string? ProgramData { get; init; } = null;
    public uint ProgramHash { get; init; } = 0;
    public uint StringTableHash { get; init; } = 0;
    public List<Diagnostic> Diagnostics { get; init; } = [];
}

public record StringInfo
{
    public string Text { get; init; } = "";
    public List<string> Tags { get; init; } = [];
    public string? NodeName { get; init; }
    public int LineNumber { get; init; }
    public string? FileName { get; init; }
    public bool IsImplicitTag { get; init; } = false;
    public string? ShadowLineID { get; init; }

    public static StringInfo FromCompiledStringInfo(Yarn.Compiler.StringInfo si)
    {
        return new StringInfo
        {
            Text = si.text ?? "",
            Tags = [.. si.metadata.Where(m => m.StartsWith("line:") == false)],
            NodeName = si.nodeName,
            LineNumber = si.lineNumber,
            FileName = si.fileName,
            IsImplicitTag = si.isImplicitTag,
            ShadowLineID = si.shadowLineID,
        };
    }
}

public enum Severity
{
    Error, Warning, Info
}

public record Node(string Name)
{
    public Dictionary<string, string> Headers { get; init; } = [];
}


public abstract record Declaration(string Name) { }


[JsonDerivedType(typeof(EnumTypeDeclaration))]
public record TypeDeclaration : Declaration
{
    public TypeDeclaration(IType type) : base(type.Name) { }
}

public record EnumTypeDeclaration : TypeDeclaration
{
    public Dictionary<string, IConvertible> Cases { get; init; }
    public EnumTypeDeclaration(EnumType type) : base(type)
    {
        Cases = type.EnumCases.Select(@case =>
        {
            return (@case.Key, @case.Value.Value);
        }).ToDictionary();
    }
}


public record VariableDeclaration : Declaration
{
    public VariableDeclaration(string Name) : base(Name) { }

    public string Type { get; set; }
    public string? Description { get; set; }

}
