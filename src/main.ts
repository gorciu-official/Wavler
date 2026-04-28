import process from "node:process";
import { Lexer } from "./lexer/main.ts";
import { Parser } from "./parser/main.ts";

function main() {
    const code = 
        process.argv.some((a) => a.endsWith('.wvl'))
            ? Deno.readTextFileSync(process.argv.find((a) => a.endsWith('.wvl'))!)
            : `"siema" mordo } { () } it is } testing time`;

    const lexer = new Lexer(); lexer.main(code);
    const lexer_result = lexer.getResult();
    console.log(lexer_result);

    const parser = new Parser(lexer_result);
    console.log(parser.parse());
}

main();
