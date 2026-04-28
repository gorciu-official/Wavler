import process from "node:process";
import { Lexer } from "./lexer/main.ts";
import { Parser } from "./parser/main.ts";

function verboseOutput(obj: object) {
    const str = JSON.stringify(obj, null, 4);
    console.log(str);
}

function main() {
    const code = 
        process.argv.some((a) => a.endsWith('.wvl'))
            ? Deno.readTextFileSync(process.argv.find((a) => a.endsWith('.wvl'))!)
            : `"siema" mordo } { () } it is } testing time`;

    const lexer = new Lexer(); lexer.main(code);
    const lexer_result = lexer.getResult();
    verboseOutput(lexer_result); 

    const parser = new Parser(lexer_result);
    verboseOutput(parser.parse());
}

main();
