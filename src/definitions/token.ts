export enum TokenType {
    LBRACE, RBRACE,
    LPAREN, RPAREN, 

    COMMA, SEMICOLON, 
    COLON, PIPE,

    ASSIGN_SIGN,

    IDENTIFIER, NUMBER,
    STRING, TEMPLATE_STRING,

    IF_KEYWORD, ELSE_KEYWORD,
    SWITCH_KEYWORD, CASE_KEYWORD,
    RETURN_KEYWORD, FUNCTION_KEYWORD,
    LET_KEYWORD, CONST_KEYWORD,

    PLUS_SIGN, MINUS_SIGN, 
    STAR_SIGN, SLASH_SIGN,

    LESS_THAN, GREATER_THAN,
    BITSHIFT_LEFT, BITSHIFT_RIGHT
}

type NonSpecialTokenType = Exclude<
    TokenType,
    TokenType.NUMBER | TokenType.TEMPLATE_STRING
>;

export interface BaseToken<T extends TokenType, V> {
    type: T;
    value: V;
}

export type NumberToken = BaseToken<TokenType.NUMBER, number>;

export type TemplateStringToken = BaseToken<
    TokenType.TEMPLATE_STRING,
    (string | Token)[]
>;

export type DefaultToken = BaseToken<NonSpecialTokenType, string>;

export type Token =
    | NumberToken
    | TemplateStringToken
    | DefaultToken;

export default Token;
