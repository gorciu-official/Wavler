import { error, ErrorCode, warn, WarnCode } from "../logging.ts";
import Token, { TokenType } from "../definitions/token.ts";

export class Lexer {
    private tokens: Token[] = [];
    private current_token: Token | null = null;

    private transformIdentifiers(ident: Token): Token {
        if (ident.type !== TokenType.IDENTIFIER) 
            return ident;
    
        const keywords: Record<string, TokenType> = {
            "if": TokenType.IF_KEYWORD, "else": TokenType.ELSE_KEYWORD,
            "switch": TokenType.SWITCH_KEYWORD, "case": TokenType.CASE_KEYWORD
        };

        const value = ident.value;
    
        // numbers
        if (/^0b[01]+$/i.test(value)) {
            ident.type = TokenType.NUMBER;
            ident.value = parseInt(value.slice(2), 2).toString();
        } 
        else if (/^0x[0-9a-f]+$/i.test(value)) {
            ident.type = TokenType.NUMBER;
            ident.value = parseInt(value.slice(2), 16).toString();
        } 
        else if (/^[0-9]+(\.[0-9]+)?$/.test(value)) {
            ident.type = TokenType.NUMBER;
            ident.value = String(Number(value)); // normalizing time
        }

        // keywords
        else if (value in keywords) {
            ident.type = keywords[value];
        }
    
        return ident;
    }

    private applyCurrent() {
        if (this.current_token) {
            this.current_token = this.transformIdentifiers(this.current_token);
            this.tokens.push(this.current_token);
        }
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
        let last_line = '';
        
        for (const line of code.split('\n')) {

        last_line = line;
        
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

        if (this.current_token?.type == TokenType.STRING || this.current_token?.type == TokenType.TEMPLATE_STRING) {
            error({
                code: ErrorCode.UNTERMINATED_STRING_LITERAL,
                reason: "Unterminated string literal",
                line: last_line
            });
        }
    }

    public getResult() {
        this.applyCurrent();
        return this.tokens;
    }
}
