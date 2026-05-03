import process from "node:process";

export enum ErrorCode {
    // --- lexer
    MULTILINE_NON_TEMPLATE_STRING,
    UNTERMINATED_STRING_LITERAL,
    NUMBER_UNSUPPORTED_CHARACTER,

    // --- parser
    EXPECTED_IDENTIFIER,
    EXPECTED_EXPRESSION,
    UNEXPECTED_TOKEN,
    EXPECTED_TOKEN,
    UNEXPECTED_EOF,
    EXPECTED_TYPE,
    EXPECTED_BLOCK,
    EXPECTED_SEMICOLON,
    EXPECTED_PAREN_OPEN,
    EXPECTED_PAREN_CLOSE,
    EXPECTED_BRACE_OPEN,
    EXPECTED_BRACE_CLOSE,
    EXPECTED_KEYWORD,
    INVALID_FOR_SYNTAX,
    INVALID_FOR_OF_SYNTAX,

    // --- semantic analyzer
    UNKNOWN_TYPE,
    ILLEGAL_RETURN_STATEMENT,
    ALREADY_EXISTS,
    UNDEFINED_VARIABLE,
    TYPE_MISMATCH,
    ILLEGAL_FUNCTION_STATEMENT,
    ILLEGAL_RETURN_TYPE,
    ILLEGAL_IDENTIFIER,
    STATEMENT_ILLEGAL_OUTSIDE_A_FUNCTION
};

export enum WarnCode {
    CHARACTER_ESCAPING_NOT_USED,
    STATEMENT_NOT_IMPLEMENTED
};

export function error(opts: {
    code: ErrorCode,
    reason: string,
    line?: string,
    help?: string
}): never {
    console.log(`\x1b[31mERR<e${opts.code + 1}>\x1b[0m: ${opts.reason}`);
    if (opts.line) console.log(opts.line);
    if (opts.help) console.log(`└ \x1b[36mhelp\x1b[0m: ${opts.help}`);
    process.exit(1);
}

export function warn(opts: {
    code: WarnCode,
    reason: string,
    line?: string
}) {
    console.log(`\x1b[33mWARN<w${opts.code + 1}>\x1b[0m: ${opts.reason}`);
    if (opts.line) console.log(opts.line);
}
