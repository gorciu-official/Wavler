import process from "node:process";
import { Lexer } from "./lexer/main.ts";

function main() {
    const code = 
        process.argv.some((a) => a.endsWith('.wvl'))
            ? Deno.readTextFileSync(process.argv.find((a) => a.endsWith('.wvl'))!)
            : `"siema" mordo } { () } it is } testing time`;

    const lexer = new Lexer();
    lexer.main(code);
    console.log(lexer.getResult());
}

main();
