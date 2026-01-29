using System.Diagnostics;
using System.Threading.Tasks;
using Yarn.Compiler;
using Google.Protobuf;
using Yarn;

namespace Backend.Compiler;

// Implementation of the computer service that compute prime numbers.
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
                CompilationJob compilationJob = CompilationJob.CreateFromString("input", compilationRequest.Source);

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
                                Type = d.Type.Name
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
}

public class Prime(ICompilerUI ui)
{
    private static readonly SemaphoreSlim semaphore = new(0);
    private readonly Stopwatch watch = new();
    private CancellationTokenSource? cts;

    public void StartComputing()
    {
        cts?.Cancel();
        cts = new CancellationTokenSource();
        cts.Token.Register(() => ui.NotifyComputing(false));
        var options = ui.GetOptions();
        if (!options.Multithreading) ComputeLoop(options.Complexity, cts.Token);
        else new Thread(() => ComputeLoop(options.Complexity, cts.Token)).Start();
        ObserveLoop(cts.Token);
        ui.NotifyComputing(true);
    }

    public void StopComputing() => cts?.Cancel();

    public bool IsComputing() => !cts?.IsCancellationRequested ?? false;

    private async void ObserveLoop(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            watch.Restart();
            try { await semaphore.WaitAsync(token); }
            catch (OperationCanceledException) { }
            finally
            {
                watch.Stop();
                ui.NotifyComplete(watch.ElapsedMilliseconds);
            }
            await Task.Delay(1);
        }
    }

    private static async void ComputeLoop(int complexity, CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            ComputePrime(complexity);
            semaphore.Release();
            await Task.Delay(10);
        }
    }

    private static void ComputePrime(int n)
    {
        var count = 0;
        var a = (long)2;
        while (count < n)
        {
            var b = (long)2;
            var prime = 1;
            while (b * b <= a)
            {
                if (a % b == 0)
                {
                    prime = 0;
                    break;
                }
                b++;
            }
            if (prime > 0) count++;
            a++;
        }
    }

    public async Task Delay(int ms)
    {
        Console.WriteLine($"Starting delay for {ms}ms");
        await Task.Delay(ms);
        Console.WriteLine($"Done");
    }

}
