import { Lexer } from "../lexer/main.ts";
import { Parser } from "../parser/main.ts";
import { SemanticAnalyzer } from "../sema/main.ts";
import { TypeProcessor } from "../types/main.ts";
import { LLVMCodeGen } from "../codegen/main.ts";
import { error, ErrorCode } from "../logging.ts";

async function createTempFile() {
    const cmd = new Deno.Command("mktemp", {
        args: ["--suffix=.ll"],
        stdout: "piped",
        stderr: "piped",
    });

    const output = await cmd.output();
    const tempFile = new TextDecoder().decode(output.stdout).trim();

    if (!tempFile) {
        throw new Error("Failed to create temp file");
    }

    return tempFile;
}

type CLIConfig = {
    inputs: string[];
    output: string;
    debug: boolean;
};

function parseArgs(): CLIConfig {
    const args = Deno.args;

    const inputs: string[] = [];
    let output = "a.out";
    let debug = false;

    let i = 0;

    while (i < args.length) {
        const arg = args[i];

        if (arg === "-o") {
            const val = args[i + 1];
            if (!val || val.startsWith("-")) {
                error({
                    code: ErrorCode.INVALID_CLI_USAGE,
                    reason: "-o requires output file",
                });
            }
            output = val;
            i += 2;
            continue;
        }

        if (arg === "-g") {
            debug = true;
            i++;
            continue;
        }

        if (arg.startsWith("-")) {
            error({
                code: ErrorCode.INVALID_CLI_USAGE,
                reason: `Unknown flag: ${arg}`,
            });
        }

        inputs.push(arg);
        i++;
    }

    if (inputs.length === 0) {
        error({
            code: ErrorCode.INVALID_CLI_USAGE,
            reason: "No input files provided",
        });
    }

    return { inputs, output, debug };
}

export default async function driver_main() {
    const { inputs, output } = parseArgs();

    for (const target of inputs) {
        const code = Deno.readTextFileSync(target);

        const lexer = new Lexer();
        lexer.main(code);
        const tokens = lexer.getResult();

        const parser = new Parser(tokens);
        const ast = parser.parse();

        const typeProcessor = new TypeProcessor(ast);
        const processedAst = typeProcessor.process();
        const aliases = typeProcessor.getAliases();

        const semantic = new SemanticAnalyzer(aliases);
        semantic.analyze(processedAst);

        const codegen = new LLVMCodeGen(processedAst);
        const llvmIR = codegen.generate();

        const tmp = await createTempFile();
        Deno.writeTextFileSync(tmp, llvmIR);

        const clang = new Deno.Command("clang", {
            args: [tmp, "-o", output],
            stdout: "inherit",
            stderr: "inherit",
        });

        const result = await clang.output();

        if (result.code !== 0) {
            throw new Error("clang failed");
        }

        try {
            await Deno.remove(tmp);
        } catch {
            // nothing needs to be done
        }
    }
}
