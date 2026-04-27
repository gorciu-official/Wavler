export enum TokenType {
    LBRACE, RBRACE,
    LPAREN, RPAREN, COMMA,

    IDENTIFIER, NUMBER,
    STRING, TEMPLATE_STRING,

    IF_KEYWORD, ELSE_KEYWORD,
    SWITCH_KEYWORD, CASE_KEYWORD
}

export default interface Token {
    type: TokenType;
    value: string;
};
