import process from "node:process";

export enum ErrorCode {
    MULTILINE_NON_TEMPLATE_STRING,
    UNTERMINATED_STRING_LITERAL,
    NUMBER_UNSUPPORTED_CHARACTER,
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
    INVALID_FOR_OF_SYNTAX
};

export enum WarnCode {
    CHARACTER_ESCAPING_NOT_USED
};

export function error(opts: {
    code: ErrorCode,
    reason: string,
    line?: string
}): never {
    console.log(`\x1b[31mERR<e${opts.code}>\x1b[0m: ${opts.reason}`);
    if (opts.line) console.log(opts.line);
    process.exit(1);
}

export function warn(opts: {
    code: WarnCode,
    reason: string,
    line?: string
}) {
    console.log(`\x1b[33mWARN<w${opts.code}>\x1b[0m: ${opts.reason}`);
    if (opts.line) console.log(opts.line);
}
