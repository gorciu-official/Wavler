import process from "node:process";
import { Lexer } from "./lexer/main.ts";
import { Parser } from "./parser/main.ts";
import { SemanticAnalyzer } from "./semantic-analyzer/main.ts";
import { LLVMCodeGen } from "./codegen/main.ts";

function verboseOutput(obj: object | string) {
    const str = typeof obj == 'string'
        ? obj
        : JSON.stringify(obj, null, 4);
    console.log(str);
}

async function main() {
    const code = 
        process.argv.some((a) => a.endsWith('.wvl'))
            ? Deno.readTextFileSync(process.argv.find((a) => a.endsWith('.wvl'))!)
            : `"siema" mordo } { () } it is } testing time`;

    const lexer = new Lexer(); lexer.main(code);
    const lexer_result = lexer.getResult();
    verboseOutput(lexer_result); 

    const parser = new Parser(lexer_result);
    const parser_output = parser.parse();
    verboseOutput(parser_output);

    const semantic_analyzer = new SemanticAnalyzer();
    semantic_analyzer.analyze(parser_output);

    const codegen = new LLVMCodeGen(parser_output);
    const codegen_output = codegen.generate();
    verboseOutput(codegen_output);

    Deno.writeTextFileSync("test.ll", codegen_output);

    const cmd = new Deno.Command("clang", {
        args: ["test.ll", "-o", "test"],
        stdout: "inherit",
        stderr: "inherit",
    });
    
    const out = await cmd.output();
    
    if (out.code !== 0) {
        throw new Error("llc failed");
    }
}

main();
