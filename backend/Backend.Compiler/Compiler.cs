using System.Threading.Tasks;
using Yarn.Compiler;
using Google.Protobuf;
using Yarn;

namespace Backend.Compiler;

// Implementation of the Yarn Spinner compiler service.
// Injected in the application entry point assembly (Backend.WASM).

public class Compiler(ICompilerUI ui) : ICompiler
{
    public async Task<CompilationResult> CompileAsync(CompilationRequest compilationRequest)
    {
        try
        {
            if (compilationRequest.Source == null)
            {
                throw new ArgumentException("No source provided");
            }

            return await Task.Run(() =>
            {
                // Register playground-specific functions so the compiler
                // accepts them during type checking.  The real implementation
                // lives in the TypeScript VM monkey-patch (Runner.tsx).
                var library = new Library();
                library.RegisterFunction<int, int, int>("multidice", (qty, sides) => 0);

                CompilationJob compilationJob = CompilationJob.CreateFromString("input", compilationRequest.Source, library);

                Yarn.Compiler.CompilationResult result = Yarn.Compiler.Compiler.Compile(compilationJob);

                var programData = result.ContainsErrors ? null : Convert.ToBase64String(result.Program.ToByteArray());
                var programCRC32 = Yarn.Utility.CRC32.GetChecksum(programData ?? "");

                var hashcode = new HashCode();
                if (result.StringTable != null)
                {
                    var comparer = Comparer<string>.Default;
                    foreach (var entry in result.StringTable)
                    {
                        hashcode.Add(entry.Value.text);
                        foreach (var meta in entry.Value.metadata)
                        {
                            hashcode.Add(meta);
                        }
                    }
                }

                return new CompilationResult
                {
                    ProgramData = programData,
                    ProgramHash = programCRC32,
                    StringTableHash = (uint)hashcode.ToHashCode(),
                    VariableDeclarations = result.Declarations
                        .Where(d => d.IsVariable)
                        .Select(d =>
                        {
                            return new VariableDeclaration(d.Name)
                            {
                                Type = d.Type.Name,
                                Description = d.Description
                            };
                        }).ToDictionary(d => d.Name),
                    TypeDeclarations = result.UserDefinedTypes
                        .OfType<EnumType>()
                        .Select(@enum =>
                        {
                            return new EnumTypeDeclaration(@enum);
                        })
                        .Cast<TypeDeclaration>()
                        .ToDictionary(decl => decl.Name),
                    Nodes = result.Program?.Nodes.Select(n =>
                    {
                        return new Node(n.Key)
                        {
                            Headers = n.Value.Headers
                                .Where(h => h.Key != "title")
                                .ToDictionary(h => h.Key, h => h.Value)
                        };
                    }).ToDictionary(n => n.Name) ?? [],
                    StringTable = result.StringTable?.ToDictionary(s => s.Key, s => StringInfo.FromCompiledStringInfo(s.Value)),
                    Diagnostics = result.Diagnostics.Select(d => new Diagnostic(
                        d.FileName,
                        d.Range,
                        d.Message,
                        d.Severity
                    )).ToList()
                };
            });
        }
        catch (Exception e)
        {
            Console.Error.Write(e);
            throw;
        }
    }


    public Task Delay(int ms)
    {
        return Task.Delay(ms);
    }

    public string GetVersion()
    {
        // Read the version from Backend.Compiler's own assembly, whose
        // <Version> property is set to <YarnSpinnerVersion> in the csproj.
        // This avoids depending on a build process to stamp the upstream
        // YarnSpinner.Compiler assembly metadata.
        var assembly = typeof(Compiler).Assembly;
        var version = assembly.GetName().Version;
        return version is { Major: > 0 }
            ? $"{version.Major}.{version.Minor}.{version.Build}"
            : "unknown";
    }
}
