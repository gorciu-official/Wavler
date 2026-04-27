import { error, ErrorCode, warn, WarnCode } from "../logging.ts";
import Token, { TokenType } from "../definitions/token.ts";

export class Lexer {
    private tokens: Token[] = [];
    private current_token: Token | null = null;

    private applyCurrent() {
        if (this.current_token) this.tokens.push(this.current_token);
        this.current_token = null;
    }

    private pushSingle(tokenType: TokenType, val: string) {
        this.applyCurrent(); // if previous token didnt end
        this.current_token = {
            type: tokenType, value: val
        };
        this.applyCurrent();
    }

    public main(code: string) {
        let escaping = false;  
        
        for (const line of code.split('\n')) {
        
        if (this.current_token?.type == TokenType.STRING) {
            error({
                code: ErrorCode.MULTILINE_NON_TEMPLATE_STRING,
                reason: "Multiline non-template strings are not allowed",
                line
            });
        }

        for (const char of line) {
            if (char == '"' && this.current_token?.type == TokenType.STRING) {
                this.applyCurrent();
                continue;
            } else if (char == '"') {
                this.applyCurrent();
                this.current_token = { type: TokenType.STRING, value: "" };
                continue;
            } else if (this.current_token?.type == TokenType.STRING) {
                const escape_map: Record<string, string> = {
                    ['n']: "\n",
                    ["\\"]: "\\",
                    ['"']: '"'
                };

                if (escaping) escaping = false;

                if (escaping && escape_map[char]) {
                    this.current_token.value += escape_map[char];
                } else if (escaping) {
                    warn({
                        code: WarnCode.CHARACTER_ESCAPING_NOT_USED,
                        reason: `Escaping character ${char} makes no sense, leaving nothing`,
                        line
                    });
                } else if (char == "\\") {
                    escaping = true;   
                } else {
                    this.current_token.value += char;
                }

                continue;
            }

            switch (char) {
            case ' ':
                this.applyCurrent();
                break;
            case '}':
                this.pushSingle(TokenType.RBRACE, "}");
                break;
            case '{':
                this.pushSingle(TokenType.LBRACE, "{");
                break;
            case '(':
                this.pushSingle(TokenType.LPAREN, "(");
                break;
            case ')':
                this.pushSingle(TokenType.RPAREN, ")");
                break;
            default: {
                if (this.current_token?.type !== TokenType.IDENTIFIER) {
                    this.applyCurrent();
                    this.current_token = { type: TokenType.IDENTIFIER, value: char };
                } else this.current_token.value += char;
            }
            } 
        }
        }
    }

    public getResult() {
        this.applyCurrent();
        return this.tokens;
    }
}
