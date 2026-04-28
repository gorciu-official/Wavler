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
            "switch": TokenType.SWITCH_KEYWORD, "case": TokenType.CASE_KEYWORD,
            "function": TokenType.FUNCTION_KEYWORD, "return": TokenType.RETURN_KEYWORD,
            "let": TokenType.LET_KEYWORD, "const": TokenType.CONST_KEYWORD
        };

        const value = ident.value;
    
        // numbers
        if (/^0b[01]+$/i.test(value)) {
            ident = { type: TokenType.NUMBER, value: parseInt(value.slice(2), 2) };
        } 
        else if (/^0x[0-9a-f]+$/i.test(value)) {
            ident = { type: TokenType.NUMBER, value: parseInt(value.slice(2), 16) };
        } 
        else if (/^[0-9]+(\.[0-9]+)?$/.test(value)) {
            ident = { type: TokenType.NUMBER, value: Number(value) };
        }

        // keywords
        else if (value in keywords) {
            ident.type = keywords[value] as TokenType.IDENTIFIER; // trust me
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

    private pushSingle(tk: Token) {
        this.applyCurrent(); // if previous token didnt end
        this.current_token = tk;
        this.applyCurrent();
    }

    private pushLineTerminator() {
        this.applyCurrent(); // this.current_token should be clear by now 
        const last_index = this.tokens.length - 1;
        if (last_index < 0) return; 
        if (this.tokens[last_index]?.type !== TokenType.SEMICOLON) 
            this.pushSingle({ type: TokenType.SEMICOLON, value: ";" });
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

        this.pushLineTerminator();

        let i = 0;

        while (i < line.length) {
            const char = line[i];

            if (char == '"' && this.current_token?.type == TokenType.STRING) {
                this.applyCurrent();
                i++;
                continue;
            } else if (char == '"') {
                this.applyCurrent();
                this.current_token = { type: TokenType.STRING, value: "" };
                i++;
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

                i++;
                continue;
            }

            switch (char) {
            case ' ':
            case '\n':
            case '\r':
                this.applyCurrent();
                break;

            case '}':
                this.pushSingle({ type: TokenType.RBRACE, value: "}" });
                break;
            case '{':
                this.pushSingle({ type: TokenType.LBRACE, value: "{" });
                break;
            case '(':
                this.pushSingle({ type: TokenType.LPAREN, value: "(" });
                break;
            case ')':
                this.pushSingle({ type: TokenType.RPAREN, value: ")" });
                break;

            case '+':
                this.pushSingle({ type: TokenType.PLUS_SIGN, value: "+" });
                break;
            case '-':
                this.pushSingle({ type: TokenType.MINUS_SIGN, value: "-" });
                break;
            case '*':
                this.pushSingle({ type: TokenType.STAR_SIGN, value: "*" });
                break;
            case '/':
                this.pushSingle({ type: TokenType.SLASH_SIGN, value: "/" });
                break;

            case ',':
                this.pushSingle({ type: TokenType.COMMA, value: "," });
                break;
            case ';':
                this.pushSingle({ type: TokenType.SEMICOLON, value: ";" });
                break;
            case ':':
                this.pushSingle({ type: TokenType.COLON, value: ":" });
                break;
            case '|':
                this.pushSingle({ type: TokenType.PIPE, value: "|" });
                break;

            case '=':
                this.pushSingle({ type: TokenType.ASSIGN_SIGN, value: "=" });
                break;

            case '>': {
                if (line[i + 1] == '>') {
                    i++;
                    this.pushSingle({ type: TokenType.BITSHIFT_RIGHT, value: ">>" });
                } else {
                    this.pushSingle({ type: TokenType.GREATER_THAN, value: ">" });
                }
                break;
            }
            case '<': {
                if (line[i + 1] == '<') {
                    i++;
                    this.pushSingle({ type: TokenType.BITSHIFT_LEFT, value: "<<" });
                } else {
                    this.pushSingle({ type: TokenType.LESS_THAN, value: "<" });
                }
                break;
            }

            default: {
                if (this.current_token?.type !== TokenType.IDENTIFIER) {
                    this.applyCurrent();
                    this.current_token = { type: TokenType.IDENTIFIER, value: char };
                } else this.current_token.value += char;
            }
            }

            i++;
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
