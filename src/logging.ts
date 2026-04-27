import process from "node:process";

export enum ErrorCode {
    MULTILINE_NON_TEMPLATE_STRING,
    UNTERMINATED_STRING_LITERAL
};

export enum WarnCode {
    CHARACTER_ESCAPING_NOT_USED
};

export function error(opts: {
    code: ErrorCode,
    reason: string,
    line?: string
}) {
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
